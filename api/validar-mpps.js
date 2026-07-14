const { applyCors } = require("./_lib/cors");
const { parseBody } = require("./_lib/body");
const { validarMppsCedula } = require("./_lib/mpps");

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const body = parseBody(req);
  const cedula = body.cedula || "";
  const mpps = body.mpps || "";

  try {
    const result = await validarMppsCedula(cedula, mpps);
    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        error: result.error,
        code: result.code,
      });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error("validar-mpps", err);
    return res.status(500).json({
      ok: false,
      error: "No se pudo validar el MPPS",
      detail: err?.message || String(err),
      code: "VALIDAR_FAILED",
    });
  }
};
