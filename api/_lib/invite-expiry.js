const { normalizeCedula, cedulaLookupKeys } = require("./pin");

/** Días sin aceptar → se elimina de pendientes (lista de la clínica y del médico). */
const INVITE_TTL_DAYS = 7;
const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

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

async function deletePendingInvitePair(db, clinicId, doctorCedula) {
  const ced = normalizeCedula(doctorCedula);
  if (!clinicId || !ced) return;
  await db
    .collection("clinicosdoc_clinics")
    .doc(clinicId)
    .collection("invitations")
    .doc(ced)
    .delete()
    .catch(() => {});
  const keys = [...new Set([ced, ...cedulaLookupKeys(doctorCedula)])];
  for (const key of keys) {
    await db
      .collection("clinicosdoc_doctor_invites")
      .doc(key)
      .collection("pending")
      .doc(clinicId)
      .delete()
      .catch(() => {});
  }
}

module.exports = {
  INVITE_TTL_DAYS,
  INVITE_TTL_MS,
  expiresAtIso,
  isInviteExpired,
  deletePendingInvitePair,
};
