const admin = require("firebase-admin");

function getAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT no configurada en Vercel");
    let cred;
    try {
      cred = JSON.parse(raw);
    } catch (e) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT JSON inválido: ${e.message}. Pegue el JSON completo en una sola línea en Vercel.`,
      );
    }
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
  return admin;
}

module.exports = { getAdmin };
