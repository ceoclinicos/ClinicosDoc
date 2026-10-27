const crypto = require("crypto");

function cedulaLookupKeys(input) {
  const raw = String(input).trim().toUpperCase().replace(/[\s.-]/g, "");
  if (!raw) return [];
  const keys = new Set([raw]);
  const digits = raw.replace(/\D/g, "");
  if (/^\d{6,9}$/.test(raw)) {
    keys.add("V" + raw);
    keys.add("E" + raw);
  }
  if (/^V\d{6,9}$/.test(raw)) keys.add(raw.slice(1));
  if (/^E\d{6,9}$/.test(raw)) keys.add(raw.slice(1));
  if (digits.length >= 6 && digits.length <= 9) {
    keys.add(digits);
    keys.add("V" + digits);
    keys.add("E" + digits);
  }
  return [...keys];
}

function normalizeCedula(input) {
  const raw = String(input).trim().toUpperCase().replace(/[\s.-]/g, "");
  if (/^[VE]\d{6,9}$/.test(raw)) return raw;
  if (/^\d{6,9}$/.test(raw)) return "V" + raw;
  const digits = raw.replace(/\D/g, "");
  if (/^[VE]/.test(raw) && digits.length >= 6) return raw[0] + digits;
  if (digits.length >= 6 && digits.length <= 9) return "V" + digits;
  return raw;
}

function hashPin(cedula, pin) {
  const data = `${normalizeCedula(cedula)}:${String(pin).toUpperCase()}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * PIN nuevo / registro / reset:
 * 6 dígitos (clásico) o una letra + 6 dígitos (formato nuevo).
 */
function assertPin6(pin) {
  if (!/^\d{6}$|^[A-Za-z]\d{6}$/.test(String(pin))) {
    throw new Error("El PIN debe ser 6 dígitos o una letra seguida de 6 dígitos");
  }
}

/** Login: acepta 4 o 6 dígitos (legado) o letra + 6 dígitos. */
function assertPinLogin(pin) {
  if (!/^\d{4}$|^\d{6}$|^[A-Za-z]\d{6}$/.test(String(pin))) {
    throw new Error("El PIN debe tener 4/6 dígitos o una letra + 6 dígitos");
  }
}

/** @deprecated Usar assertPin6; se mantiene el nombre por imports existentes. */
function assertPin4(pin) {
  assertPin6(pin);
}

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

/** Hash de contraseña app Android (DoctorAuthService). */
function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password).toUpperCase(), "utf8").digest("hex");
}

function assertPassword(password) {
  if (!/^\d{6}$|^[A-Za-z]\d{6}$/.test(String(password))) {
    throw new Error("La contraseña debe ser 6 dígitos o una letra + 6 dígitos");
  }
}

module.exports = {
  normalizeCedula,
  cedulaLookupKeys,
  hashPin,
  assertPin4,
  assertPin6,
  assertPinLogin,
  digitsOnly,
  hashPassword,
  assertPassword,
};
