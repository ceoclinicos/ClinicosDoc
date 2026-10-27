// Despachador de endpoints de clínica: una sola función serverless.
const handlers = {
  "clinic-accept-invite": require("./_lib/endpoints/clinic-accept-invite"),
  "clinic-document-push": require("./_lib/endpoints/clinic-document-push"),
  "clinic-invite": require("./_lib/endpoints/clinic-invite"),
  "clinic-leave": require("./_lib/endpoints/clinic-leave"),
  "clinic-memberships": require("./_lib/endpoints/clinic-memberships"),
  "clinic-subscription-activate": require("./_lib/endpoints/clinic-subscription-activate"),
  "clinic-subscription-status": require("./_lib/endpoints/clinic-subscription-status"),
  "clinic-team": require("./_lib/endpoints/clinic-team"),
  "clinic-templates": require("./_lib/endpoints/clinic-templates"),
};

module.exports = async (req, res) => {
  const name = (req.url || "").split("?")[0].split("/").pop();
  const handler = handlers[name];
  if (!handler) return res.status(404).json({ error: "Ruta no encontrada" });
  return handler(req, res);
};
