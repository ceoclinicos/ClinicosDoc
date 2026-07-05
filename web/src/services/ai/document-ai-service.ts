import { DocumentTypeLabels } from "../../shared/models";
import type { DocumentTemplate, DocumentType, Patient } from "../../shared/models";
import { defaultSectionsFor } from "../../shared/section-catalog";
import { sendPrompt } from "./ai-service";
import { sanitizeDocumentContent } from "./document-sanitizer";
import { buildPhysicalExamBlock } from "./physical-exam-prompt";

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
En INFORME MÉDICO: si no hay examen físico dictado, usa la plantilla base normal.
En HISTORIA CLÍNICA: respeta el orden de secciones de la plantilla; antecedentes negativos con "Niega..."; datos no mencionados con "No referido".
Usa terminología médica apropiada para Venezuela/Latinoamérica.`.trim();

  const prompt = buildPrompt(template, patient, doctor, dictation, physicalExamBlock);
  const raw = await sendPrompt({ prompt, systemMessage: system, maxTokens: 4096 });
  return sanitizeDocumentContent(raw);
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
    lines.push(
      "Para HISTORIA CLÍNICA ignora detección libre de secciones.",
      "Genera UNA sección por cada ítem de la plantilla, en el orden exacto indicado.",
      "Formato: línea [[SECTION:Nombre exacto]] y contenido debajo.",
      'PROHIBIDO usar ** para títulos.',
      "",
      "Secciones de la plantilla (orden obligatorio):",
      ...template.sections.map((s) => `- ${s}`),
      "",
      'Si una sección no tiene datos, escribe "No referido" o "Niega..." según corresponda.',
    );
    if (physicalExamBlock) {
      lines.push("", physicalExamBlock);
    }
  } else if (template.documentType === "informe") {
    const sexoTexto = sexoLabel(patient.sexo);
    lines.push(
      "Para INFORME MÉDICO ignora la detección libre de secciones.",
      "Genera SOLO el cuerpo en 3 bloques: inicio narrativo + examen físico + diagnóstico.",
      "",
      "2. INICIO → párrafo narrativo SIN título de sección.",
      "3. EXAMEN FÍSICO → línea [[SECTION:Examen físico]] y contenido debajo.",
      "4. DIAGNÓSTICO → línea [[SECTION:Diagnóstico]] con lista numerada.",
      "",
      "═══ BLOQUE 2 (inicio, SIN subtítulo) ═══",
      `- Inicia: "Se trata de paciente ${sexoTexto} de ${patient.edad} años de edad..."`,
      "- Motivo, evento, síntomas SOLO según el dictado.",
      "",
      "═══ BLOQUE 3 — Examen físico ═══",
      "- Primera línea EXACTA: [[SECTION:Examen físico]]",
      "- Línea de signos vitales: TA: [---] mmHg | FR: [---] rpm | FC: [---] lpm | SaTO2: [---]%",
    );
    if (physicalExamBlock) lines.push("", physicalExamBlock);
    lines.push(
      "",
      "═══ BLOQUE 4 — Diagnóstico ═══",
      "- Primera línea EXACTA: [[SECTION:Diagnóstico]]",
      "- Lista numerada: mínimo 1, máximo 4 diagnósticos según el dictado.",
    );
  } else {
    lines.push(
      "Secciones en orden:",
      ...template.sections.map((s) => `- ${s}`),
      "Cada sección con **título:** y contenido.",
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
