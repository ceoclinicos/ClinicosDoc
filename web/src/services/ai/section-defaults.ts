/** Textos / estilos predeterminados de secciones (paridad con SectionDefaults.kt). */
import { SectionCatalog } from "../../shared/section-catalog";

export const MOTIVO_CONSULTA_STYLE =
  '- Motivo de consulta: SOLO síntomas principales (máximo 3), unidos con "y"/"e". ' +
  'Ejemplo: "diarrea y vómito". PROHIBIDO frases largas, "consulta por…", evolución, antecedentes o diagnóstico.';

function textFor(section: string): string {
  const s = section.trim().toLowerCase();
  if (s === SectionCatalog.MOTIVO_CONSULTA.toLowerCase()) return "Evaluación médica.";
  if (s === SectionCatalog.ENFERMEDAD_ACTUAL.toLowerCase()) {
    return "Paciente refiere cuadro clínico de evolución reciente. Sin mayores detalles aportados en la evaluación actual.";
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
  if (s === SectionCatalog.PLAN.toLowerCase()) return "Plan terapéutico según evolución clínica.";
  if (s === SectionCatalog.OBSERVACIONES.toLowerCase()) return "Sin observaciones adicionales.";
  if (s === SectionCatalog.CONCLUSIONES.toLowerCase()) return "Conclusiones según hallazgos de la evaluación.";
  if (s === SectionCatalog.RECOMENDACIONES.toLowerCase()) return "Seguimiento médico según evolución clínica.";
  if (s === SectionCatalog.DIAS_REPOSO.toLowerCase()) return "Días de reposo a indicar según criterio médico.";
  if (s === SectionCatalog.INDICACIONES.toLowerCase()) return "Indicaciones médicas según evolución.";
  return "Sin datos adicionales referidos.";
}

export function sectionDefaultsPromptBlock(sections: string[]): string {
  const clinical = sections.filter(
    (sec) => sec.toLowerCase() !== SectionCatalog.DATOS_PACIENTE.toLowerCase(),
  );
  if (!clinical.length) return "";
  return [
    "TEXTOS PREDETERMINADOS (usar SOLO si la sección está activa y el dictado NO aporta datos para ella):",
    ...clinical.map((section) => `- ${section} → "${textFor(section)}"`),
    "Si el dictado sí aporta datos, prioriza el dictado y mejora la redacción.",
    'NO uses la frase "No referido" cuando exista texto predeterminado arriba.',
  ].join("\n");
}
