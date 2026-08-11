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
const { mintAuthToken } = require("./_lib/mint-token");

function normalizeRif(rif) {
  return String(rif || "")
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, "");
}

async function findPaciente(db, inputCedula) {
  for (const key of cedulaLookupKeys(inputCedula)) {
    const s = await db.collection("pacientes").doc(key).get();
    if (s.exists) return { snap: s, docId: key };
  }
  return null;
}

async function findProfesional(db, inputCedula) {
  for (const key of cedulaLookupKeys(inputCedula)) {
    const s = await db.collection("profesionales").doc(key).get();
    if (s.exists) return { snap: s, docId: key };
  }
  return null;
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
    if (!byNorm.empty) {
      const doc = byNorm.docs[0];
      return { snap: doc, docId: doc.id };
    }
  }
  for (const key of candidates) {
    const byCed = await db.collection("clinicosdoc_user").where("cedula", "==", key).limit(1).get();
    if (!byCed.empty) {
      const doc = byCed.docs[0];
      return { snap: doc, docId: doc.id };
    }
  }
  return null;
}

async function findClinica(db, inputRif) {
  const raw = normalizeRif(inputRif);
  if (!raw || raw.length < 5) return null;
  const clinicId = `clinic_${raw.toLowerCase()}`;
  const s = await db.collection("clinicosdoc_clinics").doc(clinicId).get();
  if (!s.exists) return null;
  return { snap: s, docId: clinicId };
}

/**
 * Persiste role/cedula/rif en el usuario Auth. Sin esto, getIdToken(true)
 * en la app pierde las claims del custom token y el médico no lee invitaciones.
 */
async function mintToken(admin, uid, claims) {
  return mintAuthToken(admin, uid, claims);
}

async function loginPaciente(db, admin, cedula, pin) {
  assertPin4(pin);
  const found = await findPaciente(db, cedula);
  if (!found) throw Object.assign(new Error("Cédula o PIN incorrectos"), { status: 401 });
  const p = found.snap.data() || {};
  if (!p.pinHash) throw Object.assign(new Error("Debe completar su registro con PIN"), { status: 400 });
  const expected = hashPin(p.cedula || found.docId, pin);
  if (p.pinHash !== expected) {
    throw Object.assign(new Error("Cédula o PIN incorrectos"), { status: 401 });
  }
  const uid = found.docId;
  const token = await mintToken(admin, uid, {
    role: "paciente",
    cedula: String(p.cedula || found.docId),
  });
  return {
    token,
    uid,
    role: "paciente",
    cedula: String(p.cedula || found.docId),
    nombre: String(p.nombre || ""),
    correo: String(p.correo || ""),
  };
}

async function ensureCloudUserFromProfesional(db, profSnap, profDocId, pin) {
  const p = profSnap.data() || {};
  const cedNorm = normalizeCedula(p.cedula || profDocId);
  let cloud = await findAppMedico(db, cedNorm);
  if (cloud) return cloud;

  const ref = db.collection("clinicosdoc_user").doc();
  const now = new Date().toISOString();
  await ref.set({
    nombre: String(p.nombre || "Médico"),
    cedula: String(p.cedula || cedNorm),
    cedulaNormalizada: cedNorm,
    mpps: String(p.mpps || ""),
    especialidad: String(p.especialidad || "Médico general"),
    correo: String(p.correo || ""),
    sexo: p.sexo ? String(p.sexo) : "",
    nacionalidad: String(p.nacionalidad || "Venezuela"),
    passwordHash: hashPassword(pin),
    createdAt: now,
    updatedAt: now,
    linkedFromProfesional: true,
  });
  const snap = await ref.get();
  return { snap, docId: ref.id };
}

async function loginMedico(db, admin, cedula, pin, prefer) {
  assertPin4(pin);
  const cedNorm = normalizeCedula(cedula);
  const appUser = await findAppMedico(db, cedNorm);
  const prof = await findProfesional(db, cedNorm);

  if (prefer === "profesional" || prefer === "medico-web") {
    if (!prof) throw Object.assign(new Error("Cédula o PIN incorrectos"), { status: 401 });
    const p = prof.snap.data() || {};
    if (p.activo === false) {
      throw Object.assign(new Error("Cuenta pendiente de activación"), { status: 403 });
    }
    const expected = hashPin(p.cedula || prof.docId, pin);
    if (p.pinHash !== expected) {
      throw Object.assign(new Error("Cédula o PIN incorrectos"), { status: 401 });
    }
    const cloud = await ensureCloudUserFromProfesional(db, prof.snap, prof.docId, pin);
    const c = cloud.snap.data() || {};
    const token = await mintToken(admin, cloud.docId, {
      role: "medico",
      cedula: cedNorm,
    });
    return {
      token,
      uid: cloud.docId,
      role: "medico",
      cedula: cedNorm,
      nombre: String(p.nombre || c.nombre || ""),
      correo: String(p.correo || c.correo || ""),
      especialidad: String(p.especialidad || c.especialidad || "Médico general"),
      mpps: String(p.mpps || c.mpps || ""),
      sexo: p.sexo ? String(p.sexo) : c.sexo ? String(c.sexo) : undefined,
      nacionalidad: String(p.nacionalidad || c.nacionalidad || "Venezuela"),
      cloudUserId: cloud.docId,
    };
  }

  // app / auto: prefer cloud passwordHash, else profesional pinHash
  if (appUser) {
    const c = appUser.snap.data() || {};
    if (!c.passwordHash || c.passwordHash !== hashPassword(pin)) {
      // fallback profesional
      if (prof) {
        const p = prof.snap.data() || {};
        const expected = hashPin(p.cedula || prof.docId, pin);
        if (p.pinHash === expected) {
          const token = await mintToken(admin, appUser.docId, { role: "medico", cedula: cedNorm });
          return {
            token,
            uid: appUser.docId,
            role: "medico",
            cedula: cedNorm,
            nombre: String(c.nombre || p.nombre || ""),
            correo: String(c.correo || p.correo || ""),
            especialidad: String(c.especialidad || p.especialidad || "Médico general"),
            mpps: String(c.mpps || p.mpps || ""),
            cloudUserId: appUser.docId,
          };
        }
      }
      throw Object.assign(new Error("Cédula o PIN incorrectos"), { status: 401 });
    }
    const token = await mintToken(admin, appUser.docId, { role: "medico", cedula: cedNorm });
    return {
      token,
      uid: appUser.docId,
      role: "medico",
      cedula: cedNorm,
      nombre: String(c.nombre || ""),
      correo: String(c.correo || c.email || ""),
      especialidad: String(c.especialidad || "Médico general"),
      mpps: String(c.mpps || ""),
      sexo: c.sexo ? String(c.sexo) : undefined,
      nacionalidad: String(c.nacionalidad || "Venezuela"),
      cloudUserId: appUser.docId,
    };
  }

  if (prof) {
    const p = prof.snap.data() || {};
    if (p.activo === false) {
      throw Object.assign(new Error("Cuenta pendiente de activación"), { status: 403 });
    }
    const expected = hashPin(p.cedula || prof.docId, pin);
    if (p.pinHash !== expected) {
      throw Object.assign(new Error("Cédula o PIN incorrectos"), { status: 401 });
    }
    const cloud = await ensureCloudUserFromProfesional(db, prof.snap, prof.docId, pin);
    const token = await mintToken(admin, cloud.docId, { role: "medico", cedula: cedNorm });
    return {
      token,
      uid: cloud.docId,
      role: "medico",
      cedula: cedNorm,
      nombre: String(p.nombre || ""),
      correo: String(p.correo || ""),
      especialidad: String(p.especialidad || "Médico general"),
      mpps: String(p.mpps || ""),
      cloudUserId: cloud.docId,
    };
  }

  throw Object.assign(new Error("Cédula o PIN incorrectos"), { status: 401 });
}

async function loginClinica(db, admin, rif, pin) {
  assertPin4(pin);
  const found = await findClinica(db, rif);
  if (!found) throw Object.assign(new Error("RIF o PIN incorrectos"), { status: 401 });
  const c = found.snap.data() || {};
  const expected = hashPin(c.rif || found.docId, pin);
  if (!c.pinHash || c.pinHash !== expected) {
    throw Object.assign(new Error("RIF o PIN incorrectos"), { status: 401 });
  }
  const token = await mintToken(admin, found.docId, {
    role: "clinica",
    rif: String(c.rif || ""),
  });
  return {
    token,
    uid: found.docId,
    role: "clinica",
    clinicId: found.docId,
    nombre: String(c.nombre || ""),
    rif: String(c.rif || ""),
    correo: String(c.correo || ""),
    inviteCode: String(c.inviteCode || ""),
  };
}

module.exports = async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const body = parseBody(req);
  const tipo = String(body.tipo || "auto").toLowerCase();
  const pin = String(body.pin || "");
  const cedula = String(body.cedula || body.rif || "").trim();

  if (!cedula) {
    return res.status(400).json({
      error: tipo === "clinica" || tipo === "centro" ? "RIF requerido" : "Cédula requerida",
    });
  }

  try {
    const admin = getAdmin();
    const db = admin.firestore();
    let result;

    if (tipo === "paciente") {
      result = await loginPaciente(db, admin, cedula, pin);
    } else if (tipo === "clinica" || tipo === "centro" || tipo === "empresa") {
      result = await loginClinica(db, admin, cedula, pin);
    } else if (
      tipo === "profesional" ||
      tipo === "medico-web" ||
      tipo === "app" ||
      tipo === "medico-app" ||
      tipo === "medico" ||
      tipo === "auto"
    ) {
      const prefer =
        tipo === "profesional" || tipo === "medico-web" ? "profesional" : tipo === "app" ? "app" : "auto";
      result = await loginMedico(db, admin, cedula, pin, prefer);
    } else {
      return res.status(400).json({ error: "Tipo de cuenta no válido" });
    }

    return res.status(200).json(result);
  } catch (err) {
    const status = err?.status || 500;
    if (status < 500) {
      return res.status(status).json({ error: err.message || "No se pudo iniciar sesión" });
    }
    console.error("auth-login", err);
    return apiError(
      res,
      500,
      "No se pudo iniciar sesión",
      err?.message || String(err),
      "AUTH_LOGIN_FAILED",
    );
  }
};
