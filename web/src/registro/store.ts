import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { normalizeCedula, cedulaLookupKeys } from "../services/cedula";
import { getDb } from "./firebase";
import type {
  AtencionRegistro,
  PacienteRegistro,
  ProfesionalRegistro,
  ProfesionalSession,
  SolicitudAyuda,
} from "./models";
import { RegistroPaths } from "./models";
import { hashPin } from "./session";

function assertPin4(pin: string): void {
  if (!/^\d{4}$/.test(pin)) throw new Error("El PIN debe tener exactamente 4 dígitos");
}

function normalizeMpps(mpps: string): string {
  return mpps.trim().toUpperCase();
}

function patientRef(cedula: string) {
  return doc(getDb(), RegistroPaths.PACIENTES, normalizeCedula(cedula));
}

function professionalRef(cedula: string) {
  return doc(getDb(), RegistroPaths.PROFESIONALES, normalizeCedula(cedula));
}

function atencionesRef(cedula: string) {
  return collection(getDb(), RegistroPaths.PACIENTES, normalizeCedula(cedula), RegistroPaths.ATENCIONES);
}

export async function getPaciente(cedula: string): Promise<PacienteRegistro | null> {
  for (const key of cedulaLookupKeys(cedula)) {
    const snap = await getDoc(doc(getDb(), RegistroPaths.PACIENTES, key));
    if (snap.exists()) return snap.data() as PacienteRegistro;
  }
  return null;
}

export async function getProfesional(cedula: string): Promise<ProfesionalRegistro | null> {
  for (const key of cedulaLookupKeys(cedula)) {
    const snap = await getDoc(doc(getDb(), RegistroPaths.PROFESIONALES, key));
    if (snap.exists()) return snap.data() as ProfesionalRegistro;
  }
  return null;
}

export async function registerPaciente(input: {
  cedula: string;
  nombre: string;
  edad: number;
  fechaNacimiento: string;
  sexo: string;
  telefono: string;
  correo: string;
  pin: string;
}): Promise<PacienteRegistro> {
  const cedula = normalizeCedula(input.cedula);
  assertPin4(input.pin);
  const existing = await getPaciente(cedula);
  if (existing) throw new Error("Ya existe un paciente con esa cédula");

  const now = new Date().toISOString();
  const data: PacienteRegistro = {
    cedula,
    nombre: input.nombre.trim(),
    edad: input.edad,
    fechaNacimiento: input.fechaNacimiento,
    sexo: input.sexo.trim(),
    telefono: input.telefono.trim(),
    correo: input.correo.trim(),
    pinHash: await hashPin(cedula, input.pin),
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(patientRef(cedula), data as DocumentData);
  return data;
}

export async function registerProfesional(input: {
  cedula: string;
  nombre: string;
  especialidad: string;
  esMedicoGeneral: boolean;
  mpps: string;
  pin: string;
}): Promise<ProfesionalRegistro> {
  const cedula = normalizeCedula(input.cedula);
  assertPin4(input.pin);
  const existing = await getProfesional(cedula);
  if (existing) throw new Error("Ya existe un profesional con esa cédula");

  const data: ProfesionalRegistro = {
    cedula,
    nombre: input.nombre.trim(),
    especialidad: input.esMedicoGeneral ? "Médico general" : input.especialidad.trim(),
    esMedicoGeneral: input.esMedicoGeneral,
    mpps: input.mpps.trim(),
    pinHash: await hashPin(cedula, input.pin),
    activo: true,
    createdAt: new Date().toISOString(),
  };
  await setDoc(professionalRef(cedula), data as DocumentData);
  return data;
}

export async function consultarPaciente(cedula: string): Promise<PacienteRegistro> {
  const p = await getPaciente(cedula);
  if (!p) throw new Error("No hay registro con esa cédula");
  return p;
}

export async function loginPaciente(cedula: string, pin: string): Promise<PacienteRegistro> {
  const p = await getPaciente(cedula);
  if (!p) throw new Error("No hay registro con esa cédula");
  if (!p.pinHash) throw new Error("Debe completar su registro con PIN de 4 dígitos");
  assertPin4(pin);
  const pinHash = await hashPin(p.cedula, pin);
  if (p.pinHash !== pinHash) throw new Error("PIN incorrecto");
  return p;
}

export async function loginProfesional(
  cedula: string,
  pin: string,
  mpps: string,
): Promise<ProfesionalSession> {
  const p = await getProfesional(cedula);
  if (!p) throw new Error("No hay profesional registrado con esa cédula");
  if (!p.activo) throw new Error("Cuenta pendiente de activación");
  assertPin4(pin);
  if (normalizeMpps(p.mpps) !== normalizeMpps(mpps)) throw new Error("Código MPPS incorrecto");
  const pinHash = await hashPin(p.cedula, pin);
  if (p.pinHash !== pinHash) throw new Error("PIN incorrecto");
  return {
    cedula: p.cedula,
    nombre: p.nombre,
    especialidad: p.especialidad,
    esMedicoGeneral: p.esMedicoGeneral,
    mpps: p.mpps,
  };
}

export async function upsertPacienteMinimo(input: {
  cedula: string;
  nombre: string;
  edad: number;
  fechaNacimiento: string;
  sexo?: string;
}): Promise<PacienteRegistro> {
  const cedula = normalizeCedula(input.cedula);
  const existing = await getPaciente(cedula);
  if (existing) return existing;

  const now = new Date().toISOString();
  const data: PacienteRegistro = {
    cedula,
    nombre: input.nombre.trim(),
    edad: input.edad,
    fechaNacimiento: input.fechaNacimiento,
    sexo: input.sexo?.trim() || "",
    telefono: "",
    correo: "",
    pinHash: "",
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(patientRef(cedula), data as DocumentData);
  return data;
}

export async function listAtenciones(cedula: string): Promise<AtencionRegistro[]> {
  const q = query(atencionesRef(cedula), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as AtencionRegistro);
}

export async function createAtencion(
  prof: ProfesionalSession,
  input: {
    patientCedula: string;
    patientNombre: string;
    motivo: string;
    notas: string;
    diagnostico?: string;
    lugarAtencion?: string;
  },
): Promise<AtencionRegistro> {
  const cedula = normalizeCedula(input.patientCedula);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const data: AtencionRegistro = {
    id,
    patientCedula: cedula,
    patientNombre: input.patientNombre.trim(),
    professionalCedula: prof.cedula,
    professionalNombre: prof.nombre,
    especialidad: prof.especialidad,
    mpps: prof.mpps,
    motivo: input.motivo.trim(),
    notas: input.notas.trim(),
    diagnostico: input.diagnostico?.trim() || undefined,
    lugarAtencion: input.lugarAtencion?.trim() || undefined,
    createdAt: now,
  };
  await setDoc(doc(atencionesRef(cedula), id), data as DocumentData);
  await setDoc(
    patientRef(cedula),
    { updatedAt: now, nombre: data.patientNombre },
    { merge: true },
  );
  return data;
}

export function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-VE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function solicitudesRef() {
  return collection(getDb(), RegistroPaths.SOLICITUDES);
}

export async function createSolicitud(input: {
  patientCedula: string;
  patientNombre: string;
  zona: string;
  necesidad: string;
  lat?: number;
  lng?: number;
}): Promise<SolicitudAyuda> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const data: SolicitudAyuda = {
    id,
    patientCedula: normalizeCedula(input.patientCedula),
    patientNombre: input.patientNombre.trim(),
    zona: input.zona.trim(),
    necesidad: input.necesidad.trim(),
    createdAt: now,
  };
  if (input.lat != null && input.lng != null) {
    data.lat = input.lat;
    data.lng = input.lng;
  }
  await setDoc(doc(solicitudesRef(), id), data as DocumentData);
  return data;
}

export async function listSolicitudes(limit = 100): Promise<SolicitudAyuda[]> {
  const q = query(solicitudesRef(), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as SolicitudAyuda).slice(0, limit);
}

export async function countRegistrados(): Promise<{ pacientes: number; profesionales: number; solicitudes: number }> {
  const [p, pr, s] = await Promise.all([
    getDocs(collection(getDb(), RegistroPaths.PACIENTES)),
    getDocs(collection(getDb(), RegistroPaths.PROFESIONALES)),
    getDocs(solicitudesRef()),
  ]);
  return { pacientes: p.size, profesionales: pr.size, solicitudes: s.size };
}

export async function listPacientesRegistrados(): Promise<PacienteRegistro[]> {
  const snap = await getDocs(collection(getDb(), RegistroPaths.PACIENTES));
  return snap.docs
    .map((d) => d.data() as PacienteRegistro)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
