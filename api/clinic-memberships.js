const { getAdmin } = require("./_lib/firebase");
const { normalizeCedula, cedulaLookupKeys } = require("./_lib/pin");
const { applyCors } = require("./_lib/cors");
const { parseBody } = require("./_lib/body");
const { apiError } = require("./_lib/errors");
const { isInviteExpired, deletePendingInvitePair } = require("./_lib/invite-expiry");

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

/** Invitaciones pendientes (aún no son afiliación). Prueba varias claves de cédula. */
async function pendingInvitesForDoctor(db, cedula) {
  if (!cedula || cedula.length < 7) return [];
  const keys = cedulaLookupKeys(cedula);
  const out = [];
  const seen = new Set();
  for (const key of keys) {
    const snap = await db
      .collection("clinicosdoc_doctor_invites")
      .doc(key)
      .collection("pending")
      .get();
    for (const d of snap.docs) {
      const data = d.data() || {};
      if (String(data.status || "pending") !== "pending") continue;
      const clinicId = String(data.clinicId || d.id);
      if (!clinicId || seen.has(clinicId)) continue;
      if (isInviteExpired(data)) {
        await deletePendingInvitePair(db, clinicId, data.doctorCedula || key);
        continue;
      }
      seen.add(clinicId);
      out.push({
        clinicId,
        clinicName: String(data.clinicName || "Centro"),
        doctorCedula: String(data.doctorCedula || cedula),
        invitedAt: String(data.invitedAt || ""),
        expiresAt: String(data.expiresAt || ""),
      });
    }
  }
  return out;
}

/**
 * Repara clinic_memberships si el médico ya está en members.
 * Preferencia: collectionGroup (rápido). Fallback: escaneo acotado de clínicas.
 */
async function healFromClinics(db, uid, cedula) {
  if (!cedula || cedula.length < 7) return [];
  const keys = cedulaLookupKeys(cedula);
  const out = [];
  const seen = new Set();

  async function recordMember(clinicRef, memberSnap) {
    const clinicId = clinicRef.id;
    if (seen.has(clinicId)) return;
    seen.add(clinicId);
    const clinicSnap = await clinicRef.get();
    const clinicName = String(clinicSnap.data()?.nombre || "Centro");
    const role = String(memberSnap?.data()?.role || "medico");
    const joinedAt = memberSnap?.data()?.joinedAt || new Date().toISOString();
    if (memberSnap && !memberSnap.data()?.cloudUserId) {
      await memberSnap.ref.set({ cloudUserId: uid }, { merge: true });
    }
    await upsertMembership(db, uid, clinicId, clinicName, role, joinedAt);
    out.push({ clinicId, clinicName, role });
  }

  // 1) collectionGroup por campo doctorCedula (máx. 10 valores en `in`)
  try {
    const batch = keys.slice(0, 10);
    if (batch.length) {
      const snap = await db.collectionGroup("members").where("doctorCedula", "in", batch).get();
      for (const memberDoc of snap.docs) {
        const clinicRef = memberDoc.ref.parent.parent;
        if (!clinicRef) continue;
        await recordMember(clinicRef, memberDoc);
      }
    }
  } catch (err) {
    console.warn("clinic-memberships heal collectionGroup:", err?.message || err);
  }

  // 2) Fallback: doc id = cédula en cada clínica (por si falta el campo doctorCedula)
  if (!out.length) {
    const clinicsSnap = await db.collection("clinicosdoc_clinics").limit(300).get();
    for (const clinicDoc of clinicsSnap.docs) {
      if (seen.has(clinicDoc.id)) continue;
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
      if (!memberSnap) {
        await clinicDoc.ref.collection("members").doc(cedula).set(
          {
            doctorCedula: cedula,
            doctorNombre: `Médico C.I. ${cedula}`,
            cloudUserId: uid,
            role: "medico",
            joinedAt: new Date().toISOString(),
          },
          { merge: true },
        );
        memberSnap = await clinicDoc.ref.collection("members").doc(cedula).get();
      }
      await recordMember(clinicDoc.ref, memberSnap);
    }
  }

  return out;
}

function mergeMemberships(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const m of list || []) {
      if (!m?.clinicId) continue;
      byId.set(m.clinicId, m);
    }
  }
  return [...byId.values()];
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
    const forceHeal = Boolean(body.forceHeal);
    const cedula = await resolveDoctorCedula(db, uid, decoded, body);

    let memberships = await membershipsFromUser(db, uid);
    if (!memberships.length || forceHeal) {
      const healed = await healFromClinics(db, uid, cedula);
      memberships = mergeMemberships(memberships, healed);
    }

    const pendingInvitations = await pendingInvitesForDoctor(db, cedula);

    memberships.sort((a, b) => a.clinicName.localeCompare(b.clinicName));
    return res.status(200).json({
      memberships,
      pendingInvitations,
      cedula: cedula || null,
    });
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
