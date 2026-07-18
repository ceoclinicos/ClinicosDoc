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
  ORDENES: "Órdenes",
  RECIPE: "Recipe",
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
        SectionCatalog.PLAN,
      ];
    case "reposo":
      return [
        SectionCatalog.DATOS_PACIENTE,
        SectionCatalog.DIAGNOSTICO,
        SectionCatalog.DIAS_REPOSO,
        SectionCatalog.INDICACIONES,
        SectionCatalog.OBSERVACIONES,
      ];
    case "ordenesMedicas":
      return [SectionCatalog.DATOS_PACIENTE, SectionCatalog.ORDENES];
    case "receta":
      return [SectionCatalog.DATOS_PACIENTE, SectionCatalog.RECIPE, SectionCatalog.INDICACIONES];
  }
}

export function defaultSectionsFor(type: DocumentType): string[] {
  switch (type) {
    case "informe":
      // Primera vez: solo núcleo clínico (Conclusiones/Plan desmarcados)
      return [
        SectionCatalog.DATOS_PACIENTE,
        SectionCatalog.MOTIVO_CONSULTA,
        SectionCatalog.ENFERMEDAD_ACTUAL,
        SectionCatalog.EXAMEN_FISICO,
        SectionCatalog.DIAGNOSTICO,
      ];
    case "historiaClinica":
    case "reposo":
    case "ordenesMedicas":
    case "receta":
      return catalogFor(type);
  }
}

function sameSections(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

/** Catálogo completo del informe (legado: solían venir todas checadas). */
export const INFORME_FULL_CATALOG = catalogFor("informe");

/** Antiguo catálogo completo con "Recomendaciones" (antes del rename a Plan). */
const INFORME_LEGACY_FULL = [
  SectionCatalog.DATOS_PACIENTE,
  SectionCatalog.MOTIVO_CONSULTA,
  SectionCatalog.ENFERMEDAD_ACTUAL,
  SectionCatalog.EXAMEN_FISICO,
  SectionCatalog.DIAGNOSTICO,
  SectionCatalog.CONCLUSIONES,
  "Recomendaciones",
];

export function isLegacyInformeAllChecked(sections: string[]): boolean {
  return sameSections(sections, INFORME_FULL_CATALOG) || sameSections(sections, INFORME_LEGACY_FULL);
}

export function normalizeTemplateSections(type: DocumentType, sections: string[]): string[] {
  const catalog = catalogFor(type);
  const mapped = sections
    .map((s) => (s.trim().toLowerCase() === "recomendaciones" ? SectionCatalog.PLAN : s.trim()))
    .filter((s) => s.length > 0);
  // Conserva secciones personalizadas fuera del catálogo
  const unique = [...new Set(mapped)];
  if (
    !unique.includes(SectionCatalog.DATOS_PACIENTE) &&
    catalog.includes(SectionCatalog.DATOS_PACIENTE)
  ) {
    return [SectionCatalog.DATOS_PACIENTE, ...unique.filter((s) => s !== SectionCatalog.DATOS_PACIENTE)];
  }
  return unique.length ? unique : defaultSectionsFor(type);
}
