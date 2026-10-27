const { getAdmin } = require("../firebase");
const { normalizeCedula } = require("../pin");
const { applyCors } = require("../cors");
const { parseBody } = require("../body");
const { apiError } = require("../errors");
const { requireMedicoAuth } = require("../require-medico");
const { assertClinicSyncAllowed } = require("../clinic-entitlements");

async function assertClinicMembership(db, uid, clinicId, cedula) {
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
    if (clinicMember.exists) return true;
  }
  return false;
}

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  try {
    const { uid, decoded } = await requireMedicoAuth(req, getAdmin());
    const db = getAdmin().firestore();
    const body = parseBody(req);
    const clinicId = String(body.clinicId || "").trim();
    const document = body.document || {};
    const doctorNombre = String(body.doctorNombre || decoded.nombre || "Médico").trim();

    if (!clinicId) return res.status(400).json({ error: "clinicId requerido" });
    if (!document.id) return res.status(400).json({ error: "document.id requerido" });

    const cedula = normalizeCedula(body.doctorCedula || decoded.cedula || "");
    const memberOk = await assertClinicMembership(db, uid, clinicId, cedula);
    if (!memberOk) {
      return res.status(403).json({ error: "No está afiliado a este centro" });
    }

    await assertClinicSyncAllowed(db, clinicId);

    const patientCedula = normalizeCedula(document.patientCedula || "");
    const payload = {
      id: String(document.id),
      patientId: String(document.patientId || ""),
      patientNombre: String(document.patientNombre || "Paciente"),
      patientCedula,
      type: String(document.type || ""),
      content: String(document.content || ""),
      rawDictation: document.rawDictation != null ? String(document.rawDictation) : null,
      createdAt: String(document.createdAt || new Date().toISOString()),
      templateId: document.templateId ?? null,
      templateName: document.templateName ?? null,
      headerId: document.headerId ?? null,
      headerSnapshot: document.headerSnapshot ?? null,
      membrete: document.membrete ?? null,
      sourceDocumentId: document.sourceDocumentId ?? null,
      clinicId,
      clinicName: document.clinicName ?? null,
      doctorNombre,
      syncedAt: new Date().toISOString(),
    };

    await db
      .collection("clinicosdoc_clinics")
      .doc(clinicId)
      .collection("documents")
      .doc(payload.id)
      .set(payload, { merge: true });

    return res.status(200).json({ ok: true, documentId: payload.id });
  } catch (err) {
    const status = err?.status || (err?.code === "auth/id-token-expired" ? 401 : 500);
    if (status < 500) {
      return res.status(status).json({
        error: err.message || "No se pudo enviar el informe al centro",
        code: err.code || undefined,
      });
    }
    console.error("clinic-document-push", err);
    return apiError(
      res,
      500,
      "No se pudo enviar el informe al centro",
      err?.message || String(err),
      "CLINIC_DOC_PUSH_FAILED",
    );
  }
};
