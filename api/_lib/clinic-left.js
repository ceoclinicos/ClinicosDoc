/** Clínicas de las que el médico salió voluntariamente (no re-heal). */
function leftCol(db, uid) {
  return db.collection("clinicosdoc_user").doc(uid).collection("clinic_left");
}

async function markClinicLeft(db, uid, clinicId, clinicName = "") {
  if (!uid || !clinicId) return;
  await leftCol(db, uid)
    .doc(clinicId)
    .set(
      {
        clinicId,
        clinicName: String(clinicName || ""),
        leftAt: new Date().toISOString(),
      },
      { merge: true },
    );
}

async function clearClinicLeft(db, uid, clinicId) {
  if (!uid || !clinicId) return;
  await leftCol(db, uid).doc(clinicId).delete().catch(() => {});
}

async function loadLeftClinicIds(db, uid) {
  if (!uid) return new Set();
  const snap = await leftCol(db, uid).get();
  return new Set(snap.docs.map((d) => d.id));
}

async function isClinicLeft(db, uid, clinicId) {
  if (!uid || !clinicId) return false;
  const snap = await leftCol(db, uid).doc(clinicId).get();
  return snap.exists;
}

module.exports = {
  markClinicLeft,
  clearClinicLeft,
  loadLeftClinicIds,
  isClinicLeft,
};
