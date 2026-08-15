/** Plantillas y encabezado iniciales del centro (paridad con defaults del médico). */
import {
  DocumentTypeLabels,
  type DocumentHeader,
  type DocumentTemplate,
  type DocumentType,
} from "../shared/models";
import { ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT } from "../shared/enfermedad-actual";
import { ORDENES_MOLDE_EJEMPLO, ORDENES_SECTION } from "../shared/ordenes-medicas";
import {
  RECETA_INDICACIONES_SECTION,
  RECETA_MOLDE_INDICACIONES,
  RECETA_MOLDE_RECIPE,
  RECIPE_SECTION,
} from "../shared/receta";
import { DefaultEnabledExamIds } from "../shared/physical-exam-defaults";
import { SectionCatalog, defaultSectionsFor } from "../shared/section-catalog";

const DOC_TYPES: DocumentType[] = [
  "historiaClinica",
  "informe",
  "reposo",
  "ordenesMedicas",
  "receta",
];

const DIAS_REPOSO_DEFAULT =
  "Nota: En vista de la sintomatología del paciente se indican cumplir 3 días de reposo médico completo.";

function sectionDefaultTextsFor(type: DocumentType): Record<string, string> | undefined {
  if (type === "ordenesMedicas") {
    return { [ORDENES_SECTION]: ORDENES_MOLDE_EJEMPLO };
  }
  if (type === "receta") {
    return {
      [RECIPE_SECTION]: RECETA_MOLDE_RECIPE,
      [RECETA_INDICACIONES_SECTION]: RECETA_MOLDE_INDICACIONES,
    };
  }
  if (type === "reposo") {
    return { [SectionCatalog.DIAS_REPOSO]: DIAS_REPOSO_DEFAULT };
  }
  return undefined;
}

export function makeDefaultClinicTemplates(): DocumentTemplate[] {
  return DOC_TYPES.map((type) => ({
    id: `clinic_default_${type}`,
    name: `Plantilla ${DocumentTypeLabels[type]}`,
    documentType: type,
    sections: defaultSectionsFor(type),
    isDefault: true,
    enabledPhysicalExamSystemIds: [...DefaultEnabledExamIds],
    enfermedadActualEjemplo:
      type === "informe" || type === "historiaClinica" || type === "reposo"
        ? ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT
        : "",
    sectionDefaultTexts: sectionDefaultTextsFor(type),
  }));
}

export function makeDefaultClinicHeader(clinicName: string): DocumentHeader {
  return {
    id: "clinic_default_header",
    name: "Encabezado del centro",
    doctorName: clinicName.trim() || "Centro de salud",
    subtitle: "Documentos institucionales",
    description: "",
    isDefault: true,
  };
}

export function clinicTemplateTypes(): DocumentType[] {
  return [...DOC_TYPES];
}
