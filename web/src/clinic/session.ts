import type { ClinicSession } from "./models";

const CLINIC_KEY = "registro_clinica";

/** Dispositivo recordado 96 h desde el último inicio de sesión */
export const CLINIC_SESSION_TTL_MS = 96 * 60 * 60 * 1000;

interface PersistedSession<T> {
  data: T;
  expiresAt: number;
}

function persist<T>(key: string, data: T): void {
  const payload: PersistedSession<T> = {
    data,
    expiresAt: Date.now() + CLINIC_SESSION_TTL_MS,
  };
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function restore<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw) as PersistedSession<T>;
    if (!payload?.data || typeof payload.expiresAt !== "number") {
      localStorage.removeItem(key);
      return null;
    }
    if (Date.now() > payload.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return payload.data;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function notifySessionChange(): void {
  window.dispatchEvent(new Event("sessionchange"));
}

export function getClinicSession(): ClinicSession | null {
  return restore<ClinicSession>(CLINIC_KEY);
}

export function setClinicSession(session: ClinicSession): void {
  persist(CLINIC_KEY, session);
  notifySessionChange();
}

export function clearClinicSession(): void {
  localStorage.removeItem(CLINIC_KEY);
  notifySessionChange();
}
