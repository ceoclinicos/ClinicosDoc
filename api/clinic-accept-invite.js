const { getAdmin } = require("./_lib/firebase");
const { normalizeCedula } = require("./_lib/pin");
const { applyCors } = require("./_lib/cors");
const { parseBody } = require("./_lib/body");
const { apiError } = require("./_lib/errors");
const {
  isInviteExpired,
  deleteDoctorInvitation,
  clinicInviteRef,
  doctorMailboxRef,
} = require("./_lib/invite-expiry");
const { requireMedicoAuth } = require("./_lib/require-medico");

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  try {
    const { uid, decoded } = await requireMedicoAuth(req, getAdmin());
    const db = getAdmin().firestore();
    const body = parseBody(req);
    const action = String(body.action || "accept").toLowerCase();
    const clinicId = String(body.clinicId || "").trim();
    if (!clinicId) {
      return res.status(400).json({ error: "clinicId requerido" });
    }

    const doctorCedula = normalizeCedula(body.doctorCedula || decoded.cedula || "");
    if (doctorCedula.length < 7) {
      return res.status(400).json({ error: "Cédula del médico inválida" });
    }
    const doctorNombre = String(body.doctorNombre || "").trim() || `Médico C.I. ${doctorCedula}`;

    const mailboxSnap = await doctorMailboxRef(db, uid, clinicId).get();
    const clinicSnap = await clinicInviteRef(db, clinicId, doctorCedula).get();
    const invSnap = mailboxSnap.exists ? mailboxSnap : clinicSnap;
    const inv = invSnap.exists ? invSnap.data() || {} : {};

    if (action === "reject") {
      await deleteDoctorInvitation(
        db,
        clinicId,
        inv.doctorCedula || doctorCedula,
        inv.cloudUserId || uid,
      );
      return res.status(200).json({ ok: true, status: "rejected" });
    }

    if (!invSnap.exists) {
      return res.status(404).json({ error: "Invitación no encontrada" });
    }
    if (inv.status && inv.status !== "pending") {
      return res.status(409).json({ error: "Esta invitación ya no está pendiente" });
    }
    if (isInviteExpired(inv)) {
      await deleteDoctorInvitation(db, clinicId, inv.doctorCedula || doctorCedula, uid);
      return res.status(410).json({
        error: "La invitación venció. Pida al centro que lo invite de nuevo.",
      });
    }

    const clinicDoc = await db.collection("clinicosdoc_clinics").doc(clinicId).get();
    if (!clinicDoc.exists) {
      return res.status(404).json({ error: "Centro no encontrado" });
    }
    const clinicName = String(clinicDoc.data()?.nombre || inv.clinicName || "Centro");
    const joinedAt = new Date().toISOString();
    const memberCedula = normalizeCedula(inv.doctorCedula || doctorCedula);

    await db
      .collection("clinicosdoc_clinics")
      .doc(clinicId)
      .collection("members")
      .doc(memberCedula)
      .set({
        doctorCedula: memberCedula,
        doctorNombre: doctorNombre || inv.doctorNombre || doctorNombre,
        cloudUserId: uid,
        role: "medico",
        joinedAt,
      });

    await db
      .collection("clinicosdoc_user")
      .doc(uid)
      .collection("clinic_memberships")
      .doc(clinicId)
      .set({
        clinicId,
        clinicName,
        role: "medico",
        joinedAt,
      });

    await deleteDoctorInvitation(db, clinicId, memberCedula, uid);

    return res.status(200).json({
      ok: true,
      status: "accepted",
      clinicId,
      clinicName,
      role: "medico",
    });
  } catch (err) {
    const status = err?.status || (err?.code === "auth/id-token-expired" ? 401 : 500);
    if (status < 500) {
      return res.status(status).json({ error: err.message || "No se pudo procesar la invitación" });
    }
    console.error("clinic-accept-invite", err);
    return apiError(
      res,
      500,
      "No se pudo aceptar la invitación",
      err?.message || String(err),
      "CLINIC_ACCEPT_FAILED",
    );
  }
};
