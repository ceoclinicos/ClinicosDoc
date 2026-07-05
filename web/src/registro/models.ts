/** Colecciones Firestore — registro médico compartido (sin mezclar con consultorio). */
export const RegistroPaths = {
  PACIENTES: "pacientes",
  PROFESIONALES: "profesionales",
  ATENCIONES: "atenciones",
} as const;

export interface PacienteRegistro {
  cedula: string;
  nombre: string;
  edad: number;
  fechaNacimiento: string;
  sexo?: string;
  pinHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfesionalRegistro {
  cedula: string;
  nombre: string;
  especialidad: string;
  esMedicoGeneral: boolean;
  mpps: string;
  pinHash: string;
  activo: boolean;
  createdAt: string;
}

export interface AtencionRegistro {
  id: string;
  patientCedula: string;
  patientNombre: string;
  professionalCedula: string;
  professionalNombre: string;
  especialidad: string;
  mpps: string;
  motivo: string;
  notas: string;
  diagnostico?: string;
  lugarAtencion?: string;
  createdAt: string;
}

export interface ProfesionalSession {
  cedula: string;
  nombre: string;
  especialidad: string;
  esMedicoGeneral: boolean;
  mpps: string;
}

export interface PacienteSession {
  cedula: string;
  nombre: string;
}
