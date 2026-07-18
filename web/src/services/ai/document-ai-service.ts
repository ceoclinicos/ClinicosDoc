import { DocumentTypeLabels } from "../../shared/models";
import type { DocumentTemplate, DocumentType, Patient } from "../../shared/models";
import { SectionCatalog, defaultSectionsFor } from "../../shared/section-catalog";
import {
  enfermedadActualPromptBlock,
  resolveEnfermedadActualEjemplo,
} from "../../shared/enfermedad-actual";
import { ensureTemplateSections } from "../ensure-sections";
import { sendPrompt } from "./ai-service";
import { sanitizeDocumentContent, ensurePhysicalExamSystems } from "./document-sanitizer";
import { buildPhysicalExamBlock, resolveSystemsForReport } from "./physical-exam-prompt";
import { MOTIVO_CONSULTA_STYLE, sectionDefaultsPromptBlock } from "./section-defaults";
import { ORDENES_SECTION, ordenesMedicasPromptBlock, type OrdenesModo } from "../../shared/ordenes-medicas";
import {
  RECETA_INDICACIONES_SECTION,
  RECETA_MOLDE_INDICACIONES,
  RECETA_MOLDE_RECIPE,
  RECIPE_SECTION,
  recetaPromptBlock,
  type RecetaFuente,
} from "../../shared/receta";
import { templateForType } from "../clinical-store";
import { parseDocumentSections, serializeDocumentSections } from "../document-parser";

export interface DoctorInfo {
  nombre: string;
  especialidad: string;
}

export function defaultTemplateFor(type: DocumentType): DocumentTemplate {
  return {
    id: `default-${type}`,
    name: DocumentTypeLabels[type],
    documentType: type,
    sections: defaultSectionsFor(type),
    isDefault: true,
    enabledPhysicalExamSystemIds: [],
  };
}

export function clinicalSectionsOf(template: DocumentTemplate): string[] {
  const secs = template.sections.filter(
    (s) => s.toLowerCase() !== SectionCatalog.DATOS_PACIENTE.toLowerCase(),
  );
  if (secs.length) return secs;
  if (template.documentType === "informe") {
    return [
      SectionCatalog.MOTIVO_CONSULTA,
      SectionCatalog.ENFERMEDAD_ACTUAL,
      SectionCatalog.EXAMEN_FISICO,
      SectionCatalog.DIAGNOSTICO,
    ];
  }
  return defaultSectionsFor(template.documentType).filter(
    (s) => s.toLowerCase() !== SectionCatalog.DATOS_PACIENTE.toLowerCase(),
  );
}

export async function generateDocument(options: {
  template: DocumentTemplate;
  patient: Patient;
  doctor: DoctorInfo;
  dictation: string;
}): Promise<string> {
  const { template, patient, doctor, dictation } = options;
  const systems = resolveSystemsForReport(template);
  const physicalExamBlock = buildPhysicalExamBlock(template);
  const effective = clinicalSectionsOf(template);

  const system = `
Eres un asistente médico que redacta y mejora documentos clínicos en español.
Tu trabajo es transformar el dictado del médico en un texto profesional, claro y legible.
Corrige ortografía, gramática y puntuación.
Convierte expresiones coloquiales a terminología médica equivalente, sin cambiar el significado clínico.
Organiza el contenido en párrafos fluidos y coherentes.
En INFORME MÉDICO / HISTORIA: el examen físico DEBE incluir TODOS los sistemas activos de la plantilla.
Si el dictado solo menciona un sistema (ej. Extremidades), ese se adapta y LOS DEMÁS se copian con su texto base normal sin omitirlos.
No inventes hallazgos clínicos patológicos que contradigan el dictado.
OBLIGATORIO: cada sección empieza con una línea exacta [[SECTION:Nombre]] (sin excepciones).
PROHIBIDO empezar con un párrafo sin marcador [[SECTION:]].
Usa terminología médica apropiada para Venezuela/Latinoamérica.`.trim();

  const prompt = buildPrompt(template, patient, doctor, dictation, physicalExamBlock, effective);
  const raw = await sendPrompt({ prompt, systemMessage: system, maxTokens: 4096 });
  const sanitized = sanitizeDocumentContent(raw, systems);
  const withExam = ensurePhysicalExamSystems(sanitized, systems);
  return ensureTemplateSections(withExam, effective);
}

function buildPrompt(
  template: DocumentTemplate,
  patient: Patient,
  doctor: DoctorInfo,
  dictation: string,
  physicalExamBlock: string,
  effective: string[],
): string {
  const typeLabel = DocumentTypeLabels[template.documentType];
  const lines: string[] = [
    `Genera el cuerpo clínico usando la plantilla "${template.name}" (${typeLabel}).`,
    "",
    "DATOS DEL MÉDICO (referencia, no incluir en el texto):",
    `- Nombre: ${doctor.nombre}`,
    `- Especialidad: ${doctor.especialidad}`,
    "",
    "DATOS DEL PACIENTE (referencia, NO incluir en el texto):",
    `- Nombre: ${patient.nombre}, Edad: ${patient.edad} años, Sexo: ${patient.sexo || "—"}`,
    "",
    "DICTADO DEL MÉDICO (mejorar redacción y técnica, conservar el contenido clínico):",
    '"""',
    dictation,
    '"""',
    "",
    "Instrucciones obligatorias:",
    "1. Mejora la redacción del dictado: corrige errores, ordena ideas y usa lenguaje médico apropiado.",
    "2. NO incluyas título del documento (INFORME MÉDICO, HISTORIA CLÍNICA, REPOSO MÉDICO).",
    "3. NO incluyas encabezado institucional ni identificación del paciente.",
    "4. NO incluyas sección \"Datos del paciente\" (van en el membrete de la app).",
    "5. Responde SOLO con el cuerpo clínico.",
    "6. La PRIMERA línea de la respuesta DEBE ser [[SECTION:…]] de la primera sección listada.",
    "7. Genera EXACTAMENTE una sección por cada ítem listado, en ese orden, con el nombre EXACTO.",
    "8. PROHIBIDO párrafos o bloques sin [[SECTION:Nombre]].",
    "",
  ];

  const ejemplo = resolveEnfermedadActualEjemplo(template.enfermedadActualEjemplo);
  const sectionList = [
    "Secciones de la plantilla (orden obligatorio — no omitas ninguna):",
    ...effective.map((s, i) => `${i + 1}. [[SECTION:${s}]]`),
    "",
  ];

  if (template.documentType === "historiaClinica") {
    lines.push(
      "Para HISTORIA CLÍNICA:",
      "Formato: línea [[SECTION:Nombre exacto]] y contenido debajo. PROHIBIDO usar **.",
      "",
      ...sectionList,
      enfermedadActualPromptBlock(ejemplo),
      "",
      sectionDefaultsPromptBlock(effective, template.sectionDefaultTexts ?? {}),
    );
    if (physicalExamBlock) lines.push("", physicalExamBlock);
  } else if (template.documentType === "informe") {
    const sexoTexto = sexoLabel(patient.sexo);
    lines.push(
      "Para INFORME MÉDICO:",
      "Formato: línea [[SECTION:Nombre exacto]] y contenido debajo. PROHIBIDO usar **.",
      "",
      ...sectionList,
      "Guía de estilo:",
      MOTIVO_CONSULTA_STYLE,
      `- Enfermedad actual: narrativa al estilo del ejemplo. Inicie con paciente ${sexoTexto} de ${patient.edad} años; natural/procedente, diagnóstico de base o sin patológicos, inicio con fecha, hechos del dictado y cierre en el centro. DEBE ir bajo [[SECTION:Enfermedad actual]].`,
      "- Examen físico: DEBE incluir TODOS los sistemas activos. Solo modifica los dictados; el resto va con texto base intacto. PROHIBIDO omitir sistemas activos no mencionados en el dictado.",
      "- Signos vitales: solo si hay valores dictados; si no, omitir esa línea.",
      "- Diagnóstico (si está en la plantilla): lista numerada 1. 2. 3.",
      "- Plan (si está en la plantilla): lista numerada de conducta/tratamiento (ej. observación, fármacos EV, control de signos). Solo según dictado.",
      "",
      enfermedadActualPromptBlock(ejemplo),
      "",
      sectionDefaultsPromptBlock(effective, template.sectionDefaultTexts ?? {}),
    );
    if (physicalExamBlock) lines.push("", physicalExamBlock);
  } else if (template.documentType === "ordenesMedicas") {
    const molde =
      template.sectionDefaultTexts?.[ORDENES_SECTION] ??
      Object.entries(template.sectionDefaultTexts ?? {}).find(
        ([k]) => k.toLowerCase() === ORDENES_SECTION.toLowerCase(),
      )?.[1];
    lines.push(ordenesMedicasPromptBlock(molde));
  } else if (template.documentType === "receta") {
    const moldeRecipe =
      template.sectionDefaultTexts?.[RECIPE_SECTION] ??
      Object.entries(template.sectionDefaultTexts ?? {}).find(
        ([k]) => k.toLowerCase() === RECIPE_SECTION.toLowerCase(),
      )?.[1] ??
      RECETA_MOLDE_RECIPE;
    const moldeInd =
      template.sectionDefaultTexts?.[RECETA_INDICACIONES_SECTION] ??
      Object.entries(template.sectionDefaultTexts ?? {}).find(
        ([k]) => k.toLowerCase() === RECETA_INDICACIONES_SECTION.toLowerCase(),
      )?.[1] ??
      RECETA_MOLDE_INDICACIONES;
    lines.push(recetaPromptBlock(moldeRecipe, moldeInd));
  } else {
    lines.push(
      ...sectionList,
      "Formato: línea [[SECTION:Nombre exacto]] y contenido debajo.",
      "",
      sectionDefaultsPromptBlock(effective, template.sectionDefaultTexts ?? {}),
    );
  }

  return lines.join("\n");
}

function sexoLabel(sexo: string): string {
  const s = (sexo || "").toLowerCase();
  if (s === "masculino" || s === "m") return "masculino";
  if (s === "femenino" || s === "f") return "femenino";
  return sexo.trim() || "de sexo no referido";
}

/** Genera hoja de órdenes a partir de un informe/HC ya redactado. */
export async function generateOrdenesFromCase(options: {
  patient: Patient;
  doctor: DoctorInfo;
  caseContent: string;
  notes?: string;
  modo?: OrdenesModo;
}): Promise<string> {
  const { patient, doctor, caseContent } = options;
  const notes = options.notes?.trim() ?? "";
  const modo = options.modo ?? "ordenes";
  const template = templateForType("ordenesMedicas");
  const molde =
    template.sectionDefaultTexts?.[ORDENES_SECTION] ??
    Object.entries(template.sectionDefaultTexts ?? {}).find(
      ([k]) => k.toLowerCase() === ORDENES_SECTION.toLowerCase(),
    )?.[1];

  const system = `
Eres un asistente médico que redacta órdenes / tratamiento en español.
Te basas en el caso clínico ya redactado (informe o historia).
No inventes diagnósticos ni fármacos que contradigan el caso.
Usa terminología médica apropiada para Venezuela/Latinoamérica.
OBLIGATORIO: la respuesta empieza con [[SECTION:Órdenes]].`.trim();

  const prompt = [
    `Genera ÓRDENES MÉDICAS (${modo}) a partir del caso clínico.`,
    "",
    `DATOS DEL MÉDICO (referencia, no incluir): ${doctor.nombre} · ${doctor.especialidad}`,
    `DATOS DEL PACIENTE (referencia, no incluir): ${patient.nombre}, ${patient.edad} años, ${patient.sexo || "—"}`,
    "",
    "CASO CLÍNICO (informe/historia ya redactado — base para las órdenes):",
    '"""',
    caseContent.trim(),
    '"""',
    notes
      ? ["", "NOTAS / DICTADO ADICIONAL DEL MÉDICO (priorizar):", '"""', notes, '"""'].join("\n")
      : "",
    "",
    "Instrucciones:",
    "1. NO incluyas título ÓRDENES MÉDICAS ni membrete del paciente.",
    "2. Responde SOLO con [[SECTION:Órdenes]] y la lista numerada.",
    "",
    ordenesMedicasPromptBlock(molde, modo),
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await sendPrompt({ prompt, systemMessage: system, maxTokens: 2048 });
  const sanitized = sanitizeDocumentContent(raw, []);
  return ensureTemplateSections(sanitized, [ORDENES_SECTION]);
}

/** Genera receta desde dictado, informe o diagnóstico (protocolos). */
export async function generateReceta(options: {
  patient: Patient;
  doctor: DoctorInfo;
  fuente: RecetaFuente;
  input: string;
  notes?: string;
}): Promise<string> {
  const { patient, doctor, fuente } = options;
  const input = options.input.trim();
  const notes = options.notes?.trim() ?? "";
  const template = templateForType("receta");
  const moldeRecipe =
    template.sectionDefaultTexts?.[RECIPE_SECTION] ?? RECETA_MOLDE_RECIPE;
  const moldeInd =
    template.sectionDefaultTexts?.[RECETA_INDICACIONES_SECTION] ?? RECETA_MOLDE_INDICACIONES;
  const fromDx = fuente === "diagnostico";

  const system = fromDx
    ? `Eres un asistente médico que redacta RECETAS en español.
Te basas en el diagnóstico y en protocolos/guías clínicas habituales (primera línea VE/LatAm).
Usa principios activos, dosis y duración típicas. Sé prudente.
OBLIGATORIO: [[SECTION:Recipe]] e [[SECTION:Indicaciones]].`.trim()
    : `Eres un asistente médico que redacta RECETAS en español.
Te basas en el dictado o caso aportado. No inventes fármacos sin respaldo.
OBLIGATORIO: [[SECTION:Recipe]] e [[SECTION:Indicaciones]].`.trim();

  const label =
    fuente === "diagnostico"
      ? "DIAGNÓSTICO"
      : fuente === "informe"
        ? "CASO CLÍNICO (informe/historia)"
        : "DICTADO / FÁRMACOS";

  const prompt = [
    fuente === "diagnostico"
      ? "Genera RECETA MÉDICA según el DIAGNÓSTICO, usando protocolos y guías científicas habituales."
      : fuente === "informe"
        ? "Genera RECETA MÉDICA a partir del informe o historia clínica."
        : "Genera RECETA MÉDICA a partir del dictado / lista de fármacos.",
    "",
    `DATOS DEL MÉDICO (referencia, no incluir): ${doctor.nombre} · ${doctor.especialidad}`,
    `DATOS DEL PACIENTE (referencia, no incluir): ${patient.nombre}, ${patient.edad} años, ${patient.sexo || "—"}`,
    "",
    `${label}:`,
    '"""',
    input,
    '"""',
    notes ? ["", "NOTAS ADICIONALES (priorizar):", '"""', notes, '"""'].join("\n") : "",
    "",
    "Instrucciones:",
    "1. NO incluyas título RECETA ni membrete del paciente.",
    "2. Responde SOLO con [[SECTION:Recipe]] e [[SECTION:Indicaciones]].",
    "",
    recetaPromptBlock(moldeRecipe, moldeInd, fromDx),
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await sendPrompt({ prompt, systemMessage: system, maxTokens: 2048 });
  const sanitized = sanitizeDocumentContent(raw, []);
  return ensureTemplateSections(sanitized, [RECIPE_SECTION, RECETA_INDICACIONES_SECTION]);
}

/** Agrega un fármaco (principio + presentación) a una receta existente. */
export async function appendFarmacoToReceta(options: {
  currentContent: string;
  principioActivo: string;
  presentacion: string;
  concentracion?: string;
  patient?: Patient;
}): Promise<string> {
  const principio = options.principioActivo.trim();
  const presentacion = options.presentacion.trim();
  const conc = options.concentracion?.trim() ?? "";
  const drugLine = `${principio}${conc ? ` ${conc}` : ""} (${presentacion})`;

  const sections = parseDocumentSections(options.currentContent);
  let recipe = sections.find((s) => s.title.toLowerCase() === RECIPE_SECTION.toLowerCase());
  let ind = sections.find(
    (s) => s.title.toLowerCase() === RECETA_INDICACIONES_SECTION.toLowerCase(),
  );
  if (!recipe) {
    recipe = { id: crypto.randomUUID(), title: RECIPE_SECTION, body: "" };
    sections.unshift(recipe);
  }
  if (!ind) {
    ind = { id: crypto.randomUUID(), title: RECETA_INDICACIONES_SECTION, body: "" };
    sections.push(ind);
  }

  const system = `Completas UN fármaco para receta ambulatoria en español.
Responde SOLO:
RECIPE:
...
INDICACIONES:
...`;

  const prompt = [
    "Agrega solo este fármaco:",
    `- Principio activo: ${principio}`,
    `- Presentación: ${presentacion}`,
    conc ? `- Concentración: ${conc}` : "",
    options.patient
      ? `- Paciente: ${options.patient.edad} años, ${options.patient.sexo || "—"}`
      : "",
    "",
    "Formato RECIPE ejemplo:",
    drugLine,
    "Dispóngase: N unidades.",
    "",
    "Formato INDICACIONES ejemplo:",
    `${principio}:`,
    "Tomar … vía … cada … por … días.",
  ]
    .filter(Boolean)
    .join("\n");

  let recipeAdd = `${drugLine}\nDispóngase: —.`;
  let indAdd = `${principio}:\nTomar según indicación médica (${presentacion}).`;
  try {
    const raw = await sendPrompt({ prompt, systemMessage: system, maxTokens: 512 });
    const cleaned = raw.replace(/```/g, "").trim();
    const r = /RECIPE\s*:?\s*([\s\S]*?)(?=INDICACIONES\s*:|$)/i.exec(cleaned)?.[1]?.trim();
    const i = /INDICACIONES\s*:?\s*([\s\S]*)$/i.exec(cleaned)?.[1]?.trim();
    if (r) recipeAdd = r;
    if (i) indAdd = i;
  } catch {
    /* fallback local */
  }

  recipe.body = [recipe.body.trim(), recipeAdd].filter(Boolean).join("\n\n");
  ind.body = [ind.body.trim(), indAdd].filter(Boolean).join("\n\n");
  return serializeDocumentSections(sections);
}
