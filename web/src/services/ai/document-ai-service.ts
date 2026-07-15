import { DocumentTypeLabels } from "../../shared/models";
import type { DocumentTemplate, DocumentType, Patient } from "../../shared/models";
import { SectionCatalog, defaultSectionsFor } from "../../shared/section-catalog";
import { sendPrompt } from "./ai-service";
import { sanitizeDocumentContent } from "./document-sanitizer";
import { buildPhysicalExamBlock } from "./physical-exam-prompt";
import { MOTIVO_CONSULTA_STYLE, sectionDefaultsPromptBlock } from "./section-defaults";

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

export async function generateDocument(options: {
  template: DocumentTemplate;
  patient: Patient;
  doctor: DoctorInfo;
  dictation: string;
}): Promise<string> {
  const { template, patient, doctor, dictation } = options;
  const physicalExamBlock = buildPhysicalExamBlock(template);

  const system = `
Eres un asistente médico que redacta y mejora documentos clínicos en español.
Tu trabajo es transformar el dictado del médico en un texto profesional, claro y legible.
Corrige ortografía, gramática y puntuación.
Convierte expresiones coloquiales a terminología médica equivalente, sin cambiar el significado clínico.
Organiza el contenido en párrafos fluidos y coherentes.
No inventes hallazgos clínicos patológicos que contradigan el dictado.
En INFORME MÉDICO / HISTORIA: el examen físico DEBE incluir TODOS los sistemas activos de la plantilla.
En HISTORIA CLÍNICA: respeta el orden de secciones de la plantilla; antecedentes negativos con "Niega..."; datos no mencionados con texto predeterminado.
Usa terminología médica apropiada para Venezuela/Latinoamérica.`.trim();

  const prompt = buildPrompt(template, patient, doctor, dictation, physicalExamBlock);
  const raw = await sendPrompt({ prompt, systemMessage: system, maxTokens: 4096 });
  return sanitizeDocumentContent(raw);
}

function clinicalSections(template: DocumentTemplate): string[] {
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

function buildPrompt(
  template: DocumentTemplate,
  patient: Patient,
  doctor: DoctorInfo,
  dictation: string,
  physicalExamBlock: string,
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
    "4. NO incluyas sección \"Datos del paciente\".",
    "5. Responde SOLO con el cuerpo clínico redactado.",
    "",
  ];

  if (template.documentType === "historiaClinica") {
    const effective = clinicalSections(template);
    lines.push(
      "Para HISTORIA CLÍNICA ignora detección libre de secciones.",
      "Genera UNA sección por cada ítem de la plantilla, en el orden exacto indicado.",
      "Formato: línea [[SECTION:Nombre exacto]] y contenido debajo.",
      "PROHIBIDO usar ** para títulos.",
      "",
      "Secciones de la plantilla (orden obligatorio):",
      ...effective.map((s) => `- ${s}`),
      "",
      sectionDefaultsPromptBlock(effective),
    );
    if (physicalExamBlock) lines.push("", physicalExamBlock);
  } else if (template.documentType === "informe") {
    const effective = clinicalSections(template);
    const sexoTexto = sexoLabel(patient.sexo);
    lines.push(
      "Para INFORME MÉDICO ignora la detección libre de secciones.",
      "El encabezado institucional lo coloca la app; tú generas SOLO el cuerpo.",
      "Genera UNA sección por cada ítem de la plantilla, en el orden exacto indicado.",
      "Formato: línea [[SECTION:Nombre exacto]] y contenido debajo. PROHIBIDO usar **.",
      'NO incluyas "Datos del paciente" ni nombre/cédula.',
      "",
      "Secciones de la plantilla (orden obligatorio):",
      ...effective.map((s) => `- ${s}`),
      "",
      "Guía de estilo:",
      MOTIVO_CONSULTA_STYLE,
      `- Enfermedad actual: párrafo narrativo. Inicia "Se trata de paciente ${sexoTexto} de ${patient.edad} años de edad..."; motivo, síntomas y conducta SOLO según el dictado.`,
      "- Examen físico: DEBE incluir TODOS los sistemas activos. Solo modifica los dictados; el resto va con texto base intacto.",
      "- Primera línea del examen físico: TA: [---] mmHg | FR: [---] rpm | FC: [---] lpm | SaTO2: [---]%",
      "- Diagnóstico (si está en la plantilla): lista numerada 1. 2. 3.",
      "",
      sectionDefaultsPromptBlock(effective),
    );
    if (physicalExamBlock) lines.push("", physicalExamBlock);
  } else {
    const effective = clinicalSections(template);
    lines.push(
      "Secciones en orden:",
      ...effective.map((s) => `- ${s}`),
      "Formato: línea [[SECTION:Nombre exacto]] y contenido debajo.",
      "",
      sectionDefaultsPromptBlock(effective),
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
