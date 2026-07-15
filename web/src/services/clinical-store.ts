/** Persistencia local de plantillas, encabezados y documentos (paridad con la app). */
import { DocumentTypeLabels, type ClinicalDocument, type ClinicalDraft, type DocumentHeader, type DocumentTemplate, type DocumentType } from "../shared/models";
import { catalogFor, defaultSectionsFor } from "../shared/section-catalog";
import { PhysicalExamDefaults } from "../shared/physical-exam-defaults";
import { loadJson, saveJson } from "./local-store";
import {
  canSync,
  deleteDraftCloud,
  deleteHeaderCloud,
  pushDocument,
  pushDraft,
  pushHeader,
  pushTemplate,
  syncQuiet,
} from "./cloud-sync";

const KEY_TEMPLATES = "templates";
const KEY_HEADERS = "headers";
const KEY_DOCUMENTS = "documents";
const KEY_DRAFTS = "drafts";

const DOC_TYPES: DocumentType[] = ["historiaClinica", "informe", "reposo"];

function makeDefaultTemplates(): DocumentTemplate[] {
  const stored = loadJson<{ id: string }[]>("physical_exam", []);
  const examIds = (stored.length ? stored : PhysicalExamDefaults).map((s) => s.id);
  return DOC_TYPES.map((type) => ({
    id: crypto.randomUUID(),
    name: `Plantilla ${DocumentTypeLabels[type]}`,
    documentType: type,
    sections: defaultSectionsFor(type),
    isDefault: true,
    enabledPhysicalExamSystemIds: examIds,
  }));
}

export function loadTemplates(): DocumentTemplate[] {
  let list = loadJson<DocumentTemplate[]>(KEY_TEMPLATES, []);
  if (list.length === 0) {
    list = makeDefaultTemplates();
    saveJson(KEY_TEMPLATES, list);
    return list;
  }
  // Asegura una plantilla por tipo + secciones por defecto del informe
  let changed = false;
  const ensured = DOC_TYPES.map((type) => {
    const ofType = list.filter((t) => t.documentType === type);
    let tpl =
      ofType.find((t) => t.isDefault) ?? ofType[0] ?? makeDefaultTemplates().find((t) => t.documentType === type)!;
    if (type === "informe") {
      const defaults = defaultSectionsFor("informe");
      const merged = [...defaults, ...tpl.sections.filter((s) => !defaults.includes(s) && catalogFor("informe").includes(s))];
      if (merged.length !== tpl.sections.length || merged.some((s, i) => s !== tpl.sections[i])) {
        tpl = { ...tpl, sections: merged };
        changed = true;
      }
    }
    return tpl;
  });
  if (changed || ensured.length !== list.length || ensured.some((t, i) => t.id !== list[i]?.id)) {
    saveJson(KEY_TEMPLATES, ensured);
  }
  return ensured;
}

export function saveTemplates(templates: DocumentTemplate[]): void {
  saveJson(KEY_TEMPLATES, templates);
}

export function upsertTemplate(template: DocumentTemplate): DocumentTemplate {
  const all = loadTemplates();
  const next = all.map((t) => (t.documentType === template.documentType ? { ...template, isDefault: true } : t));
  if (!next.some((t) => t.documentType === template.documentType)) next.push(template);
  saveTemplates(next);
  if (canSync()) syncQuiet(() => pushTemplate(template));
  return template;
}

export function templateForType(type: DocumentType): DocumentTemplate {
  return loadTemplates().find((t) => t.documentType === type) ?? makeDefaultTemplates().find((t) => t.documentType === type)!;
}

export function loadHeaders(): DocumentHeader[] {
  let list = loadJson<DocumentHeader[]>(KEY_HEADERS, []);
  if (list.length === 0) {
    list = [
      {
        id: crypto.randomUUID(),
        name: "Encabezado médico",
        doctorName: "",
        subtitle: "",
        description: "",
        isDefault: true,
      },
    ];
    saveJson(KEY_HEADERS, list);
  }
  return list;
}

export function saveHeaders(headers: DocumentHeader[]): void {
  saveJson(KEY_HEADERS, headers.slice(0, 4));
}

export function upsertHeader(header: DocumentHeader): DocumentHeader {
  const all = loadHeaders();
  const idx = all.findIndex((h) => h.id === header.id);
  let next: DocumentHeader[];
  if (idx >= 0) {
    next = [...all];
    next[idx] = header;
  } else {
    next = [...all, header].slice(0, 4);
  }
  if (header.isDefault) {
    next = next.map((h) => ({ ...h, isDefault: h.id === header.id }));
  }
  saveHeaders(next);
  if (canSync()) syncQuiet(() => pushHeader(header));
  return header;
}

export function deleteHeader(id: string): void {
  let next = loadHeaders().filter((h) => h.id !== id);
  if (next.length === 0) {
    next = [
      {
        id: crypto.randomUUID(),
        name: "Encabezado médico",
        doctorName: "",
        subtitle: "",
        description: "",
        isDefault: true,
      },
    ];
  } else if (!next.some((h) => h.isDefault)) {
    next = next.map((h, i) => ({ ...h, isDefault: i === 0 }));
  }
  saveHeaders(next);
  if (canSync()) syncQuiet(() => deleteHeaderCloud(id));
}

export function defaultHeader(): DocumentHeader | undefined {
  const all = loadHeaders();
  return all.find((h) => h.isDefault) ?? all[0];
}

export function loadDocuments(): ClinicalDocument[] {
  return loadJson<ClinicalDocument[]>(KEY_DOCUMENTS, []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveDocument(doc: ClinicalDocument): ClinicalDocument {
  const all = loadDocuments().filter((d) => d.id !== doc.id);
  saveJson(KEY_DOCUMENTS, [doc, ...all]);
  if (canSync()) syncQuiet(() => pushDocument(doc));
  return doc;
}

export function getDocument(id: string): ClinicalDocument | undefined {
  return loadDocuments().find((d) => d.id === id);
}

export function deleteDocument(id: string): void {
  saveJson(
    KEY_DOCUMENTS,
    loadDocuments().filter((d) => d.id !== id),
  );
}

export function loadDrafts(): ClinicalDraft[] {
  return loadJson<ClinicalDraft[]>(KEY_DRAFTS, []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertDraft(draft: ClinicalDraft): ClinicalDraft {
  const all = loadDrafts().filter((d) => d.id !== draft.id);
  saveJson(KEY_DRAFTS, [draft, ...all]);
  if (canSync()) syncQuiet(() => pushDraft(draft));
  return draft;
}

export function getDraft(id: string): ClinicalDraft | undefined {
  return loadDrafts().find((d) => d.id === id);
}

export function deleteDraft(id: string): void {
  saveJson(
    KEY_DRAFTS,
    loadDrafts().filter((d) => d.id !== id),
  );
  if (canSync()) syncQuiet(() => deleteDraftCloud(id));
}
