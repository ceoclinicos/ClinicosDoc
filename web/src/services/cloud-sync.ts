/** Sync consultorio web ↔ Firestore (mismo esquema que CloudSyncService Android). */
import { setDoc, doc, deleteDoc, collection, getDocs, query, where, type DocumentData } from "firebase/firestore";
import { getDb } from "../registro/firebase";
import { getProfessionalSession } from "../registro/session";
import {
  FirestorePaths,
  type ClinicalDocument,
  type ClinicalDraft,
  type DocumentHeader,
  type DocumentTemplate,
  type DocumentType,
  type Patient,
  type PhysicalExamSystem,
} from "../shared/models";
import { PhysicalExamDefaults, orderEnabledIds } from "../shared/physical-exam-defaults";
import { loadDoctorProfile } from "./doctor-local";
import { cedulaLookupKeys, normalizeCedula } from "./cedula";
import { loadJson, saveJson } from "./local-store";

function userIdOrThrow(): string {
  const id = getProfessionalSession()?.cloudUserId;
  if (!id) throw new Error("Sin cuenta cloud vinculada. Cierre sesión e ingrese de nuevo.");
  return id;
}

function sub(userId: string, name: string) {
  return collection(getDb(), FirestorePaths.USERS, userId, name);
}

/** Paridad CedulaNormalizer.normalize Android (sin forzar V). */
function cedulaKeyAndroid(cedula: string): string {
  return cedula.trim().toUpperCase().replace(/[\s.-]/g, "");
}

/** ID global `{cedula}_{nombre}` — paridad PatientFirestoreId.kt */
export function patientFirestoreId(cedula: string, nombre: string): string {
  const cedulaPart = cedulaKeyAndroid(cedula).toLowerCase();
  const nameSlug = nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
  if (!cedulaPart || !nameSlug) {
    throw new Error("Cédula y nombre son obligatorios para el ID global");
  }
  return `${cedulaPart}_${nameSlug}`;
}

function asDocType(raw: string): DocumentType {
  if (raw === "historiaClinica" || raw === "HISTORIA_CLINICA") return "historiaClinica";
  if (raw === "reposo" || raw === "REPOSO") return "reposo";
  if (raw === "ordenesMedicas" || raw === "ORDENES_MEDICAS") return "ordenesMedicas";
  if (raw === "receta" || raw === "RECETA") return "receta";
  return "informe";
}

function parseTemplate(data: DocumentData, id: string): DocumentTemplate | null {
  if (!data.name || !data.documentType) return null;
  return {
    id: String(data.id ?? id),
    name: String(data.name),
    documentType: asDocType(String(data.documentType)),
    sections: Array.isArray(data.sections) ? data.sections.map(String) : [],
    isDefault: Boolean(data.isDefault),
    enabledPhysicalExamSystemIds: orderEnabledIds(
      Array.isArray(data.enabledPhysicalExamSystemIds)
        ? data.enabledPhysicalExamSystemIds.map(String)
        : [],
    ),
    enfermedadActualEjemplo: data.enfermedadActualEjemplo
      ? String(data.enfermedadActualEjemplo)
      : undefined,
    sectionDefaultTexts: parseSectionDefaultTexts(data.sectionDefaultTexts),
  };
}

function parseSectionDefaultTexts(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseHeader(data: DocumentData, id: string): DocumentHeader | null {
  return {
    id: String(data.id ?? id),
    name: String(data.name ?? "Encabezado"),
    logoPath: data.logoPath ? String(data.logoPath) : undefined,
    logoBase64: data.logoBase64 ? String(data.logoBase64) : undefined,
    doctorName: data.doctorName ? String(data.doctorName) : "",
    subtitle: data.subtitle ? String(data.subtitle) : "",
    description: data.description ? String(data.description) : "",
    isDefault: Boolean(data.isDefault),
  };
}

function parseExam(data: DocumentData, id: string): PhysicalExamSystem | null {
  if (!data.name) return null;
  return {
    id: String(data.id ?? id),
    name: String(data.name),
    defaultText: String(data.defaultText ?? ""),
    sortOrder: Number(data.sortOrder ?? 0),
  };
}

function parsePatient(data: DocumentData, id: string): Patient | null {
  if (!data.nombre || !data.cedula) return null;
  return {
    id: String(data.id ?? id),
    nombre: String(data.nombre),
    cedula: String(data.cedula),
    edad: Number(data.edad ?? 0),
    sexo: String(data.sexo ?? ""),
    fechaNacimiento: String(data.fechaNacimiento ?? ""),
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    whatsapp: data.whatsapp ? String(data.whatsapp) : undefined,
  };
}

function parseDocument(data: DocumentData, id: string): ClinicalDocument | null {
  if (!data.content || !data.type) return null;
  const membrete =
    data.membreteNombre || data.membrete
      ? {
          nombre: String((data.membrete as { nombre?: string })?.nombre ?? data.membreteNombre ?? ""),
          edad: String((data.membrete as { edad?: string })?.edad ?? data.membreteEdad ?? ""),
          sexo: String((data.membrete as { sexo?: string })?.sexo ?? data.membreteSexo ?? ""),
          fechaNacimiento: String(
            (data.membrete as { fechaNacimiento?: string })?.fechaNacimiento ??
              data.membreteFechaNacimiento ??
              "",
          ),
          fecha: String((data.membrete as { fecha?: string })?.fecha ?? data.membreteFecha ?? ""),
        }
      : undefined;
  return {
    id: String(data.id ?? id),
    patientId: String(data.patientId ?? ""),
    patientNombre: String(data.patientNombre ?? ""),
    patientCedula: String(data.patientCedula ?? ""),
    type: asDocType(String(data.type)),
    content: String(data.content),
    rawDictation: String(data.rawDictation ?? ""),
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    templateId: data.templateId ? String(data.templateId) : undefined,
    templateName: data.templateName ? String(data.templateName) : undefined,
    headerId: data.headerId ? String(data.headerId) : undefined,
    headerSnapshot: data.headerSnapshot
      ? (data.headerSnapshot as ClinicalDocument["headerSnapshot"])
      : undefined,
    membrete,
    sourceDocumentId: data.sourceDocumentId ? String(data.sourceDocumentId) : undefined,
  };
}

function parseDraft(data: DocumentData, id: string): ClinicalDraft | null {
  if (!data.patientId || !data.documentType) return null;
  return {
    id: String(data.id ?? id),
    patientId: String(data.patientId),
    patientNombre: String(data.patientNombre ?? ""),
    patientCedula: String(data.patientCedula ?? ""),
    documentType: asDocType(String(data.documentType)),
    dictation: String(data.dictation ?? ""),
    templateId: data.templateId ? String(data.templateId) : undefined,
    templateName: data.templateName ? String(data.templateName) : undefined,
    headerId: data.headerId ? String(data.headerId) : undefined,
    generatedContent: data.generatedContent ? String(data.generatedContent) : undefined,
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    updatedAt: String(data.updatedAt ?? new Date().toISOString()),
  };
}

async function fetchAll<T>(
  userId: string,
  subName: string,
  parse: (data: DocumentData, id: string) => T | null,
): Promise<T[]> {
  const snap = await getDocs(sub(userId, subName));
  return snap.docs.map((d) => parse(d.data(), d.id)).filter((x): x is T => x != null);
}

function parseGlobalPatient(data: DocumentData, id: string): Patient | null {
  if (!data.nombre || !data.cedula) return null;
  return {
    id: String(data.id ?? id),
    nombre: String(data.nombre),
    cedula: String(data.cedula),
    edad: Number(data.edad) || 0,
    sexo: String(data.sexo ?? ""),
    fechaNacimiento: String(data.fechaNacimiento ?? ""),
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    whatsapp: String(data.whatsapp ?? ""),
  };
}

/** Pacientes globales compartidos entre médicos (paridad CloudSyncService Android). */
export async function findGlobalByCedula(cedula: string): Promise<Patient[]> {
  const key = cedulaKeyAndroid(cedula);
  if (!key) return [];
  const col = collection(getDb(), FirestorePaths.GLOBAL_PATIENTS);
  const found: Patient[] = [];

  try {
    const byKey = await getDocs(query(col, where("cedulaKey", "==", key)));
    byKey.docs.forEach((d) => {
      const p = parseGlobalPatient(d.data(), d.id);
      if (p) found.push(p);
    });
    if (found.length) return dedupePatients(found);
  } catch {
    /* índice / permisos */
  }

  for (const variant of cedulaLookupKeys(cedula)) {
    try {
      const snap = await getDocs(query(col, where("cedula", "==", variant)));
      snap.docs.forEach((d) => {
        const p = parseGlobalPatient(d.data(), d.id);
        if (p) found.push(p);
      });
      if (found.length) break;
    } catch {
      /* seguir */
    }
  }

  const digits = cedula.replace(/\D/g, "");
  return dedupePatients(
    found.filter(
      (p) =>
        p.cedula.replace(/\D/g, "") === digits ||
        cedulaKeyAndroid(p.cedula) === key,
    ),
  );
}

function dedupePatients(list: Patient[]): Patient[] {
  const seen = new Set<string>();
  return list.filter((p) => {
    const k = p.cedula.replace(/\D/g, "") + p.nombre.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Global de médicos; si no, portal modo paciente (`pacientes/{cedula}`). */
export async function findPatientByCedulaAnywhere(cedula: string): Promise<Patient | null> {
  const global = await findGlobalByCedula(cedula);
  if (global[0]) return global[0];
  try {
    const { getPaciente } = await import("../registro/store");
    const reg = await getPaciente(cedula);
    if (!reg) return null;
    return {
      id: `portal_${normalizeCedula(reg.cedula)}`,
      nombre: reg.nombre,
      cedula: reg.cedula,
      edad: Number(reg.edad) || 0,
      sexo: reg.sexo || "",
      fechaNacimiento: reg.fechaNacimiento || "",
      createdAt: reg.createdAt || new Date().toISOString(),
      whatsapp: reg.telefono || undefined,
    };
  } catch {
    return null;
  }
}

/** Pull por colección: si hay datos en nube se usan; si no, se sube lo local. */
export async function syncOnLogin(): Promise<void> {
  const userId = getProfessionalSession()?.cloudUserId;
  if (!userId) return;

  const [templates, headers, exams, patients, documents, drafts] = await Promise.all([
    fetchAll(userId, FirestorePaths.SUB_TEMPLATES, parseTemplate),
    fetchAll(userId, FirestorePaths.SUB_HEADERS, parseHeader),
    fetchAll(userId, FirestorePaths.SUB_PHYSICAL_EXAM, parseExam),
    fetchAll(userId, FirestorePaths.SUB_PATIENTS, parsePatient),
    fetchAll(userId, FirestorePaths.SUB_DOCUMENTS, parseDocument),
    fetchAll(userId, FirestorePaths.SUB_DRAFTS, parseDraft),
  ]);

  if (templates.length) saveJson("templates", templates);
  else await Promise.all(loadJson<DocumentTemplate[]>("templates", []).map((t) => pushTemplate(t, userId)));

  if (headers.length) saveJson("headers", headers);
  else await Promise.all(loadJson<DocumentHeader[]>("headers", []).map((h) => pushHeader(h, userId)));

  if (exams.length) saveJson("physical_exam", exams);
  else await Promise.all(loadJson<PhysicalExamSystem[]>("physical_exam", PhysicalExamDefaults).map((e) => pushPhysicalExam(e, userId)));

  if (patients.length) saveJson("patients", patients);
  else await Promise.all(loadJson<Patient[]>("patients", []).map((p) => pushPatient(p, userId)));

  if (documents.length) saveJson("documents", documents);
  else await Promise.all(loadJson<ClinicalDocument[]>("documents", []).map((d) => pushDocument(d, userId)));

  if (drafts.length) saveJson("drafts", drafts);
  else await Promise.all(loadJson<ClinicalDraft[]>("drafts", []).map((d) => pushDraft(d, userId)));
}

export async function pushTemplate(t: DocumentTemplate, userId = userIdOrThrow()): Promise<void> {
  await setDoc(doc(sub(userId, FirestorePaths.SUB_TEMPLATES), t.id), {
    id: t.id,
    name: t.name,
    documentType: t.documentType,
    sections: t.sections,
    isDefault: t.isDefault,
    enabledPhysicalExamSystemIds: orderEnabledIds(t.enabledPhysicalExamSystemIds ?? []),
    physicalExamTextOverrides: {},
    enfermedadActualEjemplo: t.enfermedadActualEjemplo ?? "",
    sectionLayoutOrder: t.sections,
    sectionDefaultTexts: t.sectionDefaultTexts ?? {},
  });
}

export async function pushHeader(h: DocumentHeader, userId = userIdOrThrow()): Promise<void> {
  await setDoc(doc(sub(userId, FirestorePaths.SUB_HEADERS), h.id), {
    id: h.id,
    name: h.name,
    logoPath: null,
    logoBase64: h.logoBase64 ?? null,
    doctorName: h.doctorName ?? "",
    subtitle: h.subtitle ?? "",
    description: h.description ?? "",
    infoLines: [],
    isDefault: h.isDefault,
    headerType: "DOCTOR",
  });
}

export async function deleteHeaderCloud(id: string): Promise<void> {
  const userId = getProfessionalSession()?.cloudUserId;
  if (!userId) return;
  await deleteDoc(doc(sub(userId, FirestorePaths.SUB_HEADERS), id));
}

export async function deletePhysicalExamCloud(systemId: string): Promise<void> {
  const userId = getProfessionalSession()?.cloudUserId;
  if (!userId) return;
  await deleteDoc(doc(sub(userId, FirestorePaths.SUB_PHYSICAL_EXAM), systemId));
}

export async function pushPhysicalExam(s: PhysicalExamSystem, userId = userIdOrThrow()): Promise<void> {
  await setDoc(doc(sub(userId, FirestorePaths.SUB_PHYSICAL_EXAM), s.id), {
    id: s.id,
    name: s.name,
    defaultText: s.defaultText,
    sortOrder: s.sortOrder,
  });
}

export async function pushPatient(p: Patient, userId = userIdOrThrow()): Promise<void> {
  const cedulaKey = cedulaKeyAndroid(p.cedula);
  await setDoc(doc(sub(userId, FirestorePaths.SUB_PATIENTS), p.id), {
    id: p.id,
    nombre: p.nombre,
    cedula: p.cedula,
    edad: p.edad,
    sexo: p.sexo,
    fechaNacimiento: p.fechaNacimiento,
    createdAt: p.createdAt,
    whatsapp: p.whatsapp ?? "",
    cedulaKey,
  });
  await pushGlobalPatient(userId, p);
}

async function pushGlobalPatient(userId: string, patient: Patient): Promise<void> {
  const key = patientFirestoreId(patient.cedula, patient.nombre);
  const now = new Date().toISOString();
  await setDoc(
    doc(getDb(), FirestorePaths.GLOBAL_PATIENTS, key),
    {
      id: patient.id,
      nombre: patient.nombre,
      cedula: patient.cedula,
      edad: patient.edad,
      sexo: patient.sexo,
      fechaNacimiento: patient.fechaNacimiento,
      createdAt: patient.createdAt,
      whatsapp: patient.whatsapp ?? "",
      firestoreKey: key,
      cedulaKey: cedulaKeyAndroid(patient.cedula),
      updatedAt: now,
      lastUpdatedByDoctorId: userId,
    },
    { merge: true },
  );
}

export async function pushDocument(d: ClinicalDocument, userId = userIdOrThrow()): Promise<void> {
  const doctor = loadDoctorProfile();
  const doctorNombre = doctor?.nombre ?? getProfessionalSession()?.nombre ?? "";
  const payload = {
    id: d.id,
    patientId: d.patientId,
    patientNombre: d.patientNombre,
    patientCedula: d.patientCedula,
    type: d.type,
    content: d.content,
    rawDictation: d.rawDictation,
    createdAt: d.createdAt,
    templateId: d.templateId ?? null,
    templateName: d.templateName ?? null,
    headerId: d.headerId ?? null,
    headerSnapshot: d.headerSnapshot ?? null,
    membreteNombre: d.membrete?.nombre ?? null,
    membreteEdad: d.membrete?.edad ?? null,
    membreteSexo: d.membrete?.sexo ?? null,
    membreteFechaNacimiento: d.membrete?.fechaNacimiento ?? null,
    membreteFecha: d.membrete?.fecha ?? null,
    doctorId: userId,
    doctorNombre,
    sourceDocumentId: d.sourceDocumentId ?? null,
  };
  await setDoc(doc(sub(userId, FirestorePaths.SUB_DOCUMENTS), d.id), payload);
  await pushGlobalDocument(userId, doctorNombre, d);
}

async function pushGlobalDocument(
  userId: string,
  doctorNombre: string,
  document: ClinicalDocument,
): Promise<void> {
  const patientKey = patientFirestoreId(document.patientCedula, document.patientNombre);
  await setDoc(
    doc(
      getDb(),
      FirestorePaths.GLOBAL_PATIENTS,
      patientKey,
      FirestorePaths.SUB_DOCUMENTS,
      document.id,
    ),
    {
      id: document.id,
      patientId: document.patientId,
      patientNombre: document.patientNombre,
      patientCedula: document.patientCedula,
      type: document.type,
      content: document.content,
      rawDictation: document.rawDictation,
      createdAt: document.createdAt,
      templateId: document.templateId ?? null,
      templateName: document.templateName ?? null,
      headerId: document.headerId ?? null,
      headerSnapshot: document.headerSnapshot ?? null,
      membreteNombre: document.membrete?.nombre ?? null,
      membreteEdad: document.membrete?.edad ?? null,
      membreteSexo: document.membrete?.sexo ?? null,
      membreteFechaNacimiento: document.membrete?.fechaNacimiento ?? null,
      membreteFecha: document.membrete?.fecha ?? null,
      doctorId: userId,
      doctorNombre,
      patientFirestoreKey: patientKey,
      sourceDocumentId: document.sourceDocumentId ?? null,
    },
    { merge: true },
  );
}

export async function deleteDocumentCloud(
  id: string,
  meta?: { patientCedula?: string; patientNombre?: string },
): Promise<void> {
  const userId = getProfessionalSession()?.cloudUserId;
  if (!userId) return;
  await deleteDoc(doc(sub(userId, FirestorePaths.SUB_DOCUMENTS), id));
  if (meta?.patientCedula && meta?.patientNombre) {
    try {
      const patientKey = patientFirestoreId(meta.patientCedula, meta.patientNombre);
      await deleteDoc(
        doc(
          getDb(),
          FirestorePaths.GLOBAL_PATIENTS,
          patientKey,
          FirestorePaths.SUB_DOCUMENTS,
          id,
        ),
      );
    } catch {
      /* sin clave global válida */
    }
  }
}

export async function pushDraft(d: ClinicalDraft, userId = userIdOrThrow()): Promise<void> {
  await setDoc(doc(sub(userId, FirestorePaths.SUB_DRAFTS), d.id), {
    id: d.id,
    patientId: d.patientId,
    patientNombre: d.patientNombre,
    patientCedula: d.patientCedula,
    documentType: d.documentType,
    dictation: d.dictation,
    templateId: d.templateId ?? null,
    templateName: d.templateName ?? null,
    headerId: d.headerId ?? null,
    generatedContent: d.generatedContent ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  });
}

export async function deleteDraftCloud(id: string): Promise<void> {
  const userId = getProfessionalSession()?.cloudUserId;
  if (!userId) return;
  await deleteDoc(doc(sub(userId, FirestorePaths.SUB_DRAFTS), id));
}

export function canSync(): boolean {
  return Boolean(getProfessionalSession()?.cloudUserId);
}

/** No bloquea la UI si falla la red. */
export function syncQuiet(fn: () => Promise<void>): void {
  void fn().catch((err) => console.warn("[cloud-sync]", err));
}
