import type { PacienteSession, ProfesionalSession } from "./models";

const PROF_KEY = "registro_profesional";
const PAC_KEY = "registro_paciente";
const ATENCION_CEDULA_KEY = "registro_atencion_cedula";

export async function hashPin(cedula: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${cedula.trim().toUpperCase()}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getProfessionalSession(): ProfesionalSession | null {
  const raw = sessionStorage.getItem(PROF_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProfesionalSession;
  } catch {
    return null;
  }
}

export function setProfessionalSession(session: ProfesionalSession): void {
  sessionStorage.setItem(PROF_KEY, JSON.stringify(session));
}

export function clearProfessionalSession(): void {
  sessionStorage.removeItem(PROF_KEY);
}

export function getPatientSession(): PacienteSession | null {
  const raw = sessionStorage.getItem(PAC_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PacienteSession;
  } catch {
    return null;
  }
}

export function setPatientSession(session: PacienteSession): void {
  sessionStorage.setItem(PAC_KEY, JSON.stringify(session));
}

export function clearPatientSession(): void {
  sessionStorage.removeItem(PAC_KEY);
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
