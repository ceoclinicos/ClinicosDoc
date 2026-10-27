const { getAdmin } = require("../firebase");
const { applyCors } = require("../cors");
const { parseBody } = require("../body");
const { apiError } = require("../errors");
const { requireAppAuth } = require("../require-app-auth");
const { activateClinicSubscription, TIERS } = require("../clinic-entitlements");

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  if (String(process.env.ALLOW_MANUAL_SUBSCRIBE || "1") === "0") {
    return res.status(503).json({
      error: "El pago en línea estará disponible pronto. Contacte soporte para activar su plan.",
      code: "PAYMENT_PENDING",
    });
  }

  try {
    const auth = await requireAppAuth(req, getAdmin());
    if (auth.role !== "clinica") {
      return res.status(403).json({ error: "Solo cuentas de centro pueden suscribirse" });
    }
    const body = parseBody(req);
    const tier = String(body.tier || "tier_10").trim();
    const status = await activateClinicSubscription(getAdmin().firestore(), auth.uid, tier);
    const label = TIERS[tier]?.label || tier;
    return res.status(200).json({
      ok: true,
      message: `Suscripción activada por 30 días (${label}).`,
      entitlement: status,
    });
  } catch (err) {
    const status = err?.status || 500;
    if (status < 500) {
      return res.status(status).json({ error: err.message || "No autorizado" });
    }
    console.error("clinic-subscription-activate", err);
    return apiError(
      res,
      500,
      "No se pudo activar la suscripción",
      err?.message || String(err),
      "CLINIC_SUB_ACTIVATE",
    );
  }
};
