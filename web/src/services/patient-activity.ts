/** Filas de pacientes con último diagnóstico (para Home / Pacientes). */
import { loadJson } from "./local-store";
import { loadDocuments } from "./clinical-store";
import { parseDocumentSections } from "./document-parser";
import { normalizeCedula } from "./cedula";
import { formatDocumentDateTime } from "../shared/clinical-datetime";
import { DocumentTypesInformes, type ClinicalDocument, type Patient } from "../shared/models";

export type PatientActivityRow = {
  key: string;
  patientId: string;
  patientCedula: string;
  patientNombre: string;
  edad: string;
  diagnostico: string;
  lastAt: string;
  lastAtLabel: string;
  docCount: number;
};

function loadPatients(): Patient[] {
  return loadJson<Patient[]>("patients", []);
}

export function extractDiagnosticoPreview(content: string): string {
  const sections = parseDocumentSections(content || "");
  const dx = sections.find((s) =>
    /diagn[oó]stico|impresi[oó]n\s+diagn/i.test(String(s.title || "")),
  );
  let raw = (dx?.body || "").trim();
  if (!raw) return "Sin diagnóstico";
  raw = raw.replace(/\*\*(.+?)\*\*/g, "$1");
  const firstLine = raw.split(/\n/).map((l) => l.trim()).find(Boolean) || "";
  let cleaned = firstLine
    .replace(/^\d+[\).\-\s]+/, "")
    .replace(/^(diagnóstico|impresión diagnóstica)\s*:?\s*/i, "")
    .trim();
  if (cleaned.includes(";")) cleaned = cleaned.split(";")[0].trim();
  if (!cleaned) cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Sin diagnóstico";
  return cleaned.length > 100 ? `${cleaned.slice(0, 100)}…` : cleaned;
}

function patientKey(doc: ClinicalDocument): string {
  const ced = normalizeCedula(doc.patientCedula || "");
  if (ced) return `c:${ced}`;
  if (doc.patientId) return `id:${doc.patientId}`;
  return `n:${(doc.patientNombre || "").trim().toLowerCase()}`;
}

/**
 * Pacientes con al menos un informe/historia, ordenados por actividad reciente.
 */
export function buildPatientActivityRows(): PatientActivityRow[] {
  const docs = loadDocuments().filter((d) => DocumentTypesInformes.includes(d.type));
  const patients = loadPatients();
  const byCedula = new Map(patients.map((p) => [normalizeCedula(p.cedula), p]));
  const byId = new Map(patients.map((p) => [p.id, p]));

  type Acc = {
    key: string;
    patientId: string;
    patientCedula: string;
    patientNombre: string;
    edad: string;
    diagnostico: string;
    lastAt: string;
    lastAtLabel: string;
    docCount: number;
  };
  const map = new Map<string, Acc>();

  for (const doc of docs) {
    const key = patientKey(doc);
    const existing = map.get(key);
    const ced = normalizeCedula(doc.patientCedula || "");
    const patient = (ced && byCedula.get(ced)) || byId.get(doc.patientId);
    const edadFromPatient = patient?.edad != null && patient.edad > 0 ? String(patient.edad) : "";
    const edadFromMembrete = (doc.membrete?.edad || "").trim();
    const edad = edadFromPatient || edadFromMembrete || "—";
    const dx = extractDiagnosticoPreview(doc.content);

    if (!existing) {
      map.set(key, {
        key,
        patientId: patient?.id || doc.patientId || "",
        patientCedula: ced || doc.patientCedula || "",
        patientNombre: patient?.nombre || doc.patientNombre || "Paciente",
        edad,
        diagnostico: dx,
        lastAt: doc.createdAt,
        lastAtLabel: formatDocumentDateTime(doc.createdAt),
        docCount: 1,
      });
      continue;
    }
    existing.docCount += 1;
    if (doc.createdAt > existing.lastAt) {
      existing.lastAt = doc.createdAt;
      existing.lastAtLabel = formatDocumentDateTime(doc.createdAt);
      existing.diagnostico = dx;
      existing.patientNombre = patient?.nombre || doc.patientNombre || existing.patientNombre;
      if (edad !== "—") existing.edad = edad;
    }
  }

  return [...map.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function documentsForPatient(cedulaOrId: string): ClinicalDocument[] {
  const q = cedulaOrId.trim();
  if (!q) return [];
  const ced = normalizeCedula(q);
  return loadDocuments().filter((d) => {
    if (ced && normalizeCedula(d.patientCedula) === ced) return true;
    if (d.patientId && d.patientId === q) return true;
    return false;
  });
}
