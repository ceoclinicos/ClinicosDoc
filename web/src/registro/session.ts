import type { PacienteSession, ProfesionalSession } from "./models";
import { normalizeCedula } from "../services/cedula";

const PROF_KEY = "registro_profesional";
const PAC_KEY = "registro_paciente";
const ATENCION_CEDULA_KEY = "registro_atencion_cedula";

/** Dispositivo recordado 96 h desde el último inicio de sesión */
export const SESSION_TTL_MS = 96 * 60 * 60 * 1000;

interface PersistedSession<T> {
  data: T;
  expiresAt: number;
}

export async function hashPin(cedula: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${normalizeCedula(cedula)}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function persist<T>(key: string, data: T): void {
  const payload: PersistedSession<T> = {
    data,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* almacenamiento lleno o bloqueado */
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

function remove(key: string): void {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

function notifySessionChange(): void {
  window.dispatchEvent(new Event("sessionchange"));
}

export function isUserLoggedIn(): boolean {
  return getProfessionalSession() !== null || getPatientSession() !== null;
}

/** Cierra sesión de paciente y/o profesional en este dispositivo */
export function logoutAllSessions(): void {
  remove(PROF_KEY);
  remove(PAC_KEY);
  clearAtencionCedula();
  notifySessionChange();
}

export function getProfessionalSession(): ProfesionalSession | null {
  return restore<ProfesionalSession>(PROF_KEY);
}

export function setProfessionalSession(session: ProfesionalSession): void {
  persist(PROF_KEY, session);
  notifySessionChange();
}

export function clearProfessionalSession(): void {
  remove(PROF_KEY);
  notifySessionChange();
}

export function getPatientSession(): PacienteSession | null {
  return restore<PacienteSession>(PAC_KEY);
}

export function setPatientSession(session: PacienteSession): void {
  persist(PAC_KEY, session);
  notifySessionChange();
}

export function clearPatientSession(): void {
  remove(PAC_KEY);
  notifySessionChange();
}

export function setAtencionCedula(cedula: string): void {
  sessionStorage.setItem(ATENCION_CEDULA_KEY, cedula);
}

export function getAtencionCedula(): string | null {
  return sessionStorage.getItem(ATENCION_CEDULA_KEY);
}

export function clearAtencionCedula(): void {
  sessionStorage.removeItem(ATENCION_CEDULA_KEY);
}
