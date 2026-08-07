const { getAdmin } = require("./_lib/firebase");
const { normalizeCedula } = require("./_lib/pin");
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

/** Recupera afiliaciones si el médico está en members pero falta clinic_memberships. */
async function healFromClinicMembers(db, uid, cedula) {
  const out = [];
  const seen = new Set();

  const queries = [];
  if (cedula) {
    queries.push(
      db.collectionGroup("members").where("doctorCedula", "==", cedula).limit(30).get(),
    );
  }
  queries.push(db.collectionGroup("members").where("cloudUserId", "==", uid).limit(30).get());

  const snaps = await Promise.all(queries);
  for (const snap of snaps) {
    for (const d of snap.docs) {
      // path: clinicosdoc_clinics/{clinicId}/members/{cedula}
      const parts = d.ref.path.split("/");
      if (parts.length < 4 || parts[0] !== "clinicosdoc_clinics") continue;
      const clinicId = parts[1];
      if (seen.has(clinicId)) continue;
      seen.add(clinicId);

      const data = d.data() || {};
      const clinicSnap = await db.collection("clinicosdoc_clinics").doc(clinicId).get();
      const clinicName = String(
        clinicSnap.data()?.nombre || data.clinicName || "Centro",
      );
      const role = String(data.role || "medico");

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
            joinedAt: data.joinedAt || new Date().toISOString(),
            healedAt: new Date().toISOString(),
          },
          { merge: true },
        );

      if (cedula && !data.cloudUserId) {
        await d.ref.set({ cloudUserId: uid }, { merge: true });
      }

      out.push({ clinicId, clinicName, role });
    }
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
    const cedula = normalizeCedula(body.doctorCedula || decoded.cedula || "");

    let memberships = await membershipsFromUser(db, uid);

    if (!memberships.length) {
      const healed = await healFromClinicMembers(db, uid, cedula);
      if (healed.length) memberships = healed;
    }

    memberships.sort((a, b) => a.clinicName.localeCompare(b.clinicName));
    return res.status(200).json({ memberships });
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
