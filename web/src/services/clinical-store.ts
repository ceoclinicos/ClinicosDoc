/** Persistencia local de plantillas, encabezados y documentos (paridad con la app). */
import { DocumentTypeLabels, type ClinicalDocument, type ClinicalDraft, type DocumentHeader, type DocumentTemplate, type DocumentType } from "../shared/models";
import { defaultSectionsFor, isLegacyInformeAllChecked, normalizeTemplateSections, SectionCatalog } from "../shared/section-catalog";
import { ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT } from "../shared/enfermedad-actual";
import { ORDENES_MOLDE_EJEMPLO, ORDENES_SECTION } from "../shared/ordenes-medicas";
import {
  RECETA_INDICACIONES_SECTION,
  RECETA_MOLDE_INDICACIONES,
  RECETA_MOLDE_RECIPE,
  RECIPE_SECTION,
} from "../shared/receta";
import { PhysicalExamDefaults } from "../shared/physical-exam-defaults";
import { defaultTextForSection } from "./ai/section-defaults";
import { loadExamCatalog, orderEnabledByCatalog } from "./exam-catalog";
import { loadJson, saveJson } from "./local-store";
import {
  canSync,
  deleteDraftCloud,
  deleteDocumentCloud,
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

const DOC_TYPES: DocumentType[] = [
  "historiaClinica",
  "informe",
  "reposo",
  "ordenesMedicas",
  "receta",
];

function defaultExamSystemIds(): string[] {
  return orderEnabledByCatalog(
    PhysicalExamDefaults.map((s) => s.id),
    loadExamCatalog(),
  );
}

function makeDefaultTemplates(): DocumentTemplate[] {
  const examIds = defaultExamSystemIds();
  return DOC_TYPES.map((type) => ({
    id: crypto.randomUUID(),
    name: `Plantilla ${DocumentTypeLabels[type]}`,
    documentType: type,
    sections: defaultSectionsFor(type),
    isDefault: true,
    enabledPhysicalExamSystemIds: examIds,
    enfermedadActualEjemplo:
      type === "informe" || type === "historiaClinica" || type === "reposo"
        ? ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT
        : "",
    sectionDefaultTexts: (type === "ordenesMedicas"
      ? { [ORDENES_SECTION]: ORDENES_MOLDE_EJEMPLO }
      : type === "receta"
        ? {
            [RECIPE_SECTION]: RECETA_MOLDE_RECIPE,
            [RECETA_INDICACIONES_SECTION]: RECETA_MOLDE_INDICACIONES,
          }
        : type === "reposo"
          ? { [SectionCatalog.DIAS_REPOSO]: defaultTextForSection(SectionCatalog.DIAS_REPOSO) }
          : undefined) as Record<string, string> | undefined,
  }));
}

export function loadTemplates(): DocumentTemplate[] {
  let list = loadJson<DocumentTemplate[]>(KEY_TEMPLATES, []);
  if (list.length === 0) {
    list = makeDefaultTemplates();
    saveJson(KEY_TEMPLATES, list);
    return list;
  }
  let changed = false;
  const ensured = DOC_TYPES.map((type) => {
    const ofType = list.filter((t) => t.documentType === type);
    let tpl =
      ofType.find((t) => t.isDefault) ?? ofType[0] ?? makeDefaultTemplates().find((t) => t.documentType === type)!;
    // Migración: plantillas que tenían todo el catálogo del informe (legado) → defaults nuevos
    if (type === "informe" && isLegacyInformeAllChecked(tpl.sections)) {
      tpl = { ...tpl, sections: defaultSectionsFor("informe") };
      changed = true;
    } else {
      const normalized = normalizeTemplateSections(type, tpl.sections);
      if (normalized.length !== tpl.sections.length || normalized.some((s, i) => s !== tpl.sections[i])) {
        tpl = { ...tpl, sections: normalized };
        changed = true;
      }
    }
    if (type === "ordenesMedicas") {
      const texts = { ...(tpl.sectionDefaultTexts ?? {}) };
      const hasMolde = Object.keys(texts).some((k) => k.toLowerCase() === ORDENES_SECTION.toLowerCase());
      if (!hasMolde) {
        texts[ORDENES_SECTION] = ORDENES_MOLDE_EJEMPLO;
        tpl = {
          ...tpl,
          sections: defaultSectionsFor("ordenesMedicas"),
          sectionDefaultTexts: texts,
        };
        changed = true;
      }
    }
    if (type === "receta") {
      const texts = { ...(tpl.sectionDefaultTexts ?? {}) };
      let seeded = false;
      if (!Object.keys(texts).some((k) => k.toLowerCase() === RECIPE_SECTION.toLowerCase())) {
        texts[RECIPE_SECTION] = RECETA_MOLDE_RECIPE;
        seeded = true;
      }
      if (
        !Object.keys(texts).some((k) => k.toLowerCase() === RECETA_INDICACIONES_SECTION.toLowerCase())
      ) {
        texts[RECETA_INDICACIONES_SECTION] = RECETA_MOLDE_INDICACIONES;
        seeded = true;
      }
      if (seeded) {
        tpl = {
          ...tpl,
          sections: defaultSectionsFor("receta"),
          sectionDefaultTexts: texts,
        };
        changed = true;
      }
    }
    if (type === "reposo") {
      const defaults = defaultSectionsFor("reposo");
      const missingCore = defaults.some(
        (d) => !tpl.sections.some((s) => s.toLowerCase() === d.toLowerCase()),
      );
      const texts = { ...(tpl.sectionDefaultTexts ?? {}) };
      const diasKey = Object.keys(texts).find(
        (k) => k.toLowerCase() === SectionCatalog.DIAS_REPOSO.toLowerCase(),
      );
      const diasVal = (diasKey ? texts[diasKey] : "")?.trim() ?? "";
      const needsDiasText =
        !diasVal ||
        diasVal.toLowerCase() === "días de reposo a indicar según criterio médico.".toLowerCase();
      if (missingCore || needsDiasText) {
        if (needsDiasText) {
          if (diasKey) delete texts[diasKey];
          texts[SectionCatalog.DIAS_REPOSO] = defaultTextForSection(SectionCatalog.DIAS_REPOSO);
        }
        tpl = {
          ...tpl,
          sections: missingCore ? defaults : tpl.sections,
          sectionDefaultTexts: texts,
          enabledPhysicalExamSystemIds:
            tpl.enabledPhysicalExamSystemIds?.length
              ? tpl.enabledPhysicalExamSystemIds
              : defaultExamSystemIds(),
          enfermedadActualEjemplo:
            tpl.enfermedadActualEjemplo?.trim() || ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT,
        };
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
  const normalized: DocumentTemplate = {
    ...template,
    enabledPhysicalExamSystemIds: orderEnabledByCatalog(
      template.enabledPhysicalExamSystemIds ?? [],
      loadExamCatalog(),
    ),
  };
  const all = loadTemplates();
  const next = all.map((t) =>
    t.documentType === normalized.documentType ? { ...normalized, isDefault: true } : t,
  );
  if (!next.some((t) => t.documentType === normalized.documentType)) next.push(normalized);
  saveTemplates(next);
  if (canSync()) syncQuiet(() => pushTemplate(normalized));
  return normalized;
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
  const existing = getDocument(id);
  saveJson(
    KEY_DOCUMENTS,
    loadDocuments().filter((d) => d.id !== id),
  );
  if (canSync()) {
    syncQuiet(() =>
      deleteDocumentCloud(id, {
        patientCedula: existing?.patientCedula,
        patientNombre: existing?.patientNombre,
      }),
    );
  }
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
