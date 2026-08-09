import type { DocumentHeader, DocumentTemplate } from "../shared/models";

export interface ClinicRegistro {
  id: string;
  nombre: string;
  /** RIF o código fiscal — también es la clave de login */
  rif: string;
  correo: string;
  direccion: string;
  pinHash: string;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicSession {
  clinicId: string;
  nombre: string;
  rif: string;
  correo: string;
  inviteCode: string;
}

export type ClinicMemberRole = "medico" | "admin";

export interface ClinicMember {
  doctorCedula: string;
  doctorNombre: string;
  cloudUserId?: string;
  role: ClinicMemberRole;
  joinedAt: string;
}

export type ClinicInviteStatus = "pending" | "accepted" | "rejected";

export interface ClinicDoctorInvitation {
  clinicId: string;
  clinicName: string;
  doctorCedula: string;
  doctorNombre: string;
  cloudUserId?: string;
  status: ClinicInviteStatus;
  invitedAt: string;
  /** Si no acepta antes, se elimina sola de la lista. */
  expiresAt?: string;
}

/** Paciente agregado desde documentos de la clínica (sin duplicar ficha). */
export interface ClinicPatientRow {
  patientCedula: string;
  patientNombre: string;
  lastDocumentAt: string;
  documentCount: number;
}

export type ClinicTemplate = DocumentTemplate;
export type ClinicHeader = DocumentHeader;
