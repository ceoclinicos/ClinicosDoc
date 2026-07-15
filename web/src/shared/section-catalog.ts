import type { DocumentType } from "./models";

export const SectionCatalog = {
  DATOS_PACIENTE: "Datos del paciente",
  MOTIVO_CONSULTA: "Motivo de consulta",
  ENFERMEDAD_ACTUAL: "Enfermedad actual",
  ANTECEDENTES_PERSONALES: "Antecedentes personales",
  ANTECEDENTES_FAMILIARES: "Antecedentes familiares",
  HABITOS_PSICOBIOLOGICOS: "Hábitos psicobiológicos",
  EXAMEN_FUNCIONAL: "Examen funcional",
  EXAMEN_FISICO: "Examen físico",
  DIAGNOSTICO: "Diagnóstico",
  IMPRESION_DIAGNOSTICA: "Impresión diagnóstica",
  PLAN: "Plan",
  OBSERVACIONES: "Observaciones",
  CONCLUSIONES: "Conclusiones",
  RECOMENDACIONES: "Recomendaciones",
  DIAS_REPOSO: "Días de reposo indicados",
  INDICACIONES: "Indicaciones",
} as const;

export function catalogFor(type: DocumentType): string[] {
  switch (type) {
    case "historiaClinica":
      return [
        SectionCatalog.DATOS_PACIENTE,
        SectionCatalog.MOTIVO_CONSULTA,
        SectionCatalog.ENFERMEDAD_ACTUAL,
        SectionCatalog.ANTECEDENTES_PERSONALES,
        SectionCatalog.ANTECEDENTES_FAMILIARES,
        SectionCatalog.HABITOS_PSICOBIOLOGICOS,
        SectionCatalog.EXAMEN_FUNCIONAL,
        SectionCatalog.EXAMEN_FISICO,
        SectionCatalog.DIAGNOSTICO,
        SectionCatalog.IMPRESION_DIAGNOSTICA,
        SectionCatalog.PLAN,
        SectionCatalog.OBSERVACIONES,
      ];
    case "informe":
      return [
        SectionCatalog.DATOS_PACIENTE,
        SectionCatalog.MOTIVO_CONSULTA,
        SectionCatalog.ENFERMEDAD_ACTUAL,
        SectionCatalog.EXAMEN_FISICO,
        SectionCatalog.DIAGNOSTICO,
        SectionCatalog.CONCLUSIONES,
        SectionCatalog.RECOMENDACIONES,
      ];
    case "reposo":
      return [
        SectionCatalog.DATOS_PACIENTE,
        SectionCatalog.DIAGNOSTICO,
        SectionCatalog.DIAS_REPOSO,
        SectionCatalog.INDICACIONES,
        SectionCatalog.OBSERVACIONES,
      ];
  }
}

export function defaultSectionsFor(type: DocumentType): string[] {
  // Informe: todas las del catálogo marcadas por defecto
  return catalogFor(type);
}
