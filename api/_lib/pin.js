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
  const data = `${normalizeCedula(cedula)}:${pin}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

function assertPin4(pin) {
  if (!/^\d{4}$/.test(String(pin))) {
    throw new Error("El PIN debe tener exactamente 4 dígitos");
  }
}

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

/** Hash de contraseña app Android (DoctorAuthService). */
function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password), "utf8").digest("hex");
}

function assertPassword(password) {
  if (String(password).length < 4) {
    throw new Error("La contraseña debe tener al menos 4 caracteres");
  }
}

module.exports = {
  normalizeCedula,
  cedulaLookupKeys,
  hashPin,
  assertPin4,
  digitsOnly,
  hashPassword,
  assertPassword,
};
