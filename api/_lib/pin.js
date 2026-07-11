const crypto = require("crypto");

function cedulaLookupKeys(input) {
  const raw = String(input).trim().toUpperCase().replace(/[\s.-]/g, "");
  if (!raw) return [];
  const keys = new Set([raw]);
  if (/^\d{6,9}$/.test(raw)) keys.add("V" + raw);
  if (/^V\d{6,9}$/.test(raw)) keys.add(raw.slice(1));
  return [...keys];
}

function normalizeCedula(input) {
  const raw = String(input).trim().toUpperCase().replace(/[\s.-]/g, "");
  if (/^\d{6,9}$/.test(raw)) return "V" + raw;
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

module.exports = { normalizeCedula, cedulaLookupKeys, hashPin, assertPin4 };
