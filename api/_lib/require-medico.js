const { normalizeCedula } = require("./pin");

/**
 * Auth de médico con auto-reparación de claims.
 * Sesiones antiguas perdían role/cedula tras getIdToken(true); aquí se
 * restauran desde clinicosdoc_user y se persisten en Auth.
 */
async function requireMedicoAuth(req, admin) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw Object.assign(new Error("Sesión de médico requerida. Vuelva a iniciar sesión."), {
      status: 401,
    });
  }
  const decoded = await admin.auth().verifyIdToken(match[1]);
  const uid = decoded.uid;
  let role = decoded.role;
  let cedula = normalizeCedula(decoded.cedula || "");

  if (role !== "medico") {
    const db = admin.firestore();
    const userSnap = await db.collection("clinicosdoc_user").doc(uid).get();
    if (!userSnap.exists) {
      throw Object.assign(new Error("Solo un médico puede realizar esta acción"), { status: 403 });
    }
    const data = userSnap.data() || {};
    cedula = normalizeCedula(data.cedulaNormalizada || data.cedula || cedula);
    role = "medico";
    // Reparar claims para próximos tokens (sin bloquear esta request)
    admin
      .auth()
      .setCustomUserClaims(uid, { role: "medico", cedula: cedula || undefined })
      .catch((err) => console.warn("heal medico claims", err?.message || err));
  } else if (!cedula || cedula.length < 7) {
    const db = admin.firestore();
    const userSnap = await db.collection("clinicosdoc_user").doc(uid).get();
    if (userSnap.exists) {
      const data = userSnap.data() || {};
      cedula = normalizeCedula(data.cedulaNormalizada || data.cedula || "");
      if (cedula.length >= 7) {
        admin
          .auth()
          .setCustomUserClaims(uid, { role: "medico", cedula })
          .catch((err) => console.warn("heal medico cedula claim", err?.message || err));
      }
    }
  }

  return {
    admin,
    uid,
    decoded: { ...decoded, role: "medico", cedula: cedula || decoded.cedula },
  };
}

module.exports = { requireMedicoAuth };
