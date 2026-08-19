const { normalizeCedula, cedulaLookupKeys } = require("./pin");

/** Días sin aceptar → se elimina de pendientes. */
const INVITE_TTL_DAYS = 7;
const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;
const USER_INVITES = "invitations";

function expiresAtIso(fromIso) {
  const base = Date.parse(fromIso || "") || Date.now();
  return new Date(base + INVITE_TTL_MS).toISOString();
}

function isInviteExpired(data) {
  if (!data || typeof data !== "object") return false;
  if (data.expiresAt) {
    const exp = Date.parse(String(data.expiresAt));
    if (!Number.isNaN(exp)) return Date.now() > exp;
  }
  const invited = Date.parse(String(data.invitedAt || ""));
  if (!Number.isNaN(invited)) return Date.now() > invited + INVITE_TTL_MS;
  return false;
}

function clinicInviteRef(db, clinicId, doctorCedula) {
  return db
    .collection("clinicosdoc_clinics")
    .doc(clinicId)
    .collection("invitations")
    .doc(normalizeCedula(doctorCedula));
}

function doctorMailboxRef(db, cloudUserId, clinicId) {
  return db
    .collection("clinicosdoc_user")
    .doc(cloudUserId)
    .collection(USER_INVITES)
    .doc(clinicId);
}

/** Borra invitación en clínica + buzón del médico (+ rutas legadas). */
async function deleteDoctorInvitation(db, clinicId, doctorCedula, cloudUserId) {
  const ced = normalizeCedula(doctorCedula);
  if (clinicId && ced) {
    await clinicInviteRef(db, clinicId, ced).delete().catch(() => {});
  }
  if (cloudUserId && clinicId) {
    await doctorMailboxRef(db, cloudUserId, clinicId).delete().catch(() => {});
  }
  // Limpieza legado (invitaciones antiguas)
  const keys = [
    ...new Set([ced, ...cedulaLookupKeys(doctorCedula || ""), cloudUserId || ""].filter(Boolean)),
  ];
  for (const key of keys) {
    await db
      .collection("clinicosdoc_doctor_invites")
      .doc(key)
      .collection("pending")
      .doc(clinicId)
      .delete()
      .catch(() => {});
    if (cloudUserId) {
      await db
        .collection("clinicosdoc_user")
        .doc(cloudUserId)
        .collection("clinic_notices")
        .doc(clinicId)
        .delete()
        .catch(() => {});
    }
  }
}

/** Copia invitaciones de clínicas al buzón del médico (sobreescribe). */
async function healDoctorInviteMailbox(db, cloudUserId, doctorCedula) {
  if (!cloudUserId || !doctorCedula) return;
  const keys = [...new Set([normalizeCedula(doctorCedula), ...cedulaLookupKeys(doctorCedula)])];
  for (const key of keys) {
    try {
      const snap = await db
        .collectionGroup("invitations")
        .where("doctorCedula", "==", key)
        .limit(30)
        .get();
      for (const d of snap.docs) {
        if (!d.ref.path.startsWith("clinicosdoc_clinics/")) continue;
        const data = d.data() || {};
        if (String(data.status || "pending") !== "pending") continue;
        const clinicId = String(data.clinicId || d.ref.path.split("/")[1] || "");
        if (!clinicId) continue;
        if (isInviteExpired(data)) {
          await deleteDoctorInvitation(
            db,
            clinicId,
            data.doctorCedula || doctorCedula,
            cloudUserId,
          );
          continue;
        }
        await doctorMailboxRef(db, cloudUserId, clinicId).set(
          {
            ...data,
            clinicId,
            cloudUserId,
            doctorCedula: normalizeCedula(data.doctorCedula || doctorCedula),
            status: "pending",
          },
          { merge: false },
        );
      }
    } catch (err) {
      console.warn("healDoctorInviteMailbox", err?.message || err);
    }
  }
}

/** Lista invitaciones pendientes del buzón del médico. */
async function listDoctorInvitations(db, cloudUserId, doctorCedula) {
  if (!cloudUserId) return [];
  await healDoctorInviteMailbox(db, cloudUserId, doctorCedula);
  const snap = await db
    .collection("clinicosdoc_user")
    .doc(cloudUserId)
    .collection(USER_INVITES)
    .get();
  const out = [];
  for (const d of snap.docs) {
    const data = d.data() || {};
    if (String(data.status || "pending") !== "pending") continue;
    const clinicId = String(data.clinicId || d.id || "");
    if (!clinicId) continue;
    if (isInviteExpired(data)) {
      await deleteDoctorInvitation(
        db,
        clinicId,
        data.doctorCedula || doctorCedula,
        cloudUserId,
      );
      continue;
    }
    out.push({
      clinicId,
      clinicName: String(data.clinicName || "Centro"),
      doctorCedula: String(data.doctorCedula || doctorCedula || ""),
      doctorNombre: String(data.doctorNombre || ""),
      invitedAt: String(data.invitedAt || ""),
      expiresAt: String(data.expiresAt || ""),
      status: "pending",
    });
  }
  return out;
}

/** @deprecated usar deleteDoctorInvitation */
async function deletePendingInvitePair(db, clinicId, doctorCedula, cloudUserId) {
  return deleteDoctorInvitation(db, clinicId, doctorCedula, cloudUserId);
}

module.exports = {
  INVITE_TTL_DAYS,
  INVITE_TTL_MS,
  USER_INVITES,
  expiresAtIso,
  isInviteExpired,
  deleteDoctorInvitation,
  deletePendingInvitePair,
  healDoctorInviteMailbox,
  listDoctorInvitations,
  clinicInviteRef,
  doctorMailboxRef,
};
