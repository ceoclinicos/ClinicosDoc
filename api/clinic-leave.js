const { getAdmin } = require("./_lib/firebase");
const { normalizeCedula } = require("./_lib/pin");
const { applyCors } = require("./_lib/cors");
const { parseBody } = require("./_lib/body");
const { apiError } = require("./_lib/errors");
const { requireMedicoAuth } = require("./_lib/require-medico");

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
    const memberKeys = [...new Set([doctorCedula, doctorCedula.replace(/\D/g, "")].filter(Boolean))];

    const clinicRef = db.collection("clinicosdoc_clinics").doc(clinicId);
    const clinicSnap = await clinicRef.get().catch(() => null);
    const clinicExists = Boolean(clinicSnap && clinicSnap.exists);

    // Siempre borrar la membresía del médico (aunque la clínica ya no exista).
    await db
      .collection("clinicosdoc_user")
      .doc(uid)
      .collection("clinic_memberships")
      .doc(clinicId)
      .delete()
      .catch(() => {});

    if (clinicExists) {
      for (const key of memberKeys) {
        await clinicRef.collection("members").doc(key).delete().catch(() => {});
      }
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
