const { getAdmin } = require("./_lib/firebase");
const { hashPin, assertPin4 } = require("./_lib/pin");
const { applyCors } = require("./_lib/cors");

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const token = String(req.body?.token || "").trim();
  const pin = String(req.body?.pin || "");

  if (!token) return res.status(400).json({ error: "Token requerido" });

  try {
    assertPin4(pin);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  try {
    const db = getAdmin().firestore();
    const ref = db.collection("pin_reset_tokens").doc(token);
    const snap = await ref.get();

    if (!snap.exists) return res.status(400).json({ error: "Enlace inválido o expirado" });

    const data = snap.data();
    if (data.used) return res.status(400).json({ error: "Este enlace ya fue utilizado" });
    if (Date.now() > data.expiresAt) {
      return res.status(400).json({ error: "El enlace expiró. Solicite uno nuevo." });
    }

    const cedula = data.cedula;
    const pinHash = hashPin(cedula, pin);
    const now = new Date().toISOString();

    await db.collection("pacientes").doc(cedula).set({ pinHash, updatedAt: now }, { merge: true });
    await ref.set({ used: true, usedAt: now }, { merge: true });

    return res.status(200).json({ message: "PIN actualizado. Ya puede iniciar sesión." });
  } catch (err) {
    console.error("pin-reset-confirm", err);
    return res.status(500).json({ error: "No se pudo actualizar el PIN" });
  }
};
