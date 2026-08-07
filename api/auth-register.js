const { getAdmin } = require("./_lib/firebase");
const { assertPin4, hashPin } = require("./_lib/pin");
const { applyCors } = require("./_lib/cors");
const { parseBody } = require("./_lib/body");
const { apiError } = require("./_lib/errors");

function normalizeRif(rif) {
  return String(rif || "")
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, "");
}

function makeClinicId(rif) {
  return `clinic_${normalizeRif(rif).toLowerCase()}`;
}

function makeInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const body = parseBody(req);
  const tipo = String(body.tipo || "").toLowerCase();

  if (tipo !== "clinica" && tipo !== "centro" && tipo !== "empresa") {
    return res.status(400).json({ error: "Por ahora solo registro de clínica vía API" });
  }

  try {
    assertPin4(String(body.pin || ""));
    const rif = normalizeRif(body.rif || body.cedula);
    if (rif.length < 5) {
      return res.status(400).json({ error: "Indique un RIF o código de centro válido" });
    }
    const correo = String(body.correo || "").trim();
    if (!correo.includes("@")) {
      return res.status(400).json({ error: "Correo electrónico requerido" });
    }
    const nombre = String(body.nombre || "").trim();
    if (!nombre) return res.status(400).json({ error: "Nombre del centro requerido" });

    const admin = getAdmin();
    const db = admin.firestore();
    const id = makeClinicId(rif);
    const existing = await db.collection("clinicosdoc_clinics").doc(id).get();
    if (existing.exists) {
      return res.status(409).json({ error: "Ya existe un centro registrado con ese RIF" });
    }

    let inviteCode = makeInviteCode();
    for (let i = 0; i < 5; i++) {
      const taken = await db.collection("clinicosdoc_clinic_invites").doc(inviteCode).get();
      if (!taken.exists) break;
      inviteCode = makeInviteCode();
    }

    const now = new Date().toISOString();
    const pin = String(body.pin);
    const data = {
      id,
      nombre,
      rif,
      correo,
      direccion: String(body.direccion || "").trim(),
      pinHash: hashPin(rif, pin),
      inviteCode,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("clinicosdoc_clinics").doc(id).set(data);
    await db.collection("clinicosdoc_clinic_invites").doc(inviteCode).set({
      clinicId: id,
      nombre,
      createdAt: now,
    });

    const token = await admin.auth().createCustomToken(id, {
      role: "clinica",
      rif,
    });

    return res.status(200).json({
      token,
      uid: id,
      role: "clinica",
      clinicId: id,
      nombre,
      rif,
      correo,
      inviteCode,
    });
  } catch (err) {
    console.error("auth-register", err);
    if (err?.message && /PIN|dígitos/i.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    return apiError(
      res,
      500,
      "No se pudo registrar el centro",
      err?.message || String(err),
      "AUTH_REGISTER_FAILED",
    );
  }
};
