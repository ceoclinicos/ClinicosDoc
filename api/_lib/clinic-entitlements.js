const { hashDeviceId, normalizeDeviceId } = require("./device-fingerprint");

/** Máximo de dispositivos por cuenta clínica. */
const MAX_CLINIC_DEVICES = 2;
/** Cupo mensual de IA para la cuenta clínica (administración). */
const CLINIC_AI_QUOTA = 200;
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

const TIERS = {
  free: { maxDoctors: 5, label: "Gratis (hasta 5 médicos)", priceUsd: 0 },
  tier_50: { maxDoctors: 50, label: "Hasta 50 médicos — $30/mes", priceUsd: 30 },
  tier_100: { maxDoctors: 100, label: "Hasta 100 médicos — $60/mes", priceUsd: 60 },
  tier_unlimited: { maxDoctors: 999999, label: "Más de 100 médicos — $100/mes", priceUsd: 100 },
};

function nowIso() {
  return new Date().toISOString();
}

function addMs(iso, ms) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return nowIso();
  return new Date(t + ms).toISOString();
}

function defaultClinicEntitlement() {
  const now = nowIso();
  return {
    plan: "free",
    tier: "free",
    periodStartAt: null,
    periodEndAt: null,
    periodAiUses: 0,
    periodAiQuota: CLINIC_AI_QUOTA,
    deviceFingerprints: [],
    updatedAt: now,
  };
}

function readClinicEntitlement(clinicData) {
  const e = clinicData?.clinicEntitlement;
  if (!e || typeof e !== "object") return defaultClinicEntitlement();
  return {
    ...defaultClinicEntitlement(),
    ...e,
    periodAiUses: Number(e.periodAiUses) || 0,
    periodAiQuota: Number(e.periodAiQuota) || CLINIC_AI_QUOTA,
    deviceFingerprints: Array.isArray(e.deviceFingerprints) ? e.deviceFingerprints : [],
  };
}

function rollClinicPeriodIfNeeded(ent) {
  if (ent.plan !== "subscribed") return ent;
  if (!ent.periodEndAt) return ent;
  const end = Date.parse(ent.periodEndAt);
  if (!Number.isFinite(end) || Date.now() < end) return ent;
  return { ...ent, plan: "expired", updatedAt: nowIso() };
}

function tierForTeamSize(size) {
  if (size <= 5) return "free";
  if (size <= 50) return "tier_50";
  if (size <= 100) return "tier_100";
  return "tier_unlimited";
}

function tierRank(tier) {
  const order = ["free", "tier_50", "tier_100", "tier_unlimited"];
  const i = order.indexOf(tier);
  return i >= 0 ? i : 0;
}

function paidSubscriptionActive(ent) {
  const rolled = rollClinicPeriodIfNeeded(ent);
  if (rolled.plan !== "subscribed") return false;
  const end = Date.parse(rolled.periodEndAt || "");
  return Number.isFinite(end) && Date.now() < end;
}

/**
 * ¿El centro puede recibir nuevos informes y actualizar el panel?
 */
function isClinicSyncActive(ent, teamSize) {
  const needed = tierForTeamSize(teamSize);
  if (needed === "free") return teamSize <= TIERS.free.maxDoctors;

  if (!paidSubscriptionActive(ent)) return false;
  const tier = ent.tier || "free";
  if (tier === "free") return false;
  return tierRank(tier) >= tierRank(needed) && teamSize <= (TIERS[tier]?.maxDoctors ?? 0);
}

function maxDoctorsForEntitlement(ent) {
  const rolled = rollClinicPeriodIfNeeded(ent);
  if (rolled.plan === "subscribed" && paidSubscriptionActive(rolled)) {
    return TIERS[rolled.tier]?.maxDoctors ?? TIERS.free.maxDoctors;
  }
  return TIERS.free.maxDoctors;
}

function canAddTeamMember(ent, currentTeamSize) {
  const max = maxDoctorsForEntitlement(ent);
  if (currentTeamSize >= max) {
    const needed = tierForTeamSize(currentTeamSize + 1);
    const tierInfo = TIERS[needed];
    if (needed === "free") {
      return { ok: false, reason: "Límite de 5 médicos en plan gratuito." };
    }
    if (!paidSubscriptionActive(ent)) {
      return {
        ok: false,
        reason: `Necesita suscripción activa (${tierInfo.label}) para más de 5 médicos.`,
      };
    }
    if (tierRank(ent.tier) < tierRank(needed)) {
      return {
        ok: false,
        reason: `Su plan actual no cubre ${currentTeamSize + 1} médicos. Actualice a ${tierInfo.label}.`,
      };
    }
    return { ok: false, reason: `Límite de ${max} médicos en su plan actual.` };
  }
  return { ok: true, reason: "" };
}

function buildClinicPublicStatus(ent, teamSize) {
  const rolled = rollClinicPeriodIfNeeded(ent);
  const syncActive = isClinicSyncActive(rolled, teamSize);
  const needed = tierForTeamSize(teamSize);
  const maxDoctors = maxDoctorsForEntitlement(rolled);
  const paid = paidSubscriptionActive(rolled);
  const quota = Number(rolled.periodAiQuota) || CLINIC_AI_QUOTA;
  const used = Number(rolled.periodAiUses) || 0;
  const remaining = Math.max(0, quota - used);
  const canUseAi = paid && remaining > 0;

  let message = "";
  if (!syncActive) {
    if (teamSize > TIERS.free.maxDoctors && !paid) {
      message =
        "La suscripción del centro venció. El panel queda en solo lectura hasta renovar.";
    } else if (teamSize > maxDoctors) {
      message = "Tiene más médicos de los que permite su plan. Actualice la suscripción.";
    } else if (teamSize > TIERS.free.maxDoctors) {
      message = "Active la suscripción del centro para sincronizar informes.";
    }
  }

  return {
    plan: rolled.plan,
    tier: rolled.tier || "free",
    neededTier: needed,
    teamSize,
    maxDoctors,
    syncActive,
    canUseAi,
    canInvite: canAddTeamMember(rolled, teamSize).ok,
    devices: {
      max: MAX_CLINIC_DEVICES,
      registered: (rolled.deviceFingerprints || []).length,
    },
    period: {
      uses: used,
      quota,
      remaining,
      endAt: rolled.periodEndAt || null,
    },
    tiers: Object.entries(TIERS).map(([id, t]) => ({ id, ...t })),
    message,
    code: syncActive ? "OK" : "CLINIC_PAYWALL",
  };
}

async function countClinicTeamSize(db, clinicId) {
  const [membersSnap, invitesSnap] = await Promise.all([
    db.collection("clinicosdoc_clinics").doc(clinicId).collection("members").get(),
    db.collection("clinicosdoc_clinics").doc(clinicId).collection("invitations").get(),
  ]);
  let pending = 0;
  for (const doc of invitesSnap.docs) {
    const d = doc.data() || {};
    if (d.status === "pending") pending += 1;
  }
  return membersSnap.size + pending;
}

async function initClinicEntitlementOnRegister(db, clinicRef) {
  const ent = defaultClinicEntitlement();
  await clinicRef.set({ clinicEntitlement: ent, updatedAt: nowIso() }, { merge: true });
  return ent;
}

async function touchClinicDeviceOnLogin(db, clinicRef, clinicData, { deviceId, clinicId }) {
  const normalized = normalizeDeviceId(deviceId);
  let ent = readClinicEntitlement(clinicData);
  ent = rollClinicPeriodIfNeeded(ent);

  if (!normalized) {
    if (ent.plan !== clinicData?.clinicEntitlement?.plan) {
      await clinicRef.set({ clinicEntitlement: ent, updatedAt: nowIso() }, { merge: true });
    }
    return ent;
  }

  const hash = hashDeviceId(normalized);
  const fps = Array.isArray(ent.deviceFingerprints) ? [...ent.deviceFingerprints] : [];
  if (hash && !fps.includes(hash)) {
    if (fps.length >= MAX_CLINIC_DEVICES) {
      throw Object.assign(
        new Error(
          `Este centro ya tiene ${MAX_CLINIC_DEVICES} dispositivos registrados. Cierre sesión en otro equipo o contacte soporte.`,
        ),
        { status: 403, code: "CLINIC_DEVICE_LIMIT" },
      );
    }
    fps.push(hash);
    ent = { ...ent, deviceFingerprints: fps, updatedAt: nowIso() };
  }

  await clinicRef.set({ clinicEntitlement: ent, updatedAt: nowIso() }, { merge: true });
  return ent;
}

async function getClinicStatus(db, clinicId) {
  const ref = db.collection("clinicosdoc_clinics").doc(clinicId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { canUseAi: false, syncActive: false, message: "Centro no encontrado", code: "NO_CLINIC" };
  }
  let ent = readClinicEntitlement(snap.data() || {});
  const rolled = rollClinicPeriodIfNeeded(ent);
  if (rolled.plan !== ent.plan) {
    await ref.set({ clinicEntitlement: rolled, updatedAt: nowIso() }, { merge: true });
    ent = rolled;
  }
  const teamSize = await countClinicTeamSize(db, clinicId);
  return buildClinicPublicStatus(ent, teamSize);
}

async function consumeClinicAiUse(db, clinicId) {
  const ref = db.collection("clinicosdoc_clinics").doc(clinicId);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return {
        ok: false,
        httpStatus: 403,
        ent: null,
        status: { canUseAi: false, message: "Centro no encontrado", code: "NO_CLINIC" },
      };
    }
    let ent = readClinicEntitlement(snap.data() || {});
    ent = rollClinicPeriodIfNeeded(ent);
    if (!paidSubscriptionActive(ent)) {
      tx.set(ref, { clinicEntitlement: ent, updatedAt: nowIso() }, { merge: true });
      return {
        ok: false,
        httpStatus: 402,
        ent,
        status: {
          canUseAi: false,
          message: "La IA del centro requiere suscripción activa (plan de pago).",
          code: "CLINIC_PAYWALL",
        },
      };
    }
    const quota = Number(ent.periodAiQuota) || CLINIC_AI_QUOTA;
    const used = Number(ent.periodAiUses) || 0;
    if (used >= quota) {
      return {
        ok: false,
        httpStatus: 402,
        ent,
        status: {
          canUseAi: false,
          message: "Agotó el cupo mensual de IA del centro.",
          code: "CLINIC_AI_QUOTA",
        },
      };
    }
    ent = { ...ent, periodAiUses: used + 1, updatedAt: nowIso() };
    tx.set(ref, { clinicEntitlement: ent, updatedAt: nowIso() }, { merge: true });
    return { ok: true, ent, status: null };
  });

  if (!result.ok) return { ok: false, httpStatus: result.httpStatus, status: result.status };
  const teamSize = await countClinicTeamSize(db, clinicId);
  return { ok: true, status: buildClinicPublicStatus(result.ent, teamSize) };
}

async function activateClinicSubscription(db, clinicId, tier) {
  const tierKey = String(tier || "").trim();
  if (!TIERS[tierKey] || tierKey === "free") {
    throw Object.assign(new Error("Plan de clínica no válido"), { status: 400 });
  }
  const ref = db.collection("clinicosdoc_clinics").doc(clinicId);
  const snap = await ref.get();
  const prev = snap.exists ? readClinicEntitlement(snap.data() || {}) : defaultClinicEntitlement();
  const start = nowIso();
  const full = {
    ...prev,
    plan: "subscribed",
    tier: tierKey,
    periodStartAt: start,
    periodEndAt: addMs(start, PERIOD_MS),
    periodAiUses: 0,
    periodAiQuota: CLINIC_AI_QUOTA,
    updatedAt: start,
  };
  await ref.set({ clinicEntitlement: full, updatedAt: start }, { merge: true });
  const teamSize = await countClinicTeamSize(db, clinicId);
  return buildClinicPublicStatus(full, teamSize);
}

async function assertClinicSyncAllowed(db, clinicId) {
  const status = await getClinicStatus(db, clinicId);
  if (!status.syncActive) {
    throw Object.assign(
      new Error(status.message || "Suscripción del centro inactiva. No se pueden sincronizar informes."),
      { status: 402, code: status.code || "CLINIC_PAYWALL" },
    );
  }
  return status;
}

module.exports = {
  MAX_CLINIC_DEVICES,
  CLINIC_AI_QUOTA,
  TIERS,
  defaultClinicEntitlement,
  readClinicEntitlement,
  buildClinicPublicStatus,
  tierForTeamSize,
  isClinicSyncActive,
  canAddTeamMember,
  countClinicTeamSize,
  initClinicEntitlementOnRegister,
  touchClinicDeviceOnLogin,
  getClinicStatus,
  consumeClinicAiUse,
  activateClinicSubscription,
  assertClinicSyncAllowed,
};
