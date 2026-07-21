import { DocumentTypeLabels } from "../../shared/models";
import type { DocumentTemplate, DocumentType, Patient } from "../../shared/models";
import { SectionCatalog, defaultSectionsFor } from "../../shared/section-catalog";
import {
  ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT,
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
  isRecipeSectionTitle,
  isRecetaIndicacionesTitle,
  RECETA_INDICACIONES_SECTION,
  RECETA_MOLDE_INDICACIONES,
  RECETA_MOLDE_RECIPE,
  RECIPE_SECTION,
  recetaPromptBlock,
  type RecetaFuente,
} from "../../shared/receta";
import { templateForType } from "../clinical-store";
import { parseDocumentSections, serializeDocumentSections, type DocumentSection } from "../document-parser";
import { isPhysicalExamTitle } from "../vital-signs";

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
  if (template.documentType === "reposo") {
    return [
      SectionCatalog.MOTIVO_CONSULTA,
      SectionCatalog.ENFERMEDAD_ACTUAL,
      SectionCatalog.EXAMEN_FISICO,
      SectionCatalog.DIAGNOSTICO,
      SectionCatalog.DIAS_REPOSO,
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
  } else if (template.documentType === "informe" || template.documentType === "reposo") {
    const sexoTexto = sexoLabel(patient.sexo);
    const tipoGuia =
      template.documentType === "reposo" ? "Para REPOSO MÉDICO (misma estructura clínica del informe):" : "Para INFORME MÉDICO:";
    lines.push(
      tipoGuia,
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
      ...(template.documentType === "reposo"
        ? [
            "- Días de reposo indicados: conserva el texto predeterminado de la plantilla (días y redacción) salvo que el dictado indique otro número de días u otra fórmula.",
          ]
        : []),
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
  let recipe = sections.find((s) => isRecipeSectionTitle(s.title));
  let ind = sections.find((s) => isRecetaIndicacionesTitle(s.title));
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

function normalizeSectionTitle(title: string): string {
  return title.trim();
}

function sectionStyleHint(title: string): string {
  const t = title.trim();
  if (t.toLowerCase() === SectionCatalog.MOTIVO_CONSULTA.toLowerCase()) return MOTIVO_CONSULTA_STYLE;
  if (t.toLowerCase() === SectionCatalog.ENFERMEDAD_ACTUAL.toLowerCase()) {
    return "- Enfermedad actual: narrativa cronológica con tiempos, evolución y tratamientos del dictado.";
  }
  if (/antecedentes personales/i.test(t)) return '- Antecedentes personales: "Niega..." para negativos; no inventar.';
  if (/antecedentes familiares/i.test(t)) return "- Antecedentes familiares: relaciones y causas si se conocen.";
  if (/hábitos|habitos/i.test(t)) return "- Hábitos psicobiológicos: solo lo referido en el dictado.";
  if (/examen funcional/i.test(t)) return "- Examen funcional: lo que REFIERE el paciente por sistemas.";
  return "- Redacta con lenguaje semiológico apropiado al título de la sección.";
}

function enfermedadActualHintBlock(
  template: DocumentTemplate,
  sectionTitle: string,
): string {
  const applies =
    (template.documentType === "historiaClinica" ||
      template.documentType === "informe" ||
      template.documentType === "reposo") &&
    (!sectionTitle ||
      sectionTitle.toLowerCase() === SectionCatalog.ENFERMEDAD_ACTUAL.toLowerCase());
  if (!applies) return "";
  const sample = resolveEnfermedadActualEjemplo(template.enfermedadActualEjemplo).trim() ||
    ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT;
  return [
    enfermedadActualPromptBlock(sample),
    "",
  ].join("\n");
}

function extractRegeneratedSectionBody(raw: string, sectionTitle: string): string {
  const sanitized = sanitizeDocumentContent(raw, []);
  const parsed = parseDocumentSections(sanitized);
  const normalized = normalizeSectionTitle(sectionTitle);
  const matching = parsed.find((section) => {
    const title = normalizeSectionTitle(section.title);
    if (!normalized) return !title;
    return title.toLowerCase() === normalized.toLowerCase();
  });
  if (matching?.body.trim()) return matching.body.trim();
  if (parsed.length === 1 && parsed[0].body.trim()) return parsed[0].body.trim();
  return sanitized
    .split("\n")
    .filter((line) => !/^\[\[SECTION:[^\]]+]]\s*$/.test(line.trim()))
    .join("\n")
    .trim();
}

/** Regenera una sola sección con IA (paridad DocumentAiService.regenerateSection). */
export async function regenerateSection(options: {
  template: DocumentTemplate;
  patient: Patient;
  doctor: DoctorInfo;
  dictation: string;
  sectionTitle: string;
  currentSectionBody: string;
  otherSections: DocumentSection[];
}): Promise<string> {
  const {
    template,
    patient,
    dictation,
    sectionTitle,
    currentSectionBody,
    otherSections,
  } = options;
  const normalizedTitle = normalizeSectionTitle(sectionTitle);
  const isPhysicalExam =
    isPhysicalExamTitle(normalizedTitle) ||
    /^examen\s+f[ií]sico$/i.test(normalizedTitle);
  const isDiagnostico =
    normalizedTitle.toLowerCase() === SectionCatalog.DIAGNOSTICO.toLowerCase() ||
    /^diagn[oó]stico$/i.test(normalizedTitle);
  const isInformeIntro = template.documentType === "informe" && !normalizedTitle;
  const physicalExamBlock = buildPhysicalExamBlock(template);
  const systems = resolveSystemsForReport(template);

  const system = `
Eres un asistente médico que redacta documentos clínicos en español.
Regeneras UNA sola sección sin inventar hallazgos que contradigan el dictado.
Usa terminología médica apropiada para Venezuela/Latinoamérica.`.trim();

  const lines: string[] = [
    `Regenera SOLO una sección del ${DocumentTypeLabels[template.documentType]}.`,
    `Plantilla: "${template.name}".`,
    "",
    "DATOS DEL PACIENTE (referencia, NO incluir en el texto):",
    `- Edad: ${patient.edad} años, Sexo: ${patient.sexo || "—"}`,
    "",
    "DICTADO DEL MÉDICO (fuente principal):",
    '"""',
    dictation,
    '"""',
    "",
  ];

  if (otherSections.length) {
    lines.push("OTRAS SECCIONES DEL DOCUMENTO (solo contexto; NO las regeneres ni copies):");
    for (const section of otherSections) {
      const title = normalizeSectionTitle(section.title) || "(inicio sin título)";
      const preview = section.body.trim().slice(0, 280);
      lines.push(`- ${title}: ${preview}${section.body.length > 280 ? "…" : ""}`);
    }
    lines.push("");
  }

  if (currentSectionBody.trim()) {
    lines.push("TEXTO ACTUAL DE LA SECCIÓN (puedes mejorarlo; no estás obligado a copiarlo):");
    lines.push(currentSectionBody);
    lines.push("");
  }

  lines.push(
    `SECCIÓN A REGENERAR: ${normalizedTitle || "Inicio del informe (párrafo narrativo sin título)"}`,
    "",
    "REGLAS OBLIGATORIAS:",
    "- Responde SOLO con el contenido de ESA sección.",
    "- NO incluyas [[SECTION:...]], **títulos** ni otras secciones.",
    "- NO incluyas nombre ni cédula del paciente.",
    "- NO inventes síntomas, signos ni diagnósticos no presentes en el dictado.",
    "- Mejora redacción, ortografía y semiología según el dictado.",
    "",
  );

  const eaHint = enfermedadActualHintBlock(template, normalizedTitle);
  if (eaHint) lines.push(eaHint);

  if (isInformeIntro) {
    const sexoTexto = sexoLabel(patient.sexo);
    lines.push(
      "Tipo: párrafo inicial del INFORME MÉDICO (sin título).",
      `- Inicia: "Se trata de paciente ${sexoTexto} de ${patient.edad} años de edad..."`,
      "- Motivo, evento, síntomas y conducta SOLO según el dictado.",
    );
  } else if (isPhysicalExam) {
    lines.push(
      "Tipo: EXAMEN FÍSICO.",
      "- Incluye TODOS los sistemas activos, aunque el dictado solo mencione uno.",
      "- Sistemas no dictados → texto base intacto. Solo edita los mencionados.",
      "- Signos vitales SOLO si hay valores dictados (ej. TA: 120/80 mmHg | FC: 82 lpm).",
      "- Signos en 0 o no dictados: omitirlos.",
    );
    if (physicalExamBlock) {
      lines.push("", physicalExamBlock);
    }
  } else if (isDiagnostico) {
    lines.push(
      "Tipo: DIAGNÓSTICO.",
      "- Lista numerada (1. 2. 3.); mínimo 1, máximo 4 según el dictado.",
    );
  } else if (template.documentType === "historiaClinica") {
    lines.push("Tipo: sección de HISTORIA CLÍNICA.", sectionStyleHint(normalizedTitle));
    if (isPhysicalExam && physicalExamBlock) {
      lines.push("", physicalExamBlock);
    }
  } else {
    lines.push(`Tipo: sección "${normalizedTitle || "contenido"}".`);
    if (!currentSectionBody.trim()) {
      lines.push('- Si el dictado no trae datos para esta sección, escribe "No referido".');
    }
  }

  const raw = await sendPrompt({ prompt: lines.join("\n"), systemMessage: system, maxTokens: 2048 });
  let body = extractRegeneratedSectionBody(raw, normalizedTitle);
  if (isPhysicalExam && systems.length) {
    body = ensurePhysicalExamSystems(
      `[[SECTION:${SectionCatalog.EXAMEN_FISICO}]]\n${body}`,
      systems,
    ).replace(/^\[\[SECTION:[^\]]+]]\s*\n?/, "");
  }
  return body;
}
