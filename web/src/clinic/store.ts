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
import { authLogin } from "../services/auth-login";
import { normalizeCedula } from "../services/cedula";
import { FirestorePaths, type ClinicalDocument, type DocumentHeader, type DocumentTemplate } from "../shared/models";
import type {
  ClinicDoctorInvitation,
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

function invitationsCol(clinicId: string) {
  return collection(getDb(), FirestorePaths.CLINICS, clinicId, FirestorePaths.SUB_INVITATIONS);
}

function doctorPendingInvitesCol(doctorCedula: string) {
  return collection(
    getDb(),
    FirestorePaths.DOCTOR_INVITES,
    normalizeCedula(doctorCedula),
    "pending",
  );
}

async function writeClinicMembership(input: {
  clinicId: string;
  clinicName: string;
  doctorCedula: string;
  doctorNombre: string;
  cloudUserId?: string;
}): Promise<ClinicMember> {
  const doctorCedula = normalizeCedula(input.doctorCedula);
  const member: ClinicMember = {
    doctorCedula,
    doctorNombre: input.doctorNombre.trim(),
    cloudUserId: input.cloudUserId,
    role: "medico",
    joinedAt: new Date().toISOString(),
  };
  await setDoc(doc(membersCol(input.clinicId), doctorCedula), member as DocumentData);
  if (input.cloudUserId) {
    await setDoc(
      doc(getDb(), FirestorePaths.USERS, input.cloudUserId, "clinic_memberships", input.clinicId),
      {
        clinicId: input.clinicId,
        clinicName: input.clinicName,
        role: "medico",
        joinedAt: member.joinedAt,
      } as DocumentData,
    );
  }
  return member;
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
  if (!input.nombre.trim()) throw new Error("Nombre del centro requerido");

  const { authRegister } = await import("../services/auth-register");
  const data = await authRegister({
    tipo: "clinica",
    nombre: input.nombre.trim(),
    rif,
    correo,
    direccion: (input.direccion ?? "").trim(),
    pin: input.pin,
  });

  return {
    clinicId: data.clinicId || data.uid,
    nombre: data.nombre || input.nombre.trim(),
    rif: data.rif || rif,
    correo: data.correo || correo,
    inviteCode: data.inviteCode || "",
  };
}

export async function loginClinic(rif: string, pin: string): Promise<ClinicSession> {
  assertPin4(pin);
  const auth = await authLogin({ tipo: "clinica", cedula: rif, pin });
  return {
    clinicId: auth.clinicId || auth.uid,
    nombre: auth.nombre || "",
    rif: auth.rif || normalizeRif(rif),
    correo: auth.correo || "",
    inviteCode: auth.inviteCode || "",
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
  const data = inviteSnap.data() || {};
  const clinicId = String(data.clinicId ?? "");
  if (!clinicId) throw new Error("Invitación inválida");
  const clinicName =
    String(data.nombre || "").trim() ||
    (await getClinic(clinicId))?.nombre ||
    "Centro";

  await writeClinicMembership({
    clinicId,
    clinicName,
    doctorCedula: input.doctorCedula,
    doctorNombre: input.doctorNombre,
    cloudUserId: input.cloudUserId,
  });

  return { clinicId, clinicName };
}

/** Clínica invita a un médico por cédula (queda pendiente hasta que acepte). */
export async function inviteDoctorByCedula(input: {
  clinicId: string;
  doctorCedula: string;
  doctorNombreHint?: string;
}): Promise<ClinicDoctorInvitation> {
  const { getIdToken } = await import("../services/firebase-auth");
  const token = await getIdToken(true);
  if (!token) {
    throw new Error("Sesión de centro vencida. Cierre sesión e ingrese de nuevo.");
  }

  const API_BASE = (import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(
    /\/$/,
    "",
  );
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/clinic-invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        clinicId: input.clinicId,
        doctorCedula: input.doctorCedula,
        doctorNombreHint: input.doctorNombreHint,
      }),
    });
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "No se pudo conectar con el servidor");
  }

  const raw = await res.text();
  let data: ClinicDoctorInvitation & { error?: string } = {
    clinicId: "",
    clinicName: "",
    doctorCedula: "",
    doctorNombre: "",
    status: "pending",
    invitedAt: "",
  };
  try {
    data = raw ? JSON.parse(raw) : data;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(data.error || "No se pudo enviar la invitación");
  }
  return data as ClinicDoctorInvitation;
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isInviteExpired(inv: { expiresAt?: string; invitedAt?: string }): boolean {
  if (inv.expiresAt) {
    const exp = Date.parse(inv.expiresAt);
    if (!Number.isNaN(exp)) return Date.now() > exp;
  }
  const invited = Date.parse(inv.invitedAt || "");
  if (!Number.isNaN(invited)) return Date.now() > invited + INVITE_TTL_MS;
  return false;
}

async function purgeExpiredInvite(clinicId: string, doctorCedula: string): Promise<void> {
  const ced = normalizeCedula(doctorCedula);
  if (!clinicId || !ced) return;
  await deleteDoc(doc(invitationsCol(clinicId), ced)).catch(() => undefined);
  await deleteDoc(doc(doctorPendingInvitesCol(ced), clinicId)).catch(() => undefined);
}

export async function listPendingInvitationsForClinic(
  clinicId: string,
): Promise<ClinicDoctorInvitation[]> {
  const snap = await getDocs(invitationsCol(clinicId));
  const out: ClinicDoctorInvitation[] = [];
  for (const d of snap.docs) {
    const inv = d.data() as ClinicDoctorInvitation;
    if (inv.status !== "pending") continue;
    if (isInviteExpired(inv)) {
      await purgeExpiredInvite(clinicId, inv.doctorCedula || d.id);
      continue;
    }
    out.push(inv);
  }
  return out.sort((a, b) => b.invitedAt.localeCompare(a.invitedAt));
}

export async function listPendingInvitationsForDoctor(
  doctorCedula: string,
): Promise<ClinicDoctorInvitation[]> {
  const snap = await getDocs(doctorPendingInvitesCol(doctorCedula));
  const out: ClinicDoctorInvitation[] = [];
  for (const d of snap.docs) {
    const inv = d.data() as ClinicDoctorInvitation;
    if (inv.status !== "pending") continue;
    const clinicId = inv.clinicId || d.id;
    if (isInviteExpired(inv)) {
      await purgeExpiredInvite(clinicId, inv.doctorCedula || doctorCedula);
      continue;
    }
    out.push(inv);
  }
  return out.sort((a, b) => b.invitedAt.localeCompare(a.invitedAt));
}

export async function cancelClinicInvitation(
  clinicId: string,
  doctorCedula: string,
): Promise<void> {
  const ced = normalizeCedula(doctorCedula);
  await deleteDoc(doc(invitationsCol(clinicId), ced));
  await deleteDoc(doc(doctorPendingInvitesCol(ced), clinicId));
}

export async function acceptDoctorInvitation(input: {
  clinicId: string;
  doctorCedula: string;
  doctorNombre: string;
  cloudUserId?: string;
}): Promise<{ clinicId: string; clinicName: string }> {
  const { getIdToken } = await import("../services/firebase-auth");
  const token = await getIdToken(true);
  if (!token) {
    throw new Error("Sesión vencida. Vuelva a iniciar sesión.");
  }
  const API_BASE = (import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(
    /\/$/,
    "",
  );
  const res = await fetch(`${API_BASE}/api/clinic-accept-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: "accept",
      clinicId: input.clinicId,
      doctorCedula: input.doctorCedula,
      doctorNombre: input.doctorNombre,
    }),
  });
  const raw = await res.text();
  let data: { error?: string; clinicId?: string; clinicName?: string } = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(data.error || "No se pudo aceptar la invitación");
  return {
    clinicId: data.clinicId || input.clinicId,
    clinicName: data.clinicName || "Centro",
  };
}

export async function rejectDoctorInvitation(input: {
  clinicId: string;
  doctorCedula: string;
}): Promise<void> {
  const { getIdToken } = await import("../services/firebase-auth");
  const token = await getIdToken(true);
  if (!token) {
    throw new Error("Sesión vencida. Vuelva a iniciar sesión.");
  }
  const API_BASE = (import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(
    /\/$/,
    "",
  );
  const res = await fetch(`${API_BASE}/api/clinic-accept-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: "reject",
      clinicId: input.clinicId,
      doctorCedula: input.doctorCedula,
    }),
  });
  const raw = await res.text();
  let data: { error?: string } = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(data.error || "No se pudo rechazar");
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

export async function listMembershipsForDoctor(
  doctorCedula: string,
  cloudUserId?: string,
  opts?: { forceHeal?: boolean },
): Promise<
  Array<{ clinicId: string; clinicName: string; role: ClinicMemberRole; inviteCode?: string }>
> {
  try {
    const { getIdToken } = await import("../services/firebase-auth");
    const token = await getIdToken(true);
    if (token) {
      const API_BASE = (import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(
        /\/$/,
        "",
      );
      const res = await fetch(`${API_BASE}/api/clinic-memberships`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorCedula: doctorCedula || undefined,
          forceHeal: opts?.forceHeal || undefined,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          memberships?: Array<{ clinicId: string; clinicName: string; role?: string }>;
        };
        return (data.memberships || [])
          .map((m) => ({
            clinicId: m.clinicId,
            clinicName: m.clinicName,
            role: (m.role as ClinicMemberRole) || "medico",
          }))
          .sort((a, b) => a.clinicName.localeCompare(b.clinicName));
      }
    }
  } catch {
    /* fallback abajo */
  }

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

  // Fallback legado: escanear clínicas (puede fallar con rules cerradas)
  const ced = normalizeCedula(doctorCedula);
  try {
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
  } catch {
    return [];
  }
}

export async function listClinicTemplates(clinicId: string): Promise<DocumentTemplate[]> {
  try {
    const { getIdToken } = await import("../services/firebase-auth");
    const token = await getIdToken(true);
    if (token) {
      const API_BASE = (import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(
        /\/$/,
        "",
      );
      const res = await fetch(`${API_BASE}/api/clinic-templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clinicId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { templates?: DocumentTemplate[] };
        return (data.templates || []) as DocumentTemplate[];
      }
    }
  } catch {
    /* fallback */
  }
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
  try {
    const { getIdToken } = await import("../services/firebase-auth");
    const token = await getIdToken(true);
    if (token) {
      const API_BASE = (import.meta.env.VITE_API_BASE || "https://clinicos-doc.vercel.app").replace(
        /\/$/,
        "",
      );
      const res = await fetch(`${API_BASE}/api/clinic-templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clinicId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { headers?: DocumentHeader[] };
        return (data.headers || []) as DocumentHeader[];
      }
    }
  } catch {
    /* fallback */
  }
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
