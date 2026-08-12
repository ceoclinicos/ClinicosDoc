const { getAdmin } = require("./_lib/firebase");
const { normalizeCedula, cedulaLookupKeys } = require("./_lib/pin");
const { applyCors } = require("./_lib/cors");
const { parseBody } = require("./_lib/body");
const { apiError } = require("./_lib/errors");
const { isInviteExpired, deletePendingInvitePair } = require("./_lib/invite-expiry");
const { requireMedicoAuth } = require("./_lib/require-medico");

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  try {
    const { admin, uid, decoded } = await requireMedicoAuth(req, getAdmin());
    const db = admin.firestore();
    const body = parseBody(req);
    const action = String(body.action || "accept").toLowerCase();
    const clinicId = String(body.clinicId || "").trim();
    if (!clinicId) {
      return res.status(400).json({ error: "clinicId requerido" });
    }

    const doctorCedula = normalizeCedula(
      body.doctorCedula || decoded.cedula || "",
    );
    if (doctorCedula.length < 7) {
      return res.status(400).json({ error: "Cédula del médico inválida" });
    }
    const doctorNombre = String(body.doctorNombre || "").trim() || `Médico C.I. ${doctorCedula}`;

    const invKeys = [...new Set([doctorCedula, ...cedulaLookupKeys(doctorCedula)])];
    let invRef = null;
    let invSnap = null;
    for (const key of invKeys) {
      const ref = db
        .collection("clinicosdoc_clinics")
        .doc(clinicId)
        .collection("invitations")
        .doc(key);
      const snap = await ref.get();
      if (snap.exists) {
        invRef = ref;
        invSnap = snap;
        break;
      }
    }
    if (!invRef) {
      invRef = db
        .collection("clinicosdoc_clinics")
        .doc(clinicId)
        .collection("invitations")
        .doc(doctorCedula);
      invSnap = await invRef.get();
    }

    if (action === "reject") {
      const invData = invSnap.exists ? invSnap.data() || {} : {};
      await deletePendingInvitePair(
        db,
        clinicId,
        invData.doctorCedula || doctorCedula,
        invData.cloudUserId || uid,
      );
      await db
        .collection("clinicosdoc_user")
        .doc(uid)
        .collection("clinic_notices")
        .doc(clinicId)
        .delete()
        .catch(() => {});
      return res.status(200).json({ ok: true, status: "rejected" });
    }

    if (!invSnap.exists) {
      return res.status(404).json({ error: "Invitación no encontrada" });
    }
    const inv = invSnap.data() || {};
    if (inv.status && inv.status !== "pending") {
      return res.status(409).json({ error: "Esta invitación ya no está pendiente" });
    }
    if (isInviteExpired(inv)) {
      await deletePendingInvitePair(db, clinicId, inv.doctorCedula || doctorCedula, inv.cloudUserId || uid);
      return res.status(410).json({
        error: "La invitación venció. Pida al centro que lo invite de nuevo.",
      });
    }

    const clinicSnap = await db.collection("clinicosdoc_clinics").doc(clinicId).get();
    if (!clinicSnap.exists) {
      return res.status(404).json({ error: "Centro no encontrado" });
    }
    const clinicName = String(
      clinicSnap.data()?.nombre || inv.clinicName || "Centro",
    );
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

    await invRef.set({ status: "accepted" }, { merge: true });
    await deletePendingInvitePair(db, clinicId, memberCedula, inv.cloudUserId || uid);
    await db
      .collection("clinicosdoc_user")
      .doc(uid)
      .collection("clinic_notices")
      .doc(clinicId)
      .delete()
      .catch(() => {});

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
