const { getAdmin } = require("../firebase");
const { applyCors } = require("../cors");
const { apiError } = require("../errors");
const { requireAppAuth } = require("../require-app-auth");
const { getStatusForUser } = require("../entitlements");

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Solo GET" });

  try {
    const auth = await requireAppAuth(req, getAdmin());
    if (auth.role !== "medico") {
      return res.status(403).json({ error: "Solo médicos tienen plan de IA" });
    }
    const status = await getStatusForUser(getAdmin().firestore(), auth.uid);
    return res.status(200).json(status);
  } catch (err) {
    const status = err?.status || 500;
    if (status < 500) {
      return res.status(status).json({ error: err.message || "No autorizado" });
    }
    console.error("subscription-status", err);
    return apiError(res, 500, "No se pudo leer el plan", err?.message || String(err), "SUB_STATUS");
  }
};
