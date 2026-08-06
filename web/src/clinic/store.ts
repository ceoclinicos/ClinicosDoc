import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "../registro/firebase";
import { hashPin } from "../registro/session";
import { normalizeCedula } from "../services/cedula";
import { FirestorePaths, type ClinicalDocument, type DocumentHeader, type DocumentTemplate } from "../shared/models";
import type {
  ClinicMember,
  ClinicMemberRole,
  ClinicPatientRow,
  ClinicRegistro,
  ClinicSession,
} from "./models";

function assertPin4(pin: string): void {
  if (!/^\d{4}$/.test(pin)) throw new Error("El PIN debe tener exactamente 4 dígitos");
}

function normalizeRif(rif: string): string {
  return rif.trim().toUpperCase().replace(/[\s.-]/g, "");
}

function clinicRef(id: string) {
  return doc(getDb(), FirestorePaths.CLINICS, id);
}

function membersCol(clinicId: string) {
  return collection(getDb(), FirestorePaths.CLINICS, clinicId, FirestorePaths.SUB_MEMBERS);
}

function templatesCol(clinicId: string) {
  return collection(getDb(), FirestorePaths.CLINICS, clinicId, FirestorePaths.SUB_TEMPLATES);
}

function headersCol(clinicId: string) {
  return collection(getDb(), FirestorePaths.CLINICS, clinicId, FirestorePaths.SUB_HEADERS);
}

function documentsCol(clinicId: string) {
  return collection(getDb(), FirestorePaths.CLINICS, clinicId, FirestorePaths.SUB_DOCUMENTS);
}

function inviteRef(code: string) {
  return doc(getDb(), FirestorePaths.CLINIC_INVITES, code.toUpperCase());
}

function makeInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

function makeClinicId(rif: string): string {
  return `clinic_${normalizeRif(rif).toLowerCase()}`;
}

export async function getClinicByRif(rif: string): Promise<ClinicRegistro | null> {
  const id = makeClinicId(rif);
  const snap = await getDoc(clinicRef(id));
  if (!snap.exists()) return null;
  return snap.data() as ClinicRegistro;
}

export async function getClinic(clinicId: string): Promise<ClinicRegistro | null> {
  const snap = await getDoc(clinicRef(clinicId));
  if (!snap.exists()) return null;
  return snap.data() as ClinicRegistro;
}

export async function registerClinic(input: {
  nombre: string;
  rif: string;
  correo: string;
  direccion?: string;
  pin: string;
}): Promise<ClinicSession> {
  assertPin4(input.pin);
  const rif = normalizeRif(input.rif);
  if (rif.length < 5) throw new Error("Indique un RIF o código de centro válido");
  const correo = input.correo.trim();
  if (!correo.includes("@")) throw new Error("Correo electrónico requerido");

  const existing = await getClinicByRif(rif);
  if (existing) throw new Error("Ya existe un centro registrado con ese RIF");

  let inviteCode = makeInviteCode();
  for (let i = 0; i < 5; i++) {
    const taken = await getDoc(inviteRef(inviteCode));
    if (!taken.exists()) break;
    inviteCode = makeInviteCode();
  }

  const now = new Date().toISOString();
  const id = makeClinicId(rif);
  const data: ClinicRegistro = {
    id,
    nombre: input.nombre.trim(),
    rif,
    correo,
    direccion: (input.direccion ?? "").trim(),
    pinHash: await hashPin(rif, input.pin),
    inviteCode,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(clinicRef(id), data as DocumentData);
  await setDoc(inviteRef(inviteCode), {
    clinicId: id,
    nombre: data.nombre,
    createdAt: now,
  });

  return {
    clinicId: id,
    nombre: data.nombre,
    rif: data.rif,
    correo: data.correo,
    inviteCode: data.inviteCode,
  };
}

export async function loginClinic(rif: string, pin: string): Promise<ClinicSession> {
  assertPin4(pin);
  const clinic = await getClinicByRif(rif);
  if (!clinic) throw new Error("No hay centro registrado con ese RIF");
  const pinHash = await hashPin(clinic.rif, pin);
  if (clinic.pinHash !== pinHash) throw new Error("PIN incorrecto");
  return {
    clinicId: clinic.id,
    nombre: clinic.nombre,
    rif: clinic.rif,
    correo: clinic.correo,
    inviteCode: clinic.inviteCode,
  };
}

export async function regenerateInviteCode(clinicId: string): Promise<string> {
  const clinic = await getClinic(clinicId);
  if (!clinic) throw new Error("Centro no encontrado");

  const old = clinic.inviteCode;
  let inviteCode = makeInviteCode();
  for (let i = 0; i < 5; i++) {
    const taken = await getDoc(inviteRef(inviteCode));
    if (!taken.exists()) break;
    inviteCode = makeInviteCode();
  }

  if (old) {
    try {
      await deleteDoc(inviteRef(old));
    } catch {
      /* ignore */
    }
  }

  const updatedAt = new Date().toISOString();
  await setDoc(
    clinicRef(clinicId),
    { inviteCode, updatedAt } as DocumentData,
    { merge: true },
  );
  await setDoc(inviteRef(inviteCode), {
    clinicId,
    nombre: clinic.nombre,
    createdAt: updatedAt,
  });
  return inviteCode;
}

export async function joinClinicByInvite(input: {
  inviteCode: string;
  doctorCedula: string;
  doctorNombre: string;
  cloudUserId?: string;
}): Promise<{ clinicId: string; clinicName: string }> {
  const code = input.inviteCode.trim().toUpperCase();
  if (code.length < 4) throw new Error("Código de invitación inválido");
  const inviteSnap = await getDoc(inviteRef(code));
  if (!inviteSnap.exists()) throw new Error("Código no válido o vencido");
  const clinicId = String(inviteSnap.data()?.clinicId ?? "");
  const clinic = await getClinic(clinicId);
  if (!clinic) throw new Error("Centro no encontrado");

  const doctorCedula = normalizeCedula(input.doctorCedula);
  const member: ClinicMember = {
    doctorCedula,
    doctorNombre: input.doctorNombre.trim(),
    cloudUserId: input.cloudUserId,
    role: "medico",
    joinedAt: new Date().toISOString(),
  };
  await setDoc(doc(membersCol(clinicId), doctorCedula), member as DocumentData);

  if (input.cloudUserId) {
    await setDoc(
      doc(
        getDb(),
        FirestorePaths.USERS,
        input.cloudUserId,
        "clinic_memberships",
        clinicId,
      ),
      {
        clinicId,
        clinicName: clinic.nombre,
        role: "medico",
        joinedAt: member.joinedAt,
      } as DocumentData,
    );
  }

  return { clinicId, clinicName: clinic.nombre };
}

export async function listClinicMembers(clinicId: string): Promise<ClinicMember[]> {
  const snap = await getDocs(membersCol(clinicId));
  return snap.docs
    .map((d) => d.data() as ClinicMember)
    .sort((a, b) => a.doctorNombre.localeCompare(b.doctorNombre));
}

export async function removeClinicMember(
  clinicId: string,
  doctorCedula: string,
  cloudUserId?: string,
): Promise<void> {
  const ced = normalizeCedula(doctorCedula);
  await deleteDoc(doc(membersCol(clinicId), ced));
  if (cloudUserId) {
    await deleteDoc(
      doc(getDb(), FirestorePaths.USERS, cloudUserId, "clinic_memberships", clinicId),
    );
  }
}

export async function listMembershipsForDoctor(doctorCedula: string, cloudUserId?: string): Promise<
  Array<{ clinicId: string; clinicName: string; role: ClinicMemberRole; inviteCode?: string }>
> {
  if (cloudUserId) {
    const snap = await getDocs(
      collection(getDb(), FirestorePaths.USERS, cloudUserId, "clinic_memberships"),
    );
    if (!snap.empty) {
      return snap.docs
        .map((d) => {
          const data = d.data();
          return {
            clinicId: String(data.clinicId ?? d.id),
            clinicName: String(data.clinicName ?? "Centro"),
            role: (data.role as ClinicMemberRole) || "medico",
          };
        })
        .sort((a, b) => a.clinicName.localeCompare(b.clinicName));
    }
  }

  // Fallback: escanear clínicas (MVP / cuentas antiguas)
  const ced = normalizeCedula(doctorCedula);
  const clinicsSnap = await getDocs(collection(getDb(), FirestorePaths.CLINICS));
  const out: Array<{ clinicId: string; clinicName: string; role: ClinicMemberRole; inviteCode?: string }> = [];
  for (const c of clinicsSnap.docs) {
    const memberSnap = await getDoc(doc(membersCol(c.id), ced));
    if (!memberSnap.exists()) continue;
    const clinic = c.data() as ClinicRegistro;
    const member = memberSnap.data() as ClinicMember;
    out.push({
      clinicId: clinic.id,
      clinicName: clinic.nombre,
      role: member.role,
      inviteCode: clinic.inviteCode,
    });
  }
  return out.sort((a, b) => a.clinicName.localeCompare(b.clinicName));
}

export async function listClinicTemplates(clinicId: string): Promise<DocumentTemplate[]> {
  const snap = await getDocs(templatesCol(clinicId));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: String(data.id ?? d.id),
      name: String(data.name ?? "Plantilla"),
      documentType: data.documentType,
      sections: Array.isArray(data.sections) ? data.sections.map(String) : [],
      isDefault: Boolean(data.isDefault),
      enabledPhysicalExamSystemIds: Array.isArray(data.enabledPhysicalExamSystemIds)
        ? data.enabledPhysicalExamSystemIds.map(String)
        : [],
      enfermedadActualEjemplo: data.enfermedadActualEjemplo
        ? String(data.enfermedadActualEjemplo)
        : undefined,
      sectionDefaultTexts:
        data.sectionDefaultTexts && typeof data.sectionDefaultTexts === "object"
          ? (data.sectionDefaultTexts as Record<string, string>)
          : undefined,
    } as DocumentTemplate;
  });
}

export async function upsertClinicTemplate(
  clinicId: string,
  template: DocumentTemplate,
): Promise<DocumentTemplate> {
  await setDoc(doc(templatesCol(clinicId), template.id), {
    ...template,
    updatedAt: new Date().toISOString(),
  } as DocumentData);
  return template;
}

export async function deleteClinicTemplate(clinicId: string, templateId: string): Promise<void> {
  await deleteDoc(doc(templatesCol(clinicId), templateId));
}

export async function listClinicHeaders(clinicId: string): Promise<DocumentHeader[]> {
  const snap = await getDocs(headersCol(clinicId));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: String(data.id ?? d.id),
      name: String(data.name ?? "Encabezado"),
      logoPath: data.logoPath ? String(data.logoPath) : undefined,
      logoBase64: data.logoBase64 ? String(data.logoBase64) : undefined,
      doctorName: data.doctorName ? String(data.doctorName) : "",
      subtitle: data.subtitle ? String(data.subtitle) : "",
      description: data.description ? String(data.description) : "",
      isDefault: Boolean(data.isDefault),
    } as DocumentHeader;
  });
}

export async function upsertClinicHeader(clinicId: string, header: DocumentHeader): Promise<DocumentHeader> {
  if (header.isDefault) {
    const all = await listClinicHeaders(clinicId);
    await Promise.all(
      all
        .filter((h) => h.id !== header.id && h.isDefault)
        .map((h) =>
          setDoc(doc(headersCol(clinicId), h.id), { ...h, isDefault: false } as DocumentData, {
            merge: true,
          }),
        ),
    );
  }
  await setDoc(doc(headersCol(clinicId), header.id), {
    ...header,
    updatedAt: new Date().toISOString(),
  } as DocumentData);
  return header;
}

export async function deleteClinicHeader(clinicId: string, headerId: string): Promise<void> {
  await deleteDoc(doc(headersCol(clinicId), headerId));
}

export async function pushClinicDocument(
  clinicId: string,
  document: ClinicalDocument,
  doctorNombre: string,
): Promise<void> {
  await setDoc(doc(documentsCol(clinicId), document.id), {
    id: document.id,
    patientId: document.patientId,
    patientNombre: document.patientNombre,
    patientCedula: normalizeCedula(document.patientCedula),
    type: document.type,
    content: document.content,
    rawDictation: document.rawDictation,
    createdAt: document.createdAt,
    templateId: document.templateId ?? null,
    templateName: document.templateName ?? null,
    headerId: document.headerId ?? null,
    headerSnapshot: document.headerSnapshot ?? null,
    membrete: document.membrete ?? null,
    sourceDocumentId: document.sourceDocumentId ?? null,
    clinicId,
    clinicName: document.clinicName ?? null,
    doctorNombre,
  } as DocumentData);
}

export async function listClinicPatientRows(clinicId: string): Promise<ClinicPatientRow[]> {
  const snap = await getDocs(documentsCol(clinicId));
  const map = new Map<string, ClinicPatientRow>();
  for (const d of snap.docs) {
    const data = d.data();
    const cedula = String(data.patientCedula ?? "").trim();
    if (!cedula) continue;
    const key = normalizeCedula(cedula);
    const createdAt = String(data.createdAt ?? "");
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        patientCedula: key,
        patientNombre: String(data.patientNombre ?? "Paciente"),
        lastDocumentAt: createdAt,
        documentCount: 1,
      });
    } else {
      existing.documentCount += 1;
      if (createdAt > existing.lastDocumentAt) {
        existing.lastDocumentAt = createdAt;
        existing.patientNombre = String(data.patientNombre ?? existing.patientNombre);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.lastDocumentAt.localeCompare(a.lastDocumentAt));
}

export async function listClinicDocumentsForPatient(
  clinicId: string,
  patientCedula: string,
): Promise<ClinicalDocument[]> {
  const ced = normalizeCedula(patientCedula);
  const all = await getDocs(documentsCol(clinicId));
  const docs = all.docs
    .map((d) => {
      const data = d.data();
      return {
        id: String(data.id ?? d.id),
        patientId: String(data.patientId ?? ""),
        patientNombre: String(data.patientNombre ?? ""),
        patientCedula: String(data.patientCedula ?? ""),
        type: data.type,
        content: String(data.content ?? ""),
        rawDictation: String(data.rawDictation ?? ""),
        createdAt: String(data.createdAt ?? ""),
        templateId: data.templateId ? String(data.templateId) : undefined,
        templateName: data.templateName ? String(data.templateName) : undefined,
        headerId: data.headerId ? String(data.headerId) : undefined,
        headerSnapshot: data.headerSnapshot as ClinicalDocument["headerSnapshot"],
        membrete: data.membrete as ClinicalDocument["membrete"],
        sourceDocumentId: data.sourceDocumentId ? String(data.sourceDocumentId) : undefined,
        clinicId: data.clinicId ? String(data.clinicId) : clinicId,
        clinicName: data.clinicName ? String(data.clinicName) : undefined,
        doctorNombre: data.doctorNombre ? String(data.doctorNombre) : undefined,
      } as ClinicalDocument;
    })
    .filter((x) => normalizeCedula(x.patientCedula) === ced);
  return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
