const { normalizeCedula } = require("./pin");

/** "Jhon Noriega" → "jhon_noriega" */
function slugifyDoctorName(nombre) {
  return String(nombre || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

/**
 * ID legible de médico en Auth + clinicosdoc_user.
 * Ej: 23536843 + "Jhon Noriega" → "23536843_jhon_noriega"
 */
function makeDoctorUserId(cedula, nombre) {
  const digits = normalizeCedula(cedula).replace(/\D/g, "");
  const slug = slugifyDoctorName(nombre);
  if (!digits || digits.length < 6) {
    throw Object.assign(new Error("Cédula inválida para ID de médico"), { status: 400 });
  }
  if (!slug) {
    throw Object.assign(new Error("Nombre inválido para ID de médico"), { status: 400 });
  }
  return `${digits}_${slug}`;
}

module.exports = { slugifyDoctorName, makeDoctorUserId };
