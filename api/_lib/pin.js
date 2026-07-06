const crypto = require("crypto");

function normalizeCedula(input) {
  return String(input).trim().toUpperCase().replace(/[\s.-]/g, "");
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

module.exports = { normalizeCedula, hashPin, assertPin4 };
