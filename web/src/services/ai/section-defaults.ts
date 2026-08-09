/** Textos / estilos predeterminados de secciones (paridad con SectionDefaults.kt). */
import { SectionCatalog } from "../../shared/section-catalog";
import { ORDENES_MOLDE_EJEMPLO } from "../../shared/ordenes-medicas";
import {
  RECETA_MOLDE_INDICACIONES,
  RECETA_MOLDE_RECIPE,
  RECIPE_SECTION,
} from "../../shared/receta";

export const MOTIVO_CONSULTA_STYLE =
  "- Motivo de consulta: escribe EXACTAMENTE el o los síntomas mencionados en el dictado " +
  '(máximo 3), unidos con "y"/"e". SOLO el nombre del síntoma; NADA de detalles ' +
  "(ni tipo, intensidad, duración, localización, características, restos alimenticios, etc.). " +
  'Ejemplos: "dolor abdominal tipo cólico de moderada intensidad" → "dolor abdominal"; ' +
  '"vómitos de restos alimenticios" → "vómito"; varios → "dolor abdominal y vómito". ' +
  'PROHIBIDO: frases largas, "consulta por…", "refiere…", evolución, antecedentes o diagnóstico.';

/** Diagnóstico clínico real según el dictado (no genérico). */
export const DIAGNOSTICO_STYLE =
  "- Diagnóstico / Impresión diagnóstica: fórmulas clínicas reales según síntomas, signos y " +
  'datos del dictado (ej. "gastritis aguda", "cólico abdominal", "GEA", "faringoamigdalitis aguda"). ' +
  "Lista numerada 1. 2. 3. si hay varios. " +
  'PROHIBIDO dejar solo "Evaluación clínica" o frases vacías si el dictado permite un diagnóstico ' +
  "sindromático o nosológico razonable. No inventes hallazgos no referidos.";

export function defaultTextForSection(
  section: string,
  overrides: Record<string, string> = {},
): string {
  const override = Object.entries(overrides).find(
    ([k]) => k.toLowerCase() === section.trim().toLowerCase(),
  )?.[1]?.trim();
  if (override) return override;

  const s = section.trim().toLowerCase();
  if (s === SectionCatalog.MOTIVO_CONSULTA.toLowerCase()) return "Evaluación médica.";
  if (s === SectionCatalog.ENFERMEDAD_ACTUAL.toLowerCase()) {
    return "Se trata de paciente referido para evaluación clínica. Sin mayores detalles aportados en la evaluación actual.";
  }
  if (s === SectionCatalog.ANTECEDENTES_PERSONALES.toLowerCase()) {
    return "Niega antecedentes patológicos personales de importancia. Niega quirúrgicos y traumáticos. Niega alergias medicamentosas conocidas.";
  }
  if (s === SectionCatalog.ANTECEDENTES_FAMILIARES.toLowerCase()) return "Niega antecedentes familiares relevantes.";
  if (s === SectionCatalog.HABITOS_PSICOBIOLOGICOS.toLowerCase()) {
    return "Niega hábitos tóxicos. Sueño y alimentación referidos dentro de lo usual. Hábito intestinal y urinario sin alteraciones referidas.";
  }
  if (s === SectionCatalog.EXAMEN_FUNCIONAL.toLowerCase()) {
    return "Sin síntomas funcionales referidos por sistemas en la evaluación actual.";
  }
  if (s === SectionCatalog.EXAMEN_FISICO.toLowerCase()) return "Examen físico según plantilla de sistemas activos.";
  if (s === SectionCatalog.DIAGNOSTICO.toLowerCase()) return "1. Evaluación clínica.";
  if (s === SectionCatalog.IMPRESION_DIAGNOSTICA.toLowerCase()) {
    return "Impresión diagnóstica pendiente de correlacionar con evolución clínica.";
  }
  if (s === SectionCatalog.PLAN.toLowerCase()) {
    return [
      "1. Hospitalizar o mantener bajo observación 4 horas",
      "2. Omeprazol 40 mg EV",
      "3. Ketoprofeno 100 mg EV cada 12 horas",
      "4. Control de signos vitales",
    ].join("\n");
  }
  if (s === SectionCatalog.OBSERVACIONES.toLowerCase()) return "Sin observaciones adicionales.";
  if (s === SectionCatalog.CONCLUSIONES.toLowerCase()) return "Conclusiones según hallazgos de la evaluación.";
  if (s === SectionCatalog.RECOMENDACIONES.toLowerCase()) return "Seguimiento médico según evolución clínica.";
  if (s === SectionCatalog.DIAS_REPOSO.toLowerCase()) {
    return "Nota: En vista de la sintomatología del paciente se indican cumplir 3 días de reposo médico completo.";
  }
  if (s === SectionCatalog.INDICACIONES.toLowerCase()) return RECETA_MOLDE_INDICACIONES;
  if (s === RECIPE_SECTION.toLowerCase()) return RECETA_MOLDE_RECIPE;
  if (s === SectionCatalog.ORDENES.toLowerCase()) {
    return ORDENES_MOLDE_EJEMPLO;
  }
  return "Sin datos adicionales referidos.";
}

export function sectionDefaultsPromptBlock(
  sections: string[],
  overrides: Record<string, string> = {},
): string {
  const clinical = sections.filter(
    (sec) => sec.toLowerCase() !== SectionCatalog.DATOS_PACIENTE.toLowerCase(),
  );
  if (!clinical.length) return "";
  return [
    "TEXTOS PREDETERMINADOS (usar SOLO si la sección está activa y el dictado NO aporta datos para ella):",
    ...clinical.map((section) => `- ${section} → "${defaultTextForSection(section, overrides)}"`),
    "Si el dictado sí aporta datos, prioriza el dictado y mejora la redacción.",
    'NO uses la frase "No referido" cuando exista texto predeterminado arriba.',
  ].join("\n");
}
