/** Cuenta de consultorio = misma colección que la app Android (`clinicosdoc_user`). */
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
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { normalizeCedula } from "./cedula";
import { getDb } from "../registro/firebase";
import { FirestorePaths } from "../shared/models";
import { hashPin } from "../registro/session";
import type { ProfesionalRegistro, ProfesionalSession } from "../registro/models";
import { RegistroPaths } from "../registro/models";

/** Hash del PIN como en la app (SHA-256 del PIN solo, sin cédula). */
export async function hashAppPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type CloudUserDoc = {
  id: string;
  nombre: string;
  cedula: string;
  cedulaNormalizada: string;
  mpps: string;
  especialidad: string;
  correo: string;
  passwordHash: string;
  sexo?: string;
  whatsapp?: string;
};

function usersCol() {
  return collection(getDb(), FirestorePaths.USERS);
}

async function queryUserByField(field: string, value: string): Promise<QueryDocumentSnapshot | null> {
  if (!value) return null;
  const snap = await getDocs(query(usersCol(), where(field, "==", value), limit(1)));
  return snap.docs[0] ?? null;
}

export async function findCloudUserByCedula(cedulaInput: string): Promise<CloudUserDoc | null> {
  const norm = normalizeCedula(cedulaInput);
  const raw = cedulaInput.trim();
  const hit =
    (await queryUserByField("cedulaNormalizada", norm)) ||
    (await queryUserByField("cedula", norm)) ||
    (raw !== norm ? await queryUserByField("cedula", raw) : null);
  if (!hit) return null;
  const d = hit.data();
  return {
    id: hit.id,
    nombre: String(d.nombre ?? ""),
    cedula: String(d.cedula ?? norm),
    cedulaNormalizada: String(d.cedulaNormalizada ?? norm),
    mpps: String(d.mpps ?? ""),
    especialidad: String(d.especialidad ?? "Médico general"),
    correo: String(d.correo ?? d.email ?? ""),
    passwordHash: String(d.passwordHash ?? ""),
    sexo: d.sexo ? String(d.sexo) : undefined,
    whatsapp: d.whatsapp ? String(d.whatsapp) : undefined,
  };
}

function normalizeMpps(mpps: string): string {
  return mpps.replace(/\D/g, "");
}

export async function createCloudUser(input: {
  cedula: string;
  nombre: string;
  especialidad: string;
  mpps: string;
  correo: string;
  pin: string;
  sexo?: string;
  nacionalidad?: string;
}): Promise<CloudUserDoc> {
  const cedulaNorm = normalizeCedula(input.cedula);
  const existing = await findCloudUserByCedula(cedulaNorm);
  if (existing) {
    throw new Error("Esta cédula ya tiene cuenta en la app. Use Ingresar con el mismo PIN.");
  }

  const ref = doc(usersCol());
  const passwordHash = await hashAppPin(input.pin);
  const nacionalidad = input.nacionalidad === "Otros" ? "Otros" : "Venezuela";
  const data: DocumentData = {
    nombre: input.nombre.trim(),
    cedula: input.cedula.trim() || cedulaNorm,
    cedulaNormalizada: cedulaNorm,
    mpps: input.mpps.trim(),
    especialidad: input.especialidad.trim() || "Médico general",
    correo: input.correo.trim(),
    passwordHash,
    sexo: input.sexo?.trim() || "",
    whatsapp: "",
    nacionalidad,
    mppsValidado: nacionalidad === "Venezuela" && Boolean(input.mpps.trim()),
    source: "web",
  };
  await setDoc(ref, data);
  return {
    id: ref.id,
    nombre: String(data.nombre),
    cedula: String(data.cedula),
    cedulaNormalizada: cedulaNorm,
    mpps: String(data.mpps),
    especialidad: String(data.especialidad),
    correo: String(data.correo),
    passwordHash,
    sexo: input.sexo,
  };
}

/** Si solo existe cuenta app, crea espejo en `profesionales` para el muro/atenciones. */
export async function ensureProfesionalMirror(
  cloud: CloudUserDoc,
  pin: string,
): Promise<ProfesionalRegistro | null> {
  const cedula = normalizeCedula(cloud.cedula || cloud.cedulaNormalizada);
  const snap = await getDoc(doc(getDb(), RegistroPaths.PROFESIONALES, cedula));
  if (snap.exists()) return snap.data() as ProfesionalRegistro;

  const data: ProfesionalRegistro = {
    cedula,
    nombre: cloud.nombre || "Médico",
    especialidad: cloud.especialidad || "Médico general",
    esMedicoGeneral: !cloud.especialidad || /general/i.test(cloud.especialidad),
    mpps: cloud.mpps,
    correo: cloud.correo || "",
    pinHash: await hashPin(cedula, pin),
    activo: true,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(getDb(), RegistroPaths.PROFESIONALES, cedula), data as DocumentData);
  return data;
}

/**
 * Resuelve la misma cuenta Firebase que la app.
 * Prioridad: `clinicosdoc_user` (app) → si no hay, usa `profesionales` y crea el doc cloud.
 */
export async function resolveCloudAccount(input: {
  cedula: string;
  pin: string;
  mpps: string;
  /** Datos de `profesionales` si el login web ya los validó */
  profesional?: ProfesionalRegistro | null;
}): Promise<{ cloud: CloudUserDoc; session: ProfesionalSession }> {
  const cedula = normalizeCedula(input.cedula);
  const pinHashApp = await hashAppPin(input.pin);
  const inputMpps = normalizeMpps(input.mpps);

  let cloud = await findCloudUserByCedula(cedula);

  if (cloud) {
    if (!cloud.passwordHash || cloud.passwordHash !== pinHashApp) {
      throw new Error("PIN incorrecto (no coincide con la cuenta de la app)");
    }
    const storedMpps = normalizeMpps(cloud.mpps);
    if (storedMpps) {
      if (!inputMpps) throw new Error("Código MPPS requerido");
      if (storedMpps !== inputMpps) throw new Error("Código MPPS incorrecto");
    }
  } else if (input.profesional) {
    const existingCloud = await findCloudUserByCedula(cedula);
    if (existingCloud) {
      // Profesionales ok pero cloud ya existía: exigir PIN app
      if (!existingCloud.passwordHash || existingCloud.passwordHash !== pinHashApp) {
        throw new Error("PIN incorrecto (no coincide con la cuenta de la app)");
      }
      cloud = existingCloud;
    } else {
      cloud = await createCloudUser({
        cedula: input.profesional.cedula,
        nombre: input.profesional.nombre,
        especialidad: input.profesional.especialidad,
        mpps: input.profesional.mpps,
        correo: input.profesional.correo,
        pin: input.pin,
      });
    }
  } else {
    throw new Error("No hay cuenta de consultorio con esa cédula. Regístrese o use la app.");
  }

  await ensureProfesionalMirror(cloud, input.pin);

  const session: ProfesionalSession = {
    cedula: normalizeCedula(cloud.cedula || cedula),
    nombre: cloud.nombre || input.profesional?.nombre || "Médico",
    especialidad: cloud.especialidad || input.profesional?.especialidad || "Médico general",
    esMedicoGeneral: input.profesional?.esMedicoGeneral ?? /general/i.test(cloud.especialidad || ""),
    mpps: cloud.mpps || input.mpps,
    cloudUserId: cloud.id,
  };

  return { cloud, session };
}
