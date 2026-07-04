import type { DocumentType } from "./models";

export const SectionCatalog = {
  MOTIVO_CONSULTA: "Motivo de consulta",
  ENFERMEDAD_ACTUAL: "Enfermedad actual",
  ANTECEDENTES_PERSONALES: "Antecedentes personales",
  EXAMEN_FISICO: "Examen físico",
  DIAGNOSTICO: "Diagnóstico",
} as const;

export function defaultSectionsFor(type: DocumentType): string[] {
  switch (type) {
    case "historiaClinica":
      return [
        SectionCatalog.MOTIVO_CONSULTA,
        SectionCatalog.ENFERMEDAD_ACTUAL,
        SectionCatalog.ANTECEDENTES_PERSONALES,
        "Antecedentes familiares",
        "Hábitos psicobiológicos",
        "Examen funcional",
        SectionCatalog.EXAMEN_FISICO,
        SectionCatalog.DIAGNOSTICO,
      ];
    case "informe":
      return [SectionCatalog.EXAMEN_FISICO, SectionCatalog.DIAGNOSTICO];
    case "reposo":
      return ["Días de reposo indicados", "Indicaciones"];
  }
}
