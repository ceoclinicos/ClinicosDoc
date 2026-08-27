const crypto = require("crypto");

const DEVICE_COL = "clinicosdoc_devices";

function normalizeDeviceId(raw) {
  const id = String(raw || "")
    .trim()
    .slice(0, 128);
  if (!id || id.length < 8) return "";
  return id;
}

function hashDeviceId(deviceId) {
  const id = normalizeDeviceId(deviceId);
  if (!id) return "";
  return crypto.createHash("sha256").update(id).digest("hex");
}

/**
 * ¿Este dispositivo ya consumió un trial con otra cuenta?
 */
async function deviceAlreadyUsedTrial(db, deviceId) {
  const hash = hashDeviceId(deviceId);
  if (!hash) return false;
  const snap = await db.collection(DEVICE_COL).doc(hash).get();
  if (!snap.exists) return false;
  const data = snap.data() || {};
  return Boolean(data.trialConsumed);
}

/**
 * Registra/asocia la firma al usuario. Si es cuenta nueva y el dispositivo
 * ya usó trial, marca trialGranted=false en el caller.
 */
async function bindDeviceToUser(db, { deviceId, userId, consumeTrial }) {
  const hash = hashDeviceId(deviceId);
  if (!hash || !userId) return { hash: "", alreadyUsed: false };
  const ref = db.collection(DEVICE_COL).doc(hash);
  const snap = await ref.get();
  const now = new Date().toISOString();
  if (!snap.exists) {
    await ref.set({
      hash,
      firstUserId: userId,
      firstAt: now,
      trialConsumed: Boolean(consumeTrial),
      userIds: [userId],
      updatedAt: now,
    });
    return { hash, alreadyUsed: false };
  }
  const data = snap.data() || {};
  const userIds = Array.isArray(data.userIds) ? data.userIds : [];
  const alreadyUsed = Boolean(data.trialConsumed);
  const nextUsers = userIds.includes(userId) ? userIds : [...userIds, userId].slice(0, 20);
  await ref.set(
    {
      userIds: nextUsers,
      trialConsumed: alreadyUsed || Boolean(consumeTrial),
      updatedAt: now,
      lastUserId: userId,
    },
    { merge: true },
  );
  return { hash, alreadyUsed };
}

module.exports = {
  DEVICE_COL,
  normalizeDeviceId,
  hashDeviceId,
  deviceAlreadyUsedTrial,
  bindDeviceToUser,
};
