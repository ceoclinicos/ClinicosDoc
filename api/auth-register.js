const { getAdmin } = require("./_lib/firebase");
const {
  assertPin4,
  cedulaLookupKeys,
  hashPin,
  hashPassword,
  normalizeCedula,
} = require("./_lib/pin");
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

async function findAppMedico(db, inputCedula) {
  const keys = cedulaLookupKeys(inputCedula);
  const digits = String(inputCedula).replace(/\D/g, "");
  const candidates = [...new Set([...keys, digits, String(inputCedula).trim()].filter(Boolean))];
  for (const key of candidates) {
    const byNorm = await db
      .collection("clinicosdoc_user")
      .where("cedulaNormalizada", "==", key)
      .limit(1)
      .get();
    if (!byNorm.empty) return { snap: byNorm.docs[0], docId: byNorm.docs[0].id };
  }
  for (const key of candidates) {
    const byCed = await db.collection("clinicosdoc_user").where("cedula", "==", key).limit(1).get();
    if (!byCed.empty) return { snap: byCed.docs[0], docId: byCed.docs[0].id };
  }
  return null;
}

async function registerPaciente(db, admin, body) {
  assertPin4(String(body.pin || ""));
  const cedula = normalizeCedula(body.cedula);
  if (cedula.length < 7) throw Object.assign(new Error("Cédula inválida"), { status: 400 });
  const nombre = String(body.nombre || "").trim();
  if (!nombre) throw Object.assign(new Error("Nombre requerido"), { status: 400 });
  const correo = String(body.correo || "").trim();
  if (!correo.includes("@")) throw Object.assign(new Error("Correo electrónico requerido"), { status: 400 });

  for (const key of cedulaLookupKeys(cedula)) {
    const s = await db.collection("pacientes").doc(key).get();
    if (s.exists) {
      throw Object.assign(new Error("Ya existe un paciente con esa cédula"), { status: 409 });
    }
  }

  const pin = String(body.pin);
  const now = new Date().toISOString();
  const data = {
    cedula,
    nombre,
    edad: Number(body.edad) || 0,
    fechaNacimiento: String(body.fechaNacimiento || ""),
    sexo: String(body.sexo || "").trim(),
    telefono: String(body.telefono || "").trim(),
    correo,
    pinHash: hashPin(cedula, pin),
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("pacientes").doc(cedula).set(data);
  const token = await admin.auth().createCustomToken(cedula, { role: "paciente", cedula });
  return {
    token,
    uid: cedula,
    role: "paciente",
    cedula,
    nombre,
    correo,
  };
}

async function registerMedico(db, admin, body) {
  assertPin4(String(body.pin || ""));
  const cedula = normalizeCedula(body.cedula);
  if (cedula.length < 7) throw Object.assign(new Error("Cédula inválida"), { status: 400 });
  const nombre = String(body.nombre || "").trim();
  if (!nombre) throw Object.assign(new Error("Nombre requerido"), { status: 400 });
  const correo = String(body.correo || "").trim();
  if (!correo.includes("@")) throw Object.assign(new Error("Correo electrónico requerido"), { status: 400 });
  const sexo = String(body.sexo || "").trim();
  if (sexo !== "Masculino" && sexo !== "Femenino") {
    throw Object.assign(new Error("Seleccione el sexo"), { status: 400 });
  }
  const nacionalidad = body.nacionalidad === "Otros" ? "Otros" : "Venezuela";
  const especialidad = String(body.especialidad || "Médico general").trim() || "Médico general";
  const esMedicoGeneral = Boolean(body.esMedicoGeneral) || /general/i.test(especialidad);
  const mpps = nacionalidad === "Venezuela" ? String(body.mpps || "").replace(/\D/g, "") : "";
  if (nacionalidad === "Venezuela" && !mpps) {
    throw Object.assign(new Error("Código MPPS requerido"), { status: 400 });
  }

  for (const key of cedulaLookupKeys(cedula)) {
    const s = await db.collection("profesionales").doc(key).get();
    if (s.exists) {
      throw Object.assign(new Error("Ya existe un profesional con esa cédula"), { status: 409 });
    }
  }
  if (await findAppMedico(db, cedula)) {
    throw Object.assign(new Error("Esta cédula ya tiene cuenta en la app. Use Ingresar."), {
      status: 409,
    });
  }

  const pin = String(body.pin);
  const now = new Date().toISOString();
  const prof = {
    cedula,
    nombre,
    especialidad: esMedicoGeneral ? "Médico general" : especialidad,
    esMedicoGeneral,
    mpps,
    correo,
    pinHash: hashPin(cedula, pin),
    activo: true,
    createdAt: now,
    sexo,
    nacionalidad,
  };
  await db.collection("profesionales").doc(cedula).set(prof);

  const cloudRef = db.collection("clinicosdoc_user").doc();
  await cloudRef.set({
    nombre,
    cedula,
    cedulaNormalizada: cedula,
    mpps,
    especialidad: prof.especialidad,
    correo,
    passwordHash: hashPassword(pin),
    sexo,
    whatsapp: String(body.whatsapp || "").trim(),
    nacionalidad,
    mppsValidado: nacionalidad === "Venezuela" && Boolean(mpps),
    source: String(body.source || "web"),
    createdAt: now,
    updatedAt: now,
  });

  const token = await admin.auth().createCustomToken(cloudRef.id, {
    role: "medico",
    cedula,
  });
  return {
    token,
    uid: cloudRef.id,
    role: "medico",
    cedula,
    nombre,
    correo,
    especialidad: prof.especialidad,
    mpps,
    sexo,
    nacionalidad,
    cloudUserId: cloudRef.id,
    esMedicoGeneral,
  };
}

async function registerClinica(db, admin, body) {
  assertPin4(String(body.pin || ""));
  const rif = normalizeRif(body.rif || body.cedula);
  if (rif.length < 5) {
    throw Object.assign(new Error("Indique un RIF o código de centro válido"), { status: 400 });
  }
  const correo = String(body.correo || "").trim();
  if (!correo.includes("@")) {
    throw Object.assign(new Error("Correo electrónico requerido"), { status: 400 });
  }
  const nombre = String(body.nombre || "").trim();
  if (!nombre) throw Object.assign(new Error("Nombre del centro requerido"), { status: 400 });

  const id = makeClinicId(rif);
  const existing = await db.collection("clinicosdoc_clinics").doc(id).get();
  if (existing.exists) {
    throw Object.assign(new Error("Ya existe un centro registrado con ese RIF"), { status: 409 });
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

  const token = await admin.auth().createCustomToken(id, { role: "clinica", rif });
  return {
    token,
    uid: id,
    role: "clinica",
    clinicId: id,
    nombre,
    rif,
    correo,
    inviteCode,
  };
}

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const body = parseBody(req);
  const tipo = String(body.tipo || "").toLowerCase();

  try {
    const admin = getAdmin();
    const db = admin.firestore();
    let result;

    if (tipo === "paciente") {
      result = await registerPaciente(db, admin, body);
    } else if (
      tipo === "profesional" ||
      tipo === "medico" ||
      tipo === "medico-web" ||
      tipo === "app" ||
      tipo === "medico-app"
    ) {
      result = await registerMedico(db, admin, body);
    } else if (tipo === "clinica" || tipo === "centro" || tipo === "empresa") {
      result = await registerClinica(db, admin, body);
    } else {
      return res.status(400).json({ error: "Tipo de cuenta no válido" });
    }

    return res.status(200).json(result);
  } catch (err) {
    const status = err?.status || 500;
    if (status < 500) {
      return res.status(status).json({ error: err.message || "No se pudo registrar" });
    }
    console.error("auth-register", err);
    if (err?.message && /PIN|dígitos/i.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    return apiError(
      res,
      500,
      "No se pudo registrar",
      err?.message || String(err),
      "AUTH_REGISTER_FAILED",
    );
  }
};
