/** Ficha médica de emergencia — pública vía QR.
 * Fuentes: `pacientes/{cedula}.fichaEmergencia`, índice legado
 * `fichas_emergencia_cedula`, docs `fichas_emergencia/{id}`, copia `users/emg_{id}`.
 */
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
import { cedulaLookupKeys, normalizeCedula } from "./cedula";
import { RegistroPaths } from "../registro/models";

export const FICHAS_PATH = "fichas_emergencia";
export const FICHAS_CEDULA_PATH = "fichas_emergencia_cedula";

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
  /** Usuario declaró veracidad de los datos. */
  declaracionFe?: boolean;
  declaracionFeAt?: string;
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

function asFicha(raw: unknown, fallbackCedula = ""): FichaEmergencia | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<FichaEmergencia> & Record<string, unknown>;
  if (d.activo === false) return null;
  const publicId = String(d.publicId ?? "").trim();
  const nombre = String(d.nombre ?? "").trim();
  const tipoSangre = String(d.tipoSangre ?? "").trim();
  const hasMedical =
    Boolean(nombre) ||
    Boolean(tipoSangre) ||
    Boolean(d.alergias) ||
    Boolean(d.condiciones) ||
    Boolean(d.medicamentos) ||
    (Array.isArray(d.contactos) && d.contactos.length > 0);
  if (!publicId && !hasMedical) return null;
  const cedula = String(d.patientCedula ?? fallbackCedula ?? "").trim();
  return {
    publicId: publicId || `legacy_${normalizeCedula(cedula) || "sinid"}`,
    patientCedula: cedula,
    nombre: nombre || "Paciente",
    tipoSangre: tipoSangre || "Desconocido",
    alergias: String(d.alergias ?? ""),
    condiciones: String(d.condiciones ?? ""),
    medicamentos: String(d.medicamentos ?? ""),
    contactos: Array.isArray(d.contactos) ? (d.contactos as EmergencyContact[]) : [],
    updatedAt: String(d.updatedAt ?? ""),
    activo: true,
    declaracionFe: Boolean(d.declaracionFe),
    declaracionFeAt: d.declaracionFeAt ? String(d.declaracionFeAt) : undefined,
  };
}

function fichaFromPacienteDoc(data: DocumentData | undefined, docId: string): FichaEmergencia | null {
  if (!data) return null;
  return (
    asFicha(data.fichaEmergencia, docId) ||
    asFicha(data, docId) ||
    null
  );
}

async function getFichaFromPublicCopy(publicId: string): Promise<FichaEmergencia | null> {
  if (!publicId || publicId.startsWith("legacy_")) return null;
  const snap = await getDoc(doc(getDb(), "users", publicDocId(publicId)));
  if (!snap.exists()) return null;
  const data = snap.data();
  return asFicha(data?.fichaEmergencia ?? data);
}

async function getFichaFromLegacyIndex(cedula: string): Promise<FichaEmergencia | null> {
  const db = getDb();
  for (const key of cedulaLookupKeys(cedula)) {
    try {
      const idx = await getDoc(doc(db, FICHAS_CEDULA_PATH, key));
      if (!idx.exists()) continue;
      const publicId = String(idx.data()?.publicId ?? "").trim();
      if (publicId) {
        const fromUsers = await getFichaFromPublicCopy(publicId);
        if (fromUsers) return fromUsers;
        const legacy = await getDoc(doc(db, FICHAS_PATH, publicId));
        if (legacy.exists()) {
          const f = asFicha(legacy.data()?.fichaEmergencia ?? legacy.data(), key);
          if (f) return f;
        }
      }
      const nested = asFicha(idx.data()?.fichaEmergencia ?? idx.data(), key);
      if (nested) return nested;
    } catch {
      /* colección antigua puede no existir / sin permiso en algunos entornos */
    }
  }
  return null;
}

async function queryPacientesByCedulaField(cedula: string): Promise<FichaEmergencia | null> {
  const db = getDb();
  const col = collection(db, RegistroPaths.PACIENTES);
  const keys = cedulaLookupKeys(cedula);
  for (const key of keys) {
    for (const field of ["cedula", "fichaEmergencia.patientCedula", "patientCedula"] as const) {
      try {
        const snap = await getDocs(query(col, where(field, "==", key), limit(3)));
        for (const d of snap.docs) {
          const f = fichaFromPacienteDoc(d.data(), d.id);
          if (f) return f;
        }
      } catch {
        /* where anidado puede requerir índice; continuar */
      }
    }
  }
  return null;
}

export async function getFichaByCedula(cedula: string): Promise<FichaEmergencia | null> {
  const db = getDb();
  const keys = cedulaLookupKeys(cedula);
  if (!keys.length) return null;

  // 1) Doc directo pacientes/{key}
  for (const key of keys) {
    try {
      const snap = await getDoc(doc(db, RegistroPaths.PACIENTES, key));
      if (!snap.exists()) continue;
      const ficha = fichaFromPacienteDoc(snap.data(), key);
      if (ficha) return ficha;
    } catch {
      /* seguir con otras claves */
    }
  }

  // 2) Query por campos de cédula (por si el id del doc no coincide)
  const byField = await queryPacientesByCedulaField(cedula);
  if (byField) return byField;

  // 3) Índice / colección legada
  return getFichaFromLegacyIndex(cedula);
}

export async function getFichaByPublicId(publicId: string): Promise<FichaEmergencia | null> {
  const fromUsers = await getFichaFromPublicCopy(publicId);
  if (fromUsers) return fromUsers;
  try {
    const legacy = await getDoc(doc(getDb(), FICHAS_PATH, publicId));
    if (legacy.exists()) {
      return asFicha(legacy.data()?.fichaEmergencia ?? legacy.data());
    }
  } catch {
    /* ignore */
  }
  return null;
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
  declaracionFe: boolean;
}): Promise<FichaEmergencia> {
  if (!input.declaracionFe) {
    throw new Error("Debe aceptar la declaración de veracidad de los datos");
  }
  const cedula = normalizeCedula(input.patientCedula);
  let publicId = input.existingPublicId?.trim();
  if (!publicId || publicId.startsWith("legacy_")) {
    const existing = await getFichaByCedula(cedula);
    publicId =
      existing?.publicId && !existing.publicId.startsWith("legacy_")
        ? existing.publicId
        : randomPublicId();
  }

  const now = new Date().toISOString();
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
    updatedAt: now,
    activo: true,
    declaracionFe: true,
    declaracionFeAt: now,
  };

  const db = getDb();
  const pacienteRef = doc(db, RegistroPaths.PACIENTES, cedula);
  const pacienteSnap = await getDoc(pacienteRef);
  if (pacienteSnap.exists()) {
    await setDoc(pacienteRef, { fichaEmergencia: data, updatedAt: data.updatedAt, cedula } as DocumentData, {
      merge: true,
    });
  } else {
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

  // Copia pública para QR
  await setDoc(doc(db, "users", publicDocId(publicId)), {
    kind: "ficha_emergencia",
    fichaEmergencia: data,
    updatedAt: data.updatedAt,
  } as DocumentData);

  // Índice por cédula (todas las variantes) para búsqueda del médico
  for (const key of cedulaLookupKeys(cedula)) {
    try {
      await setDoc(
        doc(db, FICHAS_CEDULA_PATH, key),
        { publicId, patientCedula: cedula, updatedAt: data.updatedAt } as DocumentData,
        { merge: true },
      );
    } catch {
      /* si las reglas aún no incluyen esta colección, no bloquear el guardado */
    }
  }

  return data;
}

export function emergenciaPublicUrl(publicId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://clinicosdoc.com";
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  return `${origin}${path}#/emergencia/${publicId}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** HTML de ficha para médico (modal / detalle). */
export function renderFichaHtml(f: FichaEmergencia): string {
  const contacts = f.contactos.length
    ? `<ul class="list">${f.contactos
        .map(
          (c) =>
            `<li class="list-item"><strong>${escapeHtml(c.nombre)}</strong><span>${escapeHtml(c.parentesco)} · <a href="tel:${escapeHtml(c.telefono)}">${escapeHtml(c.telefono)}</a></span></li>`,
        )
        .join("")}</ul>`
    : `<p class="muted">Sin contactos registrados.</p>`;

  return `
    <div class="emergency-badge">EMERGENCIA</div>
    <h2 class="emergency-name">${escapeHtml(f.nombre)}</h2>
    <p class="muted">C.I. ${escapeHtml(f.patientCedula)}</p>
    <div class="card-panel emergency-grid">
      <div><span class="muted">Tipo de sangre</span><strong class="blood-type">${escapeHtml(f.tipoSangre)}</strong></div>
      <div><span class="muted">Alergias</span><p>${escapeHtml(f.alergias)}</p></div>
      <div><span class="muted">Condiciones / Comorbilidades</span><p>${escapeHtml(f.condiciones)}</p></div>
      <div><span class="muted">Medicamentos</span><p>${escapeHtml(f.medicamentos)}</p></div>
    </div>
    <h3 class="home-section-title">Contactos de emergencia</h3>
    ${contacts}
  `;
}
