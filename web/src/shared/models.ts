/** Rutas Firestore — mismo esquema que la app Android. */
export const FirestorePaths = {
  USERS: "clinicosdoc_user",
  SUB_PATIENTS: "patients",
  SUB_DOCUMENTS: "documents",
  SUB_APPOINTMENTS: "appointments",
  SUB_TEMPLATES: "templates",
  SUB_HEADERS: "headers",
  SUB_PHYSICAL_EXAM: "physical_exam_systems",
} as const;

export type DocumentType = "historiaClinica" | "informe" | "reposo";

export const DocumentTypeLabels: Record<DocumentType, string> = {
  historiaClinica: "Historia clínica",
  informe: "Informe",
  reposo: "Reposo",
};

export interface Patient {
  id: string;
  nombre: string;
  cedula: string;
  edad: number;
  sexo: string;
  fechaNacimiento: string;
  createdAt: string;
  whatsapp?: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  documentType: DocumentType;
  sections: string[];
  isDefault: boolean;
  enabledPhysicalExamSystemIds: string[];
}

export interface PhysicalExamSystem {
  id: string;
  name: string;
  defaultText: string;
  sortOrder: number;
}

export interface DocumentHeader {
  id: string;
  name: string;
  logoPath?: string;
  doctorName?: string;
  subtitle?: string;
  description?: string;
  isDefault: boolean;
}

export interface ClinicalDocument {
  id: string;
  patientId: string;
  patientNombre: string;
  patientCedula: string;
  type: DocumentType;
  content: string;
  rawDictation: string;
  createdAt: string;
  templateId?: string;
  templateName?: string;
  headerId?: string;
}

export interface ClinicalDraft {
  id: string;
  patientId: string;
  patientNombre: string;
  patientCedula: string;
  documentType: DocumentType;
  dictation: string;
  templateId?: string;
  templateName?: string;
  headerId?: string;
  generatedContent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorProfile {
  id: string;
  nombre: string;
  especialidad: string;
  saludo: string;
}
