const { getAdmin } = require("../firebase");
const { normalizeCedula, cedulaLookupKeys } = require("../pin");
const { applyCors } = require("../cors");
const { parseBody } = require("../body");
const { apiError } = require("../errors");
const { requireMedicoAuth } = require("../require-medico");
const { deleteDoctorInvitation } = require("../invite-expiry");
const { markClinicLeft } = require("../clinic-left");

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

    const doctorCedula = normalizeCedula(body.doctorCedula || decoded.cedula || "");
    const memberKeys = [
      ...new Set(
        [doctorCedula, ...cedulaLookupKeys(doctorCedula), doctorCedula.replace(/\D/g, "")].filter(
          Boolean,
        ),
      ),
    ];

    const clinicRef = db.collection("clinicosdoc_clinics").doc(clinicId);
    const clinicSnap = await clinicRef.get().catch(() => null);
    const clinicExists = Boolean(clinicSnap && clinicSnap.exists);
    const clinicName = clinicExists
      ? String(clinicSnap.data()?.nombre || "")
      : String(body.clinicName || "");

    // Membresía del médico
    await db
      .collection("clinicosdoc_user")
      .doc(uid)
      .collection("clinic_memberships")
      .doc(clinicId)
      .delete()
      .catch(() => {});

    // Bloqueo: el heal no debe volver a agregar esta clínica.
    await markClinicLeft(db, uid, clinicId, clinicName);

    // Invitaciones / buzón
    await deleteDoctorInvitation(db, clinicId, doctorCedula, uid);

    // Siempre intentar borrar members (aunque el doc de clínica ya no exista:
    // en Firestore las subcolecciones pueden quedar huérfanas).
    for (const key of memberKeys) {
      await clinicRef.collection("members").doc(key).delete().catch(() => {});
      await clinicRef.collection("invitations").doc(key).delete().catch(() => {});
    }

    // Extra: members cuyo doctorCedula coincide pero el doc id es distinto
    try {
      const batch = memberKeys.slice(0, 10);
      if (batch.length) {
        const snap = await clinicRef
          .collection("members")
          .where("doctorCedula", "in", batch)
          .get();
        for (const d of snap.docs) {
          await d.ref.delete().catch(() => {});
        }
      }
    } catch (err) {
      console.warn("clinic-leave members query:", err?.message || err);
    }

    return res.status(200).json({
      ok: true,
      clinicId,
      status: "left",
      clinicExists,
    });
  } catch (err) {
    const status = err?.status || (err?.code === "auth/id-token-expired" ? 401 : 500);
    if (status < 500) {
      return res.status(status).json({ error: err.message || "No se pudo desvincular" });
    }
    console.error("clinic-leave", err);
    return apiError(
      res,
      500,
      "No se pudo desvincular del centro",
      err?.message || String(err),
      "CLINIC_LEAVE_FAILED",
    );
  }
};
