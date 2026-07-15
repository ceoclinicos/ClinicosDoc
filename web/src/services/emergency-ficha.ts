/** Ficha médica de emergencia — pública vía QR. */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "../registro/firebase";
import { normalizeCedula } from "./cedula";

export const FICHAS_PATH = "fichas_emergencia";

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

function col() {
  return collection(getDb(), FICHAS_PATH);
}

function randomPublicId(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let id = "";
  const arr = crypto.getRandomValues(new Uint8Array(10));
  for (const b of arr) id += alphabet[b % alphabet.length];
  return id;
}

export async function getFichaByCedula(cedula: string): Promise<FichaEmergencia | null> {
  const key = normalizeCedula(cedula);
  const snap = await getDocs(query(col(), where("patientCedula", "==", key), limit(1)));
  if (snap.empty) return null;
  return snap.docs[0].data() as FichaEmergencia;
}

export async function getFichaByPublicId(publicId: string): Promise<FichaEmergencia | null> {
  const snap = await getDoc(doc(getDb(), FICHAS_PATH, publicId));
  if (!snap.exists()) return null;
  const data = snap.data() as FichaEmergencia;
  if (data.activo === false) return null;
  return data;
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

  await setDoc(doc(getDb(), FICHAS_PATH, publicId), data as DocumentData);
  return data;
}

export function emergenciaPublicUrl(publicId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://clinicosdoc.com";
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  return `${origin}${path}#/emergencia/${publicId}`;
}
