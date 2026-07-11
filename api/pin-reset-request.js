const crypto = require("crypto");
const { getAdmin } = require("./_lib/firebase");
const { normalizeCedula } = require("./_lib/pin");
const { applyCors } = require("./_lib/cors");
const { sendPinResetEmail } = require("./_lib/resend");
const { parseBody } = require("./_lib/body");
const { apiError } = require("./_lib/errors");

const OK_MSG = {
  message: "Si hay un correo registrado, recibirá un enlace en unos minutos.",
};

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const body = parseBody(req);
  const cedula = normalizeCedula(body.cedula || "");
  if (!cedula) return res.status(400).json({ error: "Cédula requerida" });

  try {
    const db = getAdmin().firestore();
    const snap = await db.collection("pacientes").doc(cedula).get();

    if (!snap.exists) return res.status(200).json(OK_MSG);

    const p = snap.data();
    const email = String(p.correo || "").trim();
    if (!email) return res.status(200).json(OK_MSG);

    const token = crypto.randomUUID();
    const now = Date.now();
    await db
      .collection("pin_reset_tokens")
      .doc(token)
      .set({
        token,
        cedula,
        expiresAt: now + 60 * 60 * 1000,
        used: false,
        createdAt: new Date().toISOString(),
      });

    const site = (process.env.SITE_URL || "https://clinicosdoc.com").replace(/\/$/, "");
    const link = `${site}/#/restablecer-pin?token=${encodeURIComponent(token)}`;

    await sendPinResetEmail(email, p.nombre, link);
    return res.status(200).json(OK_MSG);
  } catch (err) {
    console.error("pin-reset-request", err);
    const detail = err?.message || String(err);
    let code = "PIN_RESET_FAILED";
    if (detail.includes("FIREBASE_SERVICE_ACCOUNT")) code = "FIREBASE_CONFIG";
    else if (detail.includes("RESEND_API_KEY")) code = "RESEND_CONFIG";
    else if (detail.includes("Resend HTTP")) code = "RESEND_SEND";
    return apiError(
      res,
      500,
      "No se pudo enviar el correo de recuperación",
      detail,
      code,
    );
  }
};
