const { normalizeCedula } = require("./pin");

/**
 * Solo usuarios con sesión Firebase (médico o clínica) pueden usar APIs sensibles.
 */
async function requireAppAuth(req, admin) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw Object.assign(new Error("Sesión requerida. Inicie sesión en la app o la web."), {
      status: 401,
    });
  }

  const decoded = await admin.auth().verifyIdToken(match[1]);
  const uid = decoded.uid;
  const role = decoded.role;

  if (role === "clinica") {
    return { admin, uid, decoded, role: "clinica" };
  }

  if (role === "medico") {
    let cedula = normalizeCedula(decoded.cedula || "");
    if (!cedula || cedula.length < 7) {
      const db = admin.firestore();
      const userSnap = await db.collection("clinicosdoc_user").doc(uid).get();
      if (userSnap.exists) {
        const data = userSnap.data() || {};
        cedula = normalizeCedula(data.cedulaNormalizada || data.cedula || "");
      }
    }
    return {
      admin,
      uid,
      decoded: { ...decoded, role: "medico", cedula: cedula || decoded.cedula },
      role: "medico",
    };
  }

  // Cuenta app sin claim role: solo si existe perfil médico en Firestore
  const db = admin.firestore();
  const userSnap = await db.collection("clinicosdoc_user").doc(uid).get();
  if (userSnap.exists) {
    const data = userSnap.data() || {};
    const cedula = normalizeCedula(data.cedulaNormalizada || data.cedula || "");
    admin
      .auth()
      .setCustomUserClaims(uid, { role: "medico", cedula: cedula || undefined })
      .catch((err) => console.warn("heal medico claims (chat)", err?.message || err));
    return {
      admin,
      uid,
      decoded: { ...decoded, role: "medico", cedula },
      role: "medico",
    };
  }

  throw Object.assign(new Error("Solo un médico o centro de salud puede usar la IA"), {
    status: 403,
  });
}

module.exports = { requireAppAuth };
