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
import { authLogin } from "../services/auth-login";
import { authRegister } from "../services/auth-register";
import { getDb } from "./firebase";
import type {
  AtencionRegistro,
  PacienteRegistro,
  ProfesionalRegistro,
  ProfesionalSession,
  SolicitudAyuda,
} from "./models";
import { RegistroPaths } from "./models";

function assertPin4(pin: string): void {
  if (!/^\d{4}$/.test(pin)) throw new Error("El PIN debe tener exactamente 4 dígitos");
}

/** Solo dígitos — igual que la app y app-account (acepta "MPPS-164775" o "164775"). */
function normalizeMpps(mpps: string): string {
  return mpps.replace(/\D/g, "");
}

function patientRef(cedula: string) {
  return doc(getDb(), RegistroPaths.PACIENTES, normalizeCedula(cedula));
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
  assertPin4(input.pin);
  const auth = await authRegister({
    tipo: "paciente",
    cedula: input.cedula,
    nombre: input.nombre,
    edad: input.edad,
    fechaNacimiento: input.fechaNacimiento,
    sexo: input.sexo,
    telefono: input.telefono,
    correo: input.correo,
    pin: input.pin,
  });
  const cedula = normalizeCedula(auth.cedula || input.cedula);
  return {
    cedula,
    nombre: auth.nombre || input.nombre.trim(),
    edad: input.edad,
    fechaNacimiento: input.fechaNacimiento,
    sexo: input.sexo.trim(),
    telefono: input.telefono.trim(),
    correo: auth.correo || input.correo.trim(),
    pinHash: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function registerProfesional(input: {
  cedula: string;
  nombre: string;
  especialidad: string;
  esMedicoGeneral: boolean;
  mpps: string;
  correo: string;
  pin: string;
  sexo: string;
  nacionalidad: string;
}): Promise<ProfesionalRegistro> {
  assertPin4(input.pin);
  const correo = input.correo.trim();
  if (!correo || !correo.includes("@")) throw new Error("Correo electrónico requerido");
  if (input.sexo !== "Masculino" && input.sexo !== "Femenino") {
    throw new Error("Seleccione el sexo");
  }
  const nacionalidad = input.nacionalidad === "Otros" ? "Otros" : "Venezuela";
  const especialidad = input.esMedicoGeneral ? "Médico general" : input.especialidad.trim();

  const auth = await authRegister({
    tipo: "profesional",
    cedula: input.cedula,
    nombre: input.nombre,
    especialidad,
    esMedicoGeneral: input.esMedicoGeneral,
    mpps: input.mpps,
    correo,
    pin: input.pin,
    sexo: input.sexo,
    nacionalidad,
    source: "web",
  });

  const cedula = normalizeCedula(auth.cedula || input.cedula);
  return {
    cedula,
    nombre: auth.nombre || input.nombre.trim(),
    especialidad: auth.especialidad || especialidad,
    esMedicoGeneral: input.esMedicoGeneral,
    mpps: auth.mpps || (nacionalidad === "Venezuela" ? normalizeMpps(input.mpps) : ""),
    correo,
    pinHash: "",
    activo: true,
    createdAt: new Date().toISOString(),
    sexo: input.sexo,
    nacionalidad,
  };
}

export async function consultarPaciente(cedula: string): Promise<PacienteRegistro> {
  const p = await getPaciente(cedula);
  if (!p) throw new Error("No hay registro con esa cédula");
  return p;
}

export async function loginPaciente(cedula: string, pin: string): Promise<PacienteRegistro> {
  assertPin4(pin);
  const auth = await authLogin({ tipo: "paciente", cedula, pin });
  const p = await getPaciente(auth.cedula || cedula);
  if (!p) {
    return {
      cedula: auth.cedula || normalizeCedula(cedula),
      nombre: auth.nombre || "",
      edad: 0,
      fechaNacimiento: "",
      sexo: "",
      telefono: "",
      correo: auth.correo || "",
      pinHash: "",
      createdAt: "",
      updatedAt: "",
    };
  }
  return p;
}

export async function loginProfesional(
  cedula: string,
  pin: string,
  _mpps = "",
): Promise<ProfesionalSession> {
  assertPin4(pin);
  const auth = await authLogin({ tipo: "profesional", cedula, pin });
  const cedNorm = normalizeCedula(auth.cedula || cedula);
  const p = await getProfesional(cedNorm);
  return {
    cedula: cedNorm,
    nombre: auth.nombre || p?.nombre || "Médico",
    especialidad: auth.especialidad || p?.especialidad || "Médico general",
    esMedicoGeneral: p?.esMedicoGeneral ?? /general/i.test(auth.especialidad || ""),
    mpps: auth.mpps || p?.mpps || "",
    cloudUserId: auth.cloudUserId || auth.uid,
    sexo: auth.sexo || p?.sexo,
    nacionalidad: auth.nacionalidad || p?.nacionalidad,
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
