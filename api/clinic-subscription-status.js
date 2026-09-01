const { getAdmin } = require("./_lib/firebase");
const { applyCors } = require("./_lib/cors");
const { apiError } = require("./_lib/errors");
const { requireAppAuth } = require("./_lib/require-app-auth");
const { getClinicStatus } = require("./_lib/clinic-entitlements");

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Solo GET" });

  try {
    const auth = await requireAppAuth(req, getAdmin());
    if (auth.role !== "clinica") {
      return res.status(403).json({ error: "Solo cuentas de centro tienen plan institucional" });
    }
    const status = await getClinicStatus(getAdmin().firestore(), auth.uid);
    return res.status(200).json(status);
  } catch (err) {
    const status = err?.status || 500;
    if (status < 500) {
      return res.status(status).json({ error: err.message || "No autorizado" });
    }
    console.error("clinic-subscription-status", err);
    return apiError(
      res,
      500,
      "No se pudo leer el plan del centro",
      err?.message || String(err),
      "CLINIC_SUB_STATUS",
    );
  }
};
