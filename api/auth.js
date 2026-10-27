// Despachador de auth y PIN: una sola función serverless (límite 12 del plan Hobby).
const handlers = {
  "auth-login": require("./_lib/endpoints/auth-login"),
  "auth-register": require("./_lib/endpoints/auth-register"),
  "pin-change": require("./_lib/endpoints/pin-change"),
  "pin-reset-confirm": require("./_lib/endpoints/pin-reset-confirm"),
  "pin-reset-request": require("./_lib/endpoints/pin-reset-request"),
  "validar-mpps": require("./_lib/endpoints/validar-mpps"),
};

module.exports = async (req, res) => {
  const name = (req.url || "").split("?")[0].split("/").pop();
  const handler = handlers[name];
  if (!handler) return res.status(404).json({ error: "Ruta no encontrada" });
  return handler(req, res);
};
