const { getAdmin } = require("./_lib/firebase");
const { applyCors } = require("./_lib/cors");
const { apiError } = require("./_lib/errors");
const { requireAppAuth } = require("./_lib/require-app-auth");
const { activateSubscription } = require("./_lib/entitlements");

/**
 * Activa 30 días de suscripción.
 * Temporal hasta integrar pasarela de pago (Play Billing / Stripe).
 * Desactivar en producción con ALLOW_MANUAL_SUBSCRIBE=0.
 */
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
    if (auth.role !== "medico") {
      return res.status(403).json({ error: "Solo médicos pueden suscribirse" });
    }
    const status = await activateSubscription(getAdmin().firestore(), auth.uid);
    return res.status(200).json({
      ok: true,
      message: "Suscripción activada por 30 días (1000 procesamientos IA).",
      entitlement: status,
    });
  } catch (err) {
    const status = err?.status || 500;
    if (status < 500) {
      return res.status(status).json({ error: err.message || "No autorizado" });
    }
    console.error("subscription-activate", err);
    return apiError(res, 500, "No se pudo activar", err?.message || String(err), "SUB_ACTIVATE");
  }
};
