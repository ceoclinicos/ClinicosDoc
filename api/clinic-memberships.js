const { getAdmin } = require("./_lib/firebase");
const { normalizeCedula, cedulaLookupKeys } = require("./_lib/pin");
const { applyCors } = require("./_lib/cors");
const { parseBody } = require("./_lib/body");
const { apiError } = require("./_lib/errors");

async function requireMedicoAuth(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw Object.assign(new Error("Sesión de médico requerida. Vuelva a iniciar sesión."), {
      status: 401,
    });
  }
  const admin = getAdmin();
  const decoded = await admin.auth().verifyIdToken(match[1]);
  if (decoded.role !== "medico") {
    throw Object.assign(new Error("Solo un médico puede consultar centros"), { status: 403 });
  }
  return { admin, uid: decoded.uid, decoded };
}

async function resolveDoctorCedula(db, uid, decoded, body) {
  const fromBody = normalizeCedula(body.doctorCedula || "");
  if (fromBody.length >= 7) return fromBody;
  const fromClaim = normalizeCedula(decoded.cedula || "");
  if (fromClaim.length >= 7) return fromClaim;
  const userSnap = await db.collection("clinicosdoc_user").doc(uid).get();
  const data = userSnap.data() || {};
  return normalizeCedula(data.cedulaNormalizada || data.cedula || "");
}

async function membershipsFromUser(db, uid) {
  const snap = await db
    .collection("clinicosdoc_user")
    .doc(uid)
    .collection("clinic_memberships")
    .get();
  return snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      clinicId: String(data.clinicId || d.id),
      clinicName: String(data.clinicName || "Centro"),
      role: String(data.role || "medico"),
    };
  });
}

async function upsertMembership(db, uid, clinicId, clinicName, role, joinedAt) {
  await db
    .collection("clinicosdoc_user")
    .doc(uid)
    .collection("clinic_memberships")
    .doc(clinicId)
    .set(
      {
        clinicId,
        clinicName,
        role,
        joinedAt: joinedAt || new Date().toISOString(),
        healedAt: new Date().toISOString(),
      },
      { merge: true },
    );
}

/** Si el médico está en members (o invitación aceptada) pero falta clinic_memberships. */
async function healFromClinics(db, uid, cedula) {
  if (!cedula || cedula.length < 7) return [];
  const keys = cedulaLookupKeys(cedula);
  const clinicsSnap = await db.collection("clinicosdoc_clinics").limit(300).get();
  const out = [];
  const seen = new Set();

  for (const clinicDoc of clinicsSnap.docs) {
    const clinicId = clinicDoc.id;
    if (seen.has(clinicId)) continue;

    let memberSnap = null;
    for (const key of keys) {
      const snap = await clinicDoc.ref.collection("members").doc(key).get();
      if (snap.exists) {
        memberSnap = snap;
        break;
      }
    }

    let acceptedInvite = false;
    if (!memberSnap) {
      for (const key of keys) {
        const inv = await clinicDoc.ref.collection("invitations").doc(key).get();
        if (inv.exists && String(inv.data()?.status || "") === "accepted") {
          acceptedInvite = true;
          break;
        }
      }
    }

    if (!memberSnap && !acceptedInvite) continue;
    seen.add(clinicId);

    const clinicName = String(clinicDoc.data()?.nombre || "Centro");
    const role = String(memberSnap?.data()?.role || "medico");
    const joinedAt = memberSnap?.data()?.joinedAt || new Date().toISOString();

    if (!memberSnap) {
      await clinicDoc.ref.collection("members").doc(cedula).set(
        {
          doctorCedula: cedula,
          doctorNombre: `Médico C.I. ${cedula}`,
          cloudUserId: uid,
          role: "medico",
          joinedAt,
        },
        { merge: true },
      );
    } else if (!memberSnap.data()?.cloudUserId) {
      await memberSnap.ref.set({ cloudUserId: uid }, { merge: true });
    }

    await upsertMembership(db, uid, clinicId, clinicName, role, joinedAt);
    out.push({ clinicId, clinicName, role });
  }

  return out;
}

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Solo GET o POST" });
  }

  try {
    const { admin, uid, decoded } = await requireMedicoAuth(req);
    const db = admin.firestore();
    const body = req.method === "POST" ? parseBody(req) : {};
    const cedula = await resolveDoctorCedula(db, uid, decoded, body);

    let memberships = await membershipsFromUser(db, uid);

    if (!memberships.length) {
      const healed = await healFromClinics(db, uid, cedula);
      if (healed.length) memberships = healed;
    }

    memberships.sort((a, b) => a.clinicName.localeCompare(b.clinicName));
    return res.status(200).json({ memberships, cedula: cedula || null });
  } catch (err) {
    const status = err?.status || (err?.code === "auth/id-token-expired" ? 401 : 500);
    if (status < 500) {
      return res.status(status).json({ error: err.message || "No se pudieron cargar centros" });
    }
    console.error("clinic-memberships", err);
    return apiError(
      res,
      500,
      "No se pudieron cargar centros",
      err?.message || String(err),
      "CLINIC_MEMBERSHIPS_FAILED",
    );
  }
};
