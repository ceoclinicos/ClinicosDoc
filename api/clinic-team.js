const { getAdmin } = require("./_lib/firebase");
const { normalizeCedula } = require("./_lib/pin");
const { applyCors } = require("./_lib/cors");
const { parseBody } = require("./_lib/body");
const { apiError } = require("./_lib/errors");
const {
  isInviteExpired,
  deleteDoctorInvitation,
  clinicInviteRef,
} = require("./_lib/invite-expiry");

async function requireClinicAuth(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw Object.assign(new Error("Sesión de centro requerida. Vuelva a iniciar sesión."), {
      status: 401,
    });
  }
  const admin = getAdmin();
  const decoded = await admin.auth().verifyIdToken(match[1]);
  if (decoded.role !== "clinica") {
    throw Object.assign(new Error("Solo una clínica puede gestionar el equipo"), { status: 403 });
  }
  return { admin, uid: decoded.uid, decoded };
}

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  try {
    const { uid } = await requireClinicAuth(req);
    const db = getAdmin().firestore();
    const body = parseBody(req);
    const clinicId = String(body.clinicId || uid).trim();
    if (clinicId !== uid) {
      throw Object.assign(new Error("No puede gestionar otro centro"), { status: 403 });
    }

    const action = String(body.action || "list-pending").toLowerCase();

    if (action === "list-pending") {
      const snap = await db
        .collection("clinicosdoc_clinics")
        .doc(clinicId)
        .collection("invitations")
        .get();
      const pending = [];
      for (const d of snap.docs) {
        const data = d.data() || {};
        if (String(data.status || "pending") !== "pending") continue;
        const doctorCedula = normalizeCedula(data.doctorCedula || d.id);
        if (isInviteExpired(data)) {
          await deleteDoctorInvitation(
            db,
            clinicId,
            doctorCedula,
            data.cloudUserId || null,
          );
          continue;
        }
        pending.push({
          clinicId,
          clinicName: String(data.clinicName || "Centro"),
          doctorCedula,
          doctorNombre: String(data.doctorNombre || `Médico C.I. ${doctorCedula}`),
          cloudUserId: data.cloudUserId || null,
          status: "pending",
          invitedAt: String(data.invitedAt || ""),
          expiresAt: String(data.expiresAt || ""),
        });
      }
      pending.sort((a, b) => b.invitedAt.localeCompare(a.invitedAt));
      return res.status(200).json({ pending });
    }

    if (action === "list-members") {
      const snap = await db
        .collection("clinicosdoc_clinics")
        .doc(clinicId)
        .collection("members")
        .get();
      const members = snap.docs
        .map((d) => {
          const data = d.data() || {};
          return {
            doctorCedula: normalizeCedula(data.doctorCedula || d.id),
            doctorNombre: String(data.doctorNombre || ""),
            cloudUserId: data.cloudUserId || null,
            role: String(data.role || "medico"),
            joinedAt: String(data.joinedAt || ""),
          };
        })
        .sort((a, b) => a.doctorNombre.localeCompare(b.doctorNombre));
      return res.status(200).json({ members });
    }

    if (action === "cancel") {
      const doctorCedula = normalizeCedula(body.doctorCedula || "");
      if (doctorCedula.length < 7) {
        return res.status(400).json({ error: "Cédula inválida" });
      }
      const invSnap = await clinicInviteRef(db, clinicId, doctorCedula).get();
      const cloudUserId = invSnap.exists ? invSnap.data()?.cloudUserId : null;
      await deleteDoctorInvitation(db, clinicId, doctorCedula, cloudUserId);
      return res.status(200).json({ ok: true, status: "cancelled" });
    }

    return res.status(400).json({ error: "Acción no válida" });
  } catch (err) {
    const status = err?.status || (err?.code === "auth/id-token-expired" ? 401 : 500);
    if (status < 500) {
      return res.status(status).json({ error: err.message || "No se pudo completar la acción" });
    }
    console.error("clinic-team", err);
    return apiError(
      res,
      500,
      "No se pudo gestionar el equipo",
      err?.message || String(err),
      "CLINIC_TEAM_FAILED",
    );
  }
};
