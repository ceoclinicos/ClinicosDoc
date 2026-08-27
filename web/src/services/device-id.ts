/** Firma de instalación del navegador (antifraude trial). */
const KEY = "clinicos_device_id";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `web_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY)?.trim() || "";
    if (existing.length >= 8) return existing;
    const created = randomId();
    localStorage.setItem(KEY, created);
    return created;
  } catch {
    return randomId();
  }
}
