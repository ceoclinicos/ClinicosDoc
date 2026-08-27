const {
  deviceAlreadyUsedTrial,
  bindDeviceToUser,
  normalizeDeviceId,
} = require("./device-fingerprint");

/** Trial: 10 días o 20 usos de IA (lo que ocurra primero). */
const TRIAL_DAYS = 10;
const TRIAL_AI_LIMIT = 20;
/** Cupo mensual de suscripción. */
const MONTHLY_AI_QUOTA = 1000;
/** Alerta cuando quedan estos usos en el periodo. */
const ALERT_REMAINING = 100;
/** Si usó ≤ esto en el mes, 1 mes de cortesía (una vez). */
const LOW_USAGE_THRESHOLD = 50;
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function daysBetween(fromIso, toDate = new Date()) {
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from)) return 0;
  return Math.floor((toDate.getTime() - from) / (24 * 60 * 60 * 1000));
}

function addMs(iso, ms) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return nowIso();
  return new Date(t + ms).toISOString();
}

function defaultEntitlement({ trialGranted = true } = {}) {
  const started = nowIso();
  return {
    trialStartedAt: started,
    trialAiUses: 0,
    trialGranted: Boolean(trialGranted),
    plan: trialGranted ? "trial" : "blocked_trial",
    periodStartAt: null,
    periodEndAt: null,
    periodAiUses: 0,
    periodQuota: MONTHLY_AI_QUOTA,
    courtesyUsed: false,
    deviceFingerprints: [],
    updatedAt: started,
  };
}

function readEntitlement(userData) {
  const e = userData?.entitlement;
  if (!e || typeof e !== "object") {
    const started = userData?.createdAt || nowIso();
    return {
      ...defaultEntitlement({ trialGranted: true }),
      trialStartedAt: started,
    };
  }
  return {
    ...defaultEntitlement({ trialGranted: e.trialGranted !== false }),
    ...e,
    trialAiUses: Number(e.trialAiUses) || 0,
    periodAiUses: Number(e.periodAiUses) || 0,
    periodQuota: Number(e.periodQuota) || MONTHLY_AI_QUOTA,
    courtesyUsed: Boolean(e.courtesyUsed),
    trialGranted: e.trialGranted !== false,
    deviceFingerprints: Array.isArray(e.deviceFingerprints) ? e.deviceFingerprints : [],
  };
}

function rollPeriodIfNeeded(ent) {
  if (ent.plan !== "subscribed" && ent.plan !== "courtesy") return ent;
  if (!ent.periodEndAt) return ent;
  const end = Date.parse(ent.periodEndAt);
  if (!Number.isFinite(end) || Date.now() < end) return ent;

  const used = Number(ent.periodAiUses) || 0;
  if (used <= LOW_USAGE_THRESHOLD && !ent.courtesyUsed) {
    const start = nowIso();
    return {
      ...ent,
      plan: "courtesy",
      courtesyUsed: true,
      periodStartAt: start,
      periodEndAt: addMs(start, PERIOD_MS),
      periodAiUses: 0,
      updatedAt: start,
    };
  }
  return {
    ...ent,
    plan: "expired",
    updatedAt: nowIso(),
  };
}

function trialStatus(ent) {
  if (!ent.trialGranted) {
    return {
      active: false,
      reason: "Este dispositivo ya usó la prueba gratis. Suscríbase para continuar.",
      daysLeft: 0,
      usesLeft: 0,
    };
  }
  const daysUsed = daysBetween(ent.trialStartedAt);
  const daysLeft = Math.max(0, TRIAL_DAYS - daysUsed);
  const usesLeft = Math.max(0, TRIAL_AI_LIMIT - (Number(ent.trialAiUses) || 0));
  if (daysLeft <= 0) {
    return {
      active: false,
      reason: "La prueba de 10 días terminó. Suscríbase para continuar.",
      daysLeft: 0,
      usesLeft,
    };
  }
  if (usesLeft <= 0) {
    return {
      active: false,
      reason: "Usó las 20 consultas gratis de prueba. Suscríbase para continuar.",
      daysLeft,
      usesLeft: 0,
    };
  }
  return { active: true, reason: "", daysLeft, usesLeft };
}

function subscriptionStatus(ent) {
  const rolled = rollPeriodIfNeeded(ent);
  if (rolled.plan === "subscribed" || rolled.plan === "courtesy") {
    const end = Date.parse(rolled.periodEndAt || "");
    if (Number.isFinite(end) && Date.now() < end) {
      const quota = Number(rolled.periodQuota) || MONTHLY_AI_QUOTA;
      const used = Number(rolled.periodAiUses) || 0;
      const remaining = Math.max(0, quota - used);
      return {
        ent: rolled,
        active: remaining > 0,
        remaining,
        used,
        quota,
        reason:
          remaining > 0
            ? ""
            : "Agotó el cupo mensual de procesamiento con IA.",
        warnLow: remaining > 0 && remaining <= ALERT_REMAINING,
      };
    }
  }
  return {
    ent:
      rolled.plan === "subscribed" || rolled.plan === "courtesy"
        ? { ...rolled, plan: "expired" }
        : rolled,
    active: false,
    remaining: 0,
    used: Number(rolled.periodAiUses) || 0,
    quota: Number(rolled.periodQuota) || MONTHLY_AI_QUOTA,
    reason: "Su suscripción no está activa. Suscríbase para usar la IA.",
    warnLow: false,
  };
}

function buildPublicStatus(ent) {
  const rolled = rollPeriodIfNeeded(ent);
  const trial = trialStatus(rolled);
  const sub = subscriptionStatus(rolled);
  const onSub = sub.ent.plan === "subscribed" || sub.ent.plan === "courtesy";
  const canUseAi = onSub ? sub.active : trial.active;

  let phase = rolled.plan;
  if (phase === "trial" && !trial.active) phase = "expired";

  return {
    canUseAi,
    plan: phase,
    trialGranted: Boolean(rolled.trialGranted),
    trial: {
      daysLeft: trial.daysLeft,
      usesLeft: trial.usesLeft,
      limitDays: TRIAL_DAYS,
      limitUses: TRIAL_AI_LIMIT,
    },
    period: {
      uses: sub.used,
      quota: sub.quota,
      remaining: sub.remaining,
      endAt: sub.ent.periodEndAt || null,
      warnLow: sub.warnLow,
    },
    courtesyUsed: Boolean(rolled.courtesyUsed),
    message: canUseAi
      ? sub.warnLow
        ? `Le quedan ${sub.remaining} procesamientos con IA en este periodo.`
        : !onSub && trial.active
          ? `Prueba: ${trial.daysLeft} día(s) o ${trial.usesLeft} consulta(s) restantes.`
          : ""
      : trial.reason || sub.reason,
    code: canUseAi ? "OK" : phase === "blocked_trial" ? "TRIAL_DEVICE" : "PAYWALL",
  };
}

async function initEntitlementOnRegister(db, userRef, { deviceId, userId }) {
  const normalized = normalizeDeviceId(deviceId);
  const already = normalized ? await deviceAlreadyUsedTrial(db, normalized) : false;
  const trialGranted = !already;
  const ent = defaultEntitlement({ trialGranted });
  if (normalized) {
    const { hash } = await bindDeviceToUser(db, {
      deviceId: normalized,
      userId,
      consumeTrial: trialGranted,
    });
    if (hash) ent.deviceFingerprints = [hash];
  }
  await userRef.set({ entitlement: ent, updatedAt: nowIso() }, { merge: true });
  return ent;
}

async function touchDeviceOnLogin(db, userRef, userData, { deviceId, userId }) {
  const normalized = normalizeDeviceId(deviceId);
  if (!normalized) {
    let ent = readEntitlement(userData);
    const rolled = rollPeriodIfNeeded(ent);
    if (rolled.plan !== ent.plan || rolled.periodStartAt !== ent.periodStartAt) {
      await userRef.set({ entitlement: rolled, updatedAt: nowIso() }, { merge: true });
    }
    return rolled;
  }
  let ent = readEntitlement(userData);
  ent = rollPeriodIfNeeded(ent);
  const { hash } = await bindDeviceToUser(db, {
    deviceId: normalized,
    userId,
    consumeTrial: false,
  });
  if (hash && !ent.deviceFingerprints.includes(hash)) {
    ent = {
      ...ent,
      deviceFingerprints: [...ent.deviceFingerprints, hash].slice(-5),
      updatedAt: nowIso(),
    };
  }
  await userRef.set({ entitlement: ent, updatedAt: nowIso() }, { merge: true });
  return ent;
}

async function consumeAiUse(db, userId) {
  const userRef = db.collection("clinicosdoc_user").doc(userId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) {
      return {
        ok: false,
        httpStatus: 403,
        status: {
          canUseAi: false,
          plan: "expired",
          message: "Perfil de médico no encontrado",
          code: "NO_PROFILE",
        },
      };
    }
    let ent = readEntitlement(snap.data() || {});
    ent = rollPeriodIfNeeded(ent);

    const onSub = ent.plan === "subscribed" || ent.plan === "courtesy";
    if (onSub) {
      const end = Date.parse(ent.periodEndAt || "");
      if (!Number.isFinite(end) || Date.now() >= end) {
        ent = { ...ent, plan: "expired", updatedAt: nowIso() };
        tx.set(userRef, { entitlement: ent, updatedAt: nowIso() }, { merge: true });
        return { ok: false, httpStatus: 402, status: buildPublicStatus(ent) };
      }
      const quota = Number(ent.periodQuota) || MONTHLY_AI_QUOTA;
      if ((Number(ent.periodAiUses) || 0) >= quota) {
        return { ok: false, httpStatus: 402, status: buildPublicStatus(ent) };
      }
      ent = {
        ...ent,
        periodAiUses: (Number(ent.periodAiUses) || 0) + 1,
        updatedAt: nowIso(),
      };
      tx.set(userRef, { entitlement: ent, updatedAt: nowIso() }, { merge: true });
      return { ok: true, status: buildPublicStatus(ent) };
    }

    const trial = trialStatus(ent);
    if (!trial.active) {
      if (ent.plan === "trial" || ent.plan === "blocked_trial") {
        ent = {
          ...ent,
          plan: ent.trialGranted ? "expired" : "blocked_trial",
          updatedAt: nowIso(),
        };
        tx.set(userRef, { entitlement: ent, updatedAt: nowIso() }, { merge: true });
      }
      return { ok: false, httpStatus: 402, status: buildPublicStatus(ent) };
    }

    ent = {
      ...ent,
      plan: "trial",
      trialAiUses: (Number(ent.trialAiUses) || 0) + 1,
      updatedAt: nowIso(),
    };
    tx.set(userRef, { entitlement: ent, updatedAt: nowIso() }, { merge: true });
    return { ok: true, status: buildPublicStatus(ent) };
  });
}

async function getStatusForUser(db, userId) {
  const userRef = db.collection("clinicosdoc_user").doc(userId);
  const snap = await userRef.get();
  if (!snap.exists) {
    return {
      canUseAi: false,
      plan: "expired",
      message: "Perfil no encontrado",
      code: "NO_PROFILE",
    };
  }
  let ent = readEntitlement(snap.data() || {});
  const rolled = rollPeriodIfNeeded(ent);
  if (
    rolled.plan !== ent.plan ||
    rolled.periodAiUses !== ent.periodAiUses ||
    rolled.periodEndAt !== ent.periodEndAt
  ) {
    await userRef.set({ entitlement: rolled, updatedAt: nowIso() }, { merge: true });
    ent = rolled;
  }
  return buildPublicStatus(ent);
}

async function activateSubscription(db, userId) {
  const userRef = db.collection("clinicosdoc_user").doc(userId);
  const snap = await userRef.get();
  const prev = snap.exists ? readEntitlement(snap.data() || {}) : defaultEntitlement();
  const start = nowIso();
  const full = {
    ...prev,
    plan: "subscribed",
    periodStartAt: start,
    periodEndAt: addMs(start, PERIOD_MS),
    periodAiUses: 0,
    periodQuota: MONTHLY_AI_QUOTA,
    updatedAt: start,
  };
  await userRef.set({ entitlement: full, updatedAt: start }, { merge: true });
  return buildPublicStatus(full);
}

module.exports = {
  TRIAL_DAYS,
  TRIAL_AI_LIMIT,
  MONTHLY_AI_QUOTA,
  ALERT_REMAINING,
  LOW_USAGE_THRESHOLD,
  defaultEntitlement,
  readEntitlement,
  buildPublicStatus,
  initEntitlementOnRegister,
  touchDeviceOnLogin,
  consumeAiUse,
  getStatusForUser,
  activateSubscription,
  normalizeDeviceId,
};
