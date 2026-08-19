const { getAdmin } = require("./_lib/firebase");
const { cedulaLookupKeys, normalizeCedula } = require("./_lib/pin");
const { applyCors } = require("./_lib/cors");
const { parseBody } = require("./_lib/body");
const { apiError } = require("./_lib/errors");
const {
  expiresAtIso,
  INVITE_TTL_DAYS,
  isInviteExpired,
  deleteDoctorInvitation,
  clinicInviteRef,
  doctorMailboxRef,
} = require("./_lib/invite-expiry");

async function findAppMedico(db, inputCedula) {
  const keys = cedulaLookupKeys(inputCedula);
  const digits = String(inputCedula).replace(/\D/g, "");
  const candidates = [...new Set([...keys, digits, String(inputCedula).trim()].filter(Boolean))];
  for (const key of candidates) {
    const byNorm = await db
      .collection("clinicosdoc_user")
      .where("cedulaNormalizada", "==", key)
      .limit(1)
      .get();
    if (!byNorm.empty) {
      return { id: byNorm.docs[0].id, data: byNorm.docs[0].data() };
    }
  }
  for (const key of candidates) {
    const byCed = await db.collection("clinicosdoc_user").where("cedula", "==", key).limit(1).get();
    if (!byCed.empty) {
      return { id: byCed.docs[0].id, data: byCed.docs[0].data() };
    }
  }
  return null;
}

async function findProfesional(db, inputCedula) {
  for (const key of cedulaLookupKeys(inputCedula)) {
    const s = await db.collection("profesionales").doc(key).get();
    if (s.exists) return s.data();
  }
  return null;
}

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
    throw Object.assign(new Error("Solo una clínica puede enviar invitaciones"), { status: 403 });
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
      throw Object.assign(new Error("No puede invitar en nombre de otro centro"), { status: 403 });
    }

    const clinicSnap = await db.collection("clinicosdoc_clinics").doc(clinicId).get();
    if (!clinicSnap.exists) {
      throw Object.assign(new Error("Centro no encontrado"), { status: 404 });
    }
    const clinic = clinicSnap.data() || {};

    const doctorCedula = normalizeCedula(body.doctorCedula);
    if (doctorCedula.length < 7) {
      throw Object.assign(new Error("Indique una cédula válida"), { status: 400 });
    }

    const memberSnap = await db
      .collection("clinicosdoc_clinics")
      .doc(clinicId)
      .collection("members")
      .doc(doctorCedula)
      .get();
    if (memberSnap.exists) {
      throw Object.assign(new Error("Ese médico ya está en el equipo"), { status: 409 });
    }

    const pendingRef = clinicInviteRef(db, clinicId, doctorCedula);
    const pendingSnap = await pendingRef.get();
    if (pendingSnap.exists && pendingSnap.data()?.status === "pending") {
      if (isInviteExpired(pendingSnap.data() || {})) {
        await deleteDoctorInvitation(
          db,
          clinicId,
          doctorCedula,
          pendingSnap.data()?.cloudUserId,
        );
      } else {
        throw Object.assign(new Error("Ya hay una invitación pendiente para esa cédula"), {
          status: 409,
        });
      }
    }

    const prof = await findProfesional(db, doctorCedula);
    const cloud = await findAppMedico(db, doctorCedula);
    if (!prof && !cloud) {
      throw Object.assign(
        new Error(
          "No encontramos esa cédula en ClinicosDoc. El médico debe registrarse en la app antes de invitarlo.",
        ),
        { status: 404 },
      );
    }
    const doctorNombre =
      (prof?.nombre || cloud?.data?.nombre || "").trim() || `Médico C.I. ${doctorCedula}`;

    const invitedAt = new Date().toISOString();
    const invitation = {
      clinicId,
      clinicName: String(clinic.nombre || "Centro"),
      doctorCedula,
      doctorNombre,
      cloudUserId: cloud?.id || null,
      status: "pending",
      invitedAt,
      expiresAt: expiresAtIso(invitedAt),
      ttlDays: INVITE_TTL_DAYS,
    };

    // 1) Copia en la clínica (lista Equipo)
    await pendingRef.set(invitation);

    // 2) Buzón del médico — sobreescribe: clinicosdoc_user/{uid}/invitations/{clinicId}
    if (cloud?.id) {
      await doctorMailboxRef(db, cloud.id, clinicId).set(invitation, { merge: false });
    }

    return res.status(200).json({
      ...invitation,
      deliveredToDoctor: Boolean(cloud?.id),
      message: cloud?.id
        ? "Invitación guardada en la cuenta del médico."
        : "Invitación registrada. El médico la verá al registrarse o iniciar sesión en la app.",
    });
  } catch (err) {
    const status = err?.status || (err?.code === "auth/id-token-expired" ? 401 : 500);
    if (status < 500) {
      return res.status(status).json({ error: err.message || "No se pudo invitar" });
    }
    console.error("clinic-invite", err);
    return apiError(
      res,
      500,
      "No se pudo enviar la invitación",
      err?.message || String(err),
      "CLINIC_INVITE_FAILED",
    );
  }
};
