/** Crea un INFORME desde una historia/informe copiando secciones verbatim (paridad InformeFromCase.kt). */
import { SectionCatalog, normalizeTemplateSections } from "../shared/section-catalog";
import { parseDocumentSections, serializeDocumentSections } from "./document-parser";
import { defaultTextForSection } from "./ai/section-defaults";
import { saveDocument, templateForType } from "./clinical-store";
import { buildMembreteFromPatient } from "./document-pdf";
import { loadSello } from "./sello-store";
import { loadJson } from "./local-store";
import type { ClinicalDocument, Patient } from "../shared/models";

const IS_DX_TITLE = /diagn[oó]stico/i;

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function titlesMatch(sourceTitle: string, wantedTitle: string): boolean {
  const a = norm(sourceTitle);
  const b = norm(wantedTitle);
  if (a === b) return true;
  // "Diagnóstico" ↔ "Impresión diagnóstica"
  return IS_DX_TITLE.test(a) && IS_DX_TITLE.test(b);
}

function informeTemplate() {
  return templateForType("informe");
}

export function buildInformeContent(sourceContent: string): string {
  const srcSections = parseDocumentSections(sourceContent);
  const template = informeTemplate();
  const wanted = (template.sections.length
    ? normalizeTemplateSections("informe", template.sections)
    : normalizeTemplateSections("informe", [])
  ).filter((s) => norm(s) !== norm(SectionCatalog.DATOS_PACIENTE));
  const defaults = template.sectionDefaultTexts ?? {};
  const sections = wanted.map((title) => {
    const body =
      srcSections.find((s) => titlesMatch(s.title, title))?.body.trim() ||
      defaultTextForSection(title, defaults);
    return { id: crypto.randomUUID(), title, body };
  });
  return serializeDocumentSections(sections);
}

/** Crea y guarda el informe; devuelve el documento listo para abrir en detalle. */
export function createInformeFromCase(source: ClinicalDocument): ClinicalDocument {
  const template = informeTemplate();
  const patient = loadJson<Patient[]>("patients", []).find((p) => p.id === source.patientId);
  const doc: ClinicalDocument = {
    id: crypto.randomUUID(),
    patientId: source.patientId,
    patientNombre: source.patientNombre,
    patientCedula: source.patientCedula,
    type: "informe",
    content: buildInformeContent(source.content),
    rawDictation: "",
    createdAt: new Date().toISOString(),
    templateId: template.id,
    templateName: template.name,
    headerId: source.headerId,
    headerSnapshot: source.headerSnapshot,
    membrete: patient
      ? buildMembreteFromPatient(patient)
      : source.membrete,
    sourceDocumentId: source.id,
    clinicId: source.clinicId,
    clinicName: source.clinicName,
    doctorNombre: source.doctorNombre,
    incluirSello: source.incluirSello,
    selloBase64: source.selloBase64 ?? loadSello()?.base64,
    selloOffsetX: source.selloOffsetX,
    selloOffsetY: source.selloOffsetY,
  };
  return saveDocument(doc);
}
