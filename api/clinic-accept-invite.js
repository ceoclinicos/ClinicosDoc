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
    throw Object.assign(new Error("Solo un médico puede aceptar invitaciones"), { status: 403 });
  }
  return { admin, uid: decoded.uid, decoded };
}

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  try {
    const { admin, uid, decoded } = await requireMedicoAuth(req);
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

    const invRef = db
      .collection("clinicosdoc_clinics")
      .doc(clinicId)
      .collection("invitations")
      .doc(doctorCedula);
    const pendingRef = db
      .collection("clinicosdoc_doctor_invites")
      .doc(doctorCedula)
      .collection("pending")
      .doc(clinicId);

    if (action === "reject") {
      const invSnap = await invRef.get();
      if (invSnap.exists) {
        await invRef.set({ status: "rejected" }, { merge: true });
      }
      await pendingRef.delete().catch(() => {});
      return res.status(200).json({ ok: true, status: "rejected" });
    }

    const invSnap = await invRef.get();
    if (!invSnap.exists) {
      return res.status(404).json({ error: "Invitación no encontrada" });
    }
    const inv = invSnap.data() || {};
    if (inv.status && inv.status !== "pending") {
      return res.status(409).json({ error: "Esta invitación ya no está pendiente" });
    }

    const clinicSnap = await db.collection("clinicosdoc_clinics").doc(clinicId).get();
    if (!clinicSnap.exists) {
      return res.status(404).json({ error: "Centro no encontrado" });
    }
    const clinicName = String(
      clinicSnap.data()?.nombre || inv.clinicName || "Centro",
    );
    const joinedAt = new Date().toISOString();

    await db
      .collection("clinicosdoc_clinics")
      .doc(clinicId)
      .collection("members")
      .doc(doctorCedula)
      .set({
        doctorCedula,
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
    await pendingRef.delete().catch(() => {});

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
