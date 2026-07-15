/** Ficha médica de emergencia — pública vía QR.
 * Usa `pacientes/{cedula}` (ya permitido en reglas) + copia pública en `users/emg_{publicId}`.
 */
import {
  doc,
  getDoc,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "../registro/firebase";
import { cedulaLookupKeys, normalizeCedula } from "./cedula";
import { RegistroPaths } from "../registro/models";

export type EmergencyContact = {
  nombre: string;
  telefono: string;
  parentesco: string;
};

export type FichaEmergencia = {
  publicId: string;
  patientCedula: string;
  nombre: string;
  tipoSangre: string;
  alergias: string;
  condiciones: string;
  medicamentos: string;
  contactos: EmergencyContact[];
  updatedAt: string;
  activo: boolean;
};

export const TIPOS_SANGRE = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-", "Desconocido"] as const;

function randomPublicId(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let id = "";
  const arr = crypto.getRandomValues(new Uint8Array(10));
  for (const b of arr) id += alphabet[b % alphabet.length];
  return id;
}

function publicDocId(publicId: string): string {
  return `emg_${publicId}`;
}

function asFicha(raw: unknown): FichaEmergencia | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<FichaEmergencia>;
  if (!d.publicId || d.activo === false) return null;
  return {
    publicId: String(d.publicId),
    patientCedula: String(d.patientCedula ?? ""),
    nombre: String(d.nombre ?? ""),
    tipoSangre: String(d.tipoSangre ?? "Desconocido"),
    alergias: String(d.alergias ?? ""),
    condiciones: String(d.condiciones ?? ""),
    medicamentos: String(d.medicamentos ?? ""),
    contactos: Array.isArray(d.contactos) ? (d.contactos as EmergencyContact[]) : [],
    updatedAt: String(d.updatedAt ?? ""),
    activo: true,
  };
}

export async function getFichaByCedula(cedula: string): Promise<FichaEmergencia | null> {
  const db = getDb();
  for (const key of cedulaLookupKeys(cedula)) {
    const snap = await getDoc(doc(db, RegistroPaths.PACIENTES, key));
    if (!snap.exists()) continue;
    const ficha = asFicha(snap.data()?.fichaEmergencia);
    if (ficha) return ficha;
  }
  return null;
}

export async function getFichaByPublicId(publicId: string): Promise<FichaEmergencia | null> {
  const snap = await getDoc(doc(getDb(), "users", publicDocId(publicId)));
  if (!snap.exists()) return null;
  return asFicha(snap.data()?.fichaEmergencia ?? snap.data());
}

export async function upsertFichaEmergencia(input: {
  patientCedula: string;
  nombre: string;
  tipoSangre: string;
  alergias: string;
  condiciones: string;
  medicamentos: string;
  contactos: EmergencyContact[];
  existingPublicId?: string;
}): Promise<FichaEmergencia> {
  const cedula = normalizeCedula(input.patientCedula);
  let publicId = input.existingPublicId?.trim();
  if (!publicId) {
    const existing = await getFichaByCedula(cedula);
    publicId = existing?.publicId || randomPublicId();
  }

  const data: FichaEmergencia = {
    publicId,
    patientCedula: cedula,
    nombre: input.nombre.trim(),
    tipoSangre: input.tipoSangre.trim() || "Desconocido",
    alergias: input.alergias.trim() || "Ninguna referida",
    condiciones: input.condiciones.trim() || "Ninguna referida",
    medicamentos: input.medicamentos.trim() || "Ninguno referido",
    contactos: input.contactos
      .filter((c) => c.nombre.trim() && c.telefono.trim())
      .map((c) => ({
        nombre: c.nombre.trim(),
        telefono: c.telefono.trim(),
        parentesco: c.parentesco.trim() || "Contacto",
      })),
    updatedAt: new Date().toISOString(),
    activo: true,
  };

  const db = getDb();
  // Guardar en ficha del paciente (reglas abiertas en producción)
  const pacienteRef = doc(db, RegistroPaths.PACIENTES, cedula);
  const pacienteSnap = await getDoc(pacienteRef);
  if (pacienteSnap.exists()) {
    await setDoc(pacienteRef, { fichaEmergencia: data, updatedAt: data.updatedAt } as DocumentData, {
      merge: true,
    });
  } else {
    // Crear stub mínimo si aún no hay doc de paciente (solo login local raro)
    await setDoc(
      pacienteRef,
      {
        cedula,
        nombre: data.nombre,
        fichaEmergencia: data,
        createdAt: data.updatedAt,
        updatedAt: data.updatedAt,
      } as DocumentData,
      { merge: true },
    );
  }

  // Copia pública para QR (colección `users` ya abierta en reglas)
  await setDoc(doc(db, "users", publicDocId(publicId)), {
    kind: "ficha_emergencia",
    fichaEmergencia: data,
    updatedAt: data.updatedAt,
  } as DocumentData);

  return data;
}

export function emergenciaPublicUrl(publicId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://clinicosdoc.com";
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  return `${origin}${path}#/emergencia/${publicId}`;
}
