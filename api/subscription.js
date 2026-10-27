// Despachador de suscripción del médico: una sola función serverless.
const handlers = {
  "subscription-activate": require("./_lib/endpoints/subscription-activate"),
  "subscription-status": require("./_lib/endpoints/subscription-status"),
};

module.exports = async (req, res) => {
  const name = (req.url || "").split("?")[0].split("/").pop();
  const handler = handlers[name];
  if (!handler) return res.status(404).json({ error: "Ruta no encontrada" });
  return handler(req, res);
};
