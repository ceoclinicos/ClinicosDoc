const { getAdmin } = require("./_lib/firebase");
const { normalizeCedula } = require("./_lib/pin");
const { applyCors } = require("./_lib/cors");
const { parseBody } = require("./_lib/body");
const { apiError } = require("./_lib/errors");
const { requireMedicoAuth } = require("./_lib/require-medico");
const { ensureClinicDefaultCatalog } = require("./_lib/clinic-defaults");

async function assertClinicAccess(db, uid, clinicId, cedula) {
  const memberSnap = await db
    .collection("clinicosdoc_user")
    .doc(uid)
    .collection("clinic_memberships")
    .doc(clinicId)
    .get();
  if (memberSnap.exists) return true;

  if (cedula) {
    const clinicMember = await db
      .collection("clinicosdoc_clinics")
      .doc(clinicId)
      .collection("members")
      .doc(cedula)
      .get();
    if (clinicMember.exists) {
      const clinicSnap = await db.collection("clinicosdoc_clinics").doc(clinicId).get();
      const clinicName = String(clinicSnap.data()?.nombre || "Centro");
      await db
        .collection("clinicosdoc_user")
        .doc(uid)
        .collection("clinic_memberships")
        .doc(clinicId)
        .set(
          {
            clinicId,
            clinicName,
            role: String(clinicMember.data()?.role || "medico"),
            joinedAt: clinicMember.data()?.joinedAt || new Date().toISOString(),
            healedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      return true;
    }
  }
  return false;
}

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  try {
    const { admin, uid, decoded } = await requireMedicoAuth(req, getAdmin());
    const db = admin.firestore();
    const body = parseBody(req);
    const clinicId = String(body.clinicId || "").trim();
    if (!clinicId) return res.status(400).json({ error: "clinicId requerido" });

    const cedula = normalizeCedula(body.doctorCedula || decoded.cedula || "");
    const ok = await assertClinicAccess(db, uid, clinicId, cedula);
    if (!ok) {
      return res.status(403).json({ error: "No está afiliado a este centro" });
    }

    const typeFilter = body.documentType ? String(body.documentType) : "";
    const clinicSnap = await db.collection("clinicosdoc_clinics").doc(clinicId).get();
    const clinicName = String(clinicSnap.data()?.nombre || "Centro");
    const ensured = await ensureClinicDefaultCatalog(db, clinicId, clinicName);
    let templates = ensured.templates;
    if (typeFilter) {
      templates = templates.filter((t) => String(t.documentType) === typeFilter);
    }
    const headers = ensured.headers;

    return res.status(200).json({ templates, headers });
  } catch (err) {
    const status = err?.status || (err?.code === "auth/id-token-expired" ? 401 : 500);
    if (status < 500) {
      return res.status(status).json({ error: err.message || "No se pudieron cargar plantillas" });
    }
    console.error("clinic-templates", err);
    return apiError(
      res,
      500,
      "No se pudieron cargar plantillas del centro",
      err?.message || String(err),
      "CLINIC_TEMPLATES_FAILED",
    );
  }
};
