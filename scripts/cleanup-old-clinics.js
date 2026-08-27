/**
 * Borra clínicas antiguas y deja solo la más reciente.
 *
 * Uso (local, con la misma credencial de Vercel):
 *   set FIREBASE_SERVICE_ACCOUNT=<json en una línea>
 *   node scripts/cleanup-old-clinics.js              # solo lista (dry-run)
 *   node scripts/cleanup-old-clinics.js --confirm    # borra de verdad
 *
 * Conserva la clínica con createdAt más reciente (o la última por id si no hay fecha).
 */
const admin = require("firebase-admin");

function getDb() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error(
      "Falta FIREBASE_SERVICE_ACCOUNT. Cópiala de Vercel → Environment Variables (JSON en una línea).",
    );
    process.exit(1);
  }
  const cred = JSON.parse(raw);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
  return admin.firestore();
}

async function deleteCollection(colRef, batchSize = 200) {
  while (true) {
    const snap = await colRef.limit(batchSize).get();
    if (snap.empty) break;
    const batch = colRef.firestore.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function deleteClinicDeep(db, clinicId) {
  const ref = db.collection("clinicosdoc_clinics").doc(clinicId);
  const subs = ["templates", "headers", "members", "invitations", "documents"];
  for (const name of subs) {
    await deleteCollection(ref.collection(name));
  }
  await ref.delete();
}

function clinicSortKey(doc) {
  const data = doc.data() || {};
  const created = Date.parse(String(data.createdAt || data.updatedAt || "")) || 0;
  return { created, id: doc.id, nombre: String(data.nombre || doc.id) };
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const db = getDb();
  const snap = await db.collection("clinicosdoc_clinics").get();
  if (snap.empty) {
    console.log("No hay clínicas.");
    return;
  }

  const ranked = snap.docs
    .map(clinicSortKey)
    .sort((a, b) => b.created - a.created || b.id.localeCompare(a.id));

  const keep = ranked[0];
  const remove = ranked.slice(1);

  console.log(`Total clínicas: ${ranked.length}`);
  console.log(`CONSERVAR: ${keep.id} — ${keep.nombre} (createdAt ms=${keep.created})`);
  console.log(`BORRAR (${remove.length}):`);
  for (const c of remove) {
    console.log(`  - ${c.id} — ${c.nombre}`);
  }

  if (!confirm) {
    console.log("\nDry-run. Para borrar de verdad: node scripts/cleanup-old-clinics.js --confirm");
    return;
  }

  for (const c of remove) {
    process.stdout.write(`Borrando ${c.id}... `);
    await deleteClinicDeep(db, c.id);
    console.log("ok");
  }
  console.log("Listo. Quedó solo:", keep.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
