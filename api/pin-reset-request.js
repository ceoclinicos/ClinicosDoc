const crypto = require("crypto");
const { getAdmin } = require("./_lib/firebase");
const { cedulaLookupKeys } = require("./_lib/pin");
const { applyCors } = require("./_lib/cors");
const { sendPinResetEmail } = require("./_lib/resend");
const { parseBody } = require("./_lib/body");
const { apiError } = require("./_lib/errors");

const OK_MSG = {
  message: "Si hay un correo registrado, recibirá un enlace en unos minutos.",
};

function pickEmail(data) {
  return String(data.correo || data.email || "").trim();
}

async function findPaciente(db, inputCedula) {
  for (const key of cedulaLookupKeys(inputCedula)) {
    const s = await db.collection("pacientes").doc(key).get();
    if (s.exists) {
      return { snap: s, docId: key, collection: "pacientes", secretKind: "pin", accountKind: "paciente" };
    }
  }
  return null;
}

async function findProfesional(db, inputCedula) {
  for (const key of cedulaLookupKeys(inputCedula)) {
    const s = await db.collection("profesionales").doc(key).get();
    if (s.exists) {
      return { snap: s, docId: key, collection: "profesionales", secretKind: "pin", accountKind: "profesional" };
    }
  }
  return null;
}

async function findAppMedico(db, inputCedula) {
  const keys = cedulaLookupKeys(inputCedula);
  const digits = String(inputCedula).replace(/\D/g, "");
  const candidates = [...new Set([...keys, digits].filter(Boolean))];

  for (const key of candidates) {
    const byNorm = await db
      .collection("clinicosdoc_user")
      .where("cedulaNormalizada", "==", key)
      .limit(1)
      .get();
    if (!byNorm.empty) {
      const doc = byNorm.docs[0];
      return {
        snap: doc,
        docId: doc.id,
        collection: "clinicosdoc_user",
        secretKind: "password",
        accountKind: "app",
      };
    }
  }
  for (const key of candidates) {
    const byCed = await db.collection("clinicosdoc_user").where("cedula", "==", key).limit(1).get();
    if (!byCed.empty) {
      const doc = byCed.docs[0];
      return {
        snap: doc,
        docId: doc.id,
        collection: "clinicosdoc_user",
        secretKind: "password",
        accountKind: "app",
      };
    }
  }
  // También cédula tal cual en el perfil (ej. V-123)
  const raw = String(inputCedula).trim();
  if (raw) {
    const byRaw = await db.collection("clinicosdoc_user").where("cedula", "==", raw).limit(1).get();
    if (!byRaw.empty) {
      const doc = byRaw.docs[0];
      return {
        snap: doc,
        docId: doc.id,
        collection: "clinicosdoc_user",
        secretKind: "password",
        accountKind: "app",
      };
    }
  }
  return null;
}

async function findAccount(db, inputCedula, tipo) {
  const t = String(tipo || "auto").toLowerCase();
  if (t === "paciente") return findPaciente(db, inputCedula);
  if (t === "profesional" || t === "medico-web") return findProfesional(db, inputCedula);
  if (t === "app" || t === "medico-app") return findAppMedico(db, inputCedula);
  if (t === "medico") {
    return (
      (await findProfesional(db, inputCedula)) ||
      (await findAppMedico(db, inputCedula))
    );
  }
  // auto: paciente → profesional → app
  return (
    (await findPaciente(db, inputCedula)) ||
    (await findProfesional(db, inputCedula)) ||
    (await findAppMedico(db, inputCedula))
  );
}

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const body = parseBody(req);
  const inputCedula = String(body.cedula || "").trim();
  const tipo = String(body.tipo || "auto").trim();
  if (!inputCedula) return res.status(400).json({ error: "Cédula requerida" });

  try {
    const db = getAdmin().firestore();
    const found = await findAccount(db, inputCedula, tipo);
    if (!found) return res.status(200).json(OK_MSG);

    const p = found.snap.data();
    const email = pickEmail(p);
    if (!email) return res.status(200).json(OK_MSG);

    const cedula = String(p.cedula || found.docId);
    const token = crypto.randomUUID();
    const now = Date.now();
    await db
      .collection("pin_reset_tokens")
      .doc(token)
      .set({
        token,
        cedula,
        docId: found.docId,
        collection: found.collection,
        accountKind: found.accountKind,
        secretKind: found.secretKind,
        expiresAt: now + 60 * 60 * 1000,
        used: false,
        createdAt: new Date().toISOString(),
      });

    const site = (process.env.SITE_URL || "https://clinicosdoc.com").replace(/\/$/, "");
    const link = `${site}/#/restablecer-pin?token=${encodeURIComponent(token)}&modo=${found.secretKind}`;

    await sendPinResetEmail(email, p.nombre, link, found.secretKind);
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
