/**
 * Persiste claims en Auth y emite custom token sin claims embebidas.
 * Así getIdToken(true) en app/web sigue trayendo role/cedula/rif.
 */
async function mintAuthToken(admin, uid, claims) {
  const auth = admin.auth();
  try {
    await auth.getUser(uid);
  } catch (err) {
    if (err?.code === "auth/user-not-found") {
      await auth.createUser({ uid });
    } else {
      throw err;
    }
  }
  await auth.setCustomUserClaims(uid, claims || {});
  return auth.createCustomToken(uid);
}

module.exports = { mintAuthToken };
