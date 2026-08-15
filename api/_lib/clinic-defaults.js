/** Catálogo inicial del centro — paridad con defaults del médico (app/web). */

const Section = {
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
  DIAS_REPOSO: "Días de reposo indicados",
  INDICACIONES: "Indicaciones",
  ORDENES: "Órdenes",
  RECIPE: "Recipe",
};

const LABELS = {
  historiaClinica: "Historia clínica",
  informe: "Informe",
  reposo: "Reposo",
  ordenesMedicas: "Órdenes médicas",
  receta: "Receta",
};

const EXAM_IDS = [
  "signos_vitales",
  "general",
  "piel",
  "cabeza_cuello",
  "cardiopulmonar",
  "abdomen",
  "extremidades",
  "neurologico",
];

const ENFERMEDAD_EJEMPLO =
  "Se trata de paciente masculino de 35 años de edad, natural de Carúpano, procedente de la localidad, " +
  "sin diagnóstico patológico conocido, quien refiere inicio de enfermedad actual el día de hoy 15/07/2026 " +
  "por presentar caída desde su plano de sustentación evidenciándose aumento de volumen y limitación " +
  "funcional de miembro inferior derecho; por tal motivo acude a este centro donde es evaluado por el " +
  "equipo médico de guardia.";

const ORDENES_MOLDE = [
  "1. Hospitalizar paciente a cargo del servicio de Cirugía.",
  "2. Dieta líquida.",
  "3. Hidratación parenteral: 1000 cc de solución 0,9 % a 21 gotas por minuto en 24 horas.",
  "4. Omeprazol 40 mg EV OD.",
  "5. Ketoprofeno 100 mg EV cada 12 horas.",
  "6. Metoclopramida 10 mg EV SOS náuseas/vómitos.",
  "7. Control de signos vitales cada 4 horas.",
  "8. Balance hídrico estricto.",
  "9. Reposo relativo en cama.",
  "10. Solicitar laboratorios: hematología completa, química sanguínea, amilasa/lipasa.",
  "11. Interconsulta a Medicina Interna.",
  "12. Informar al médico de guardia ante deterioro clínico.",
].join("\n");

const RECETA_RECIPE = [
  "Amoxicilina + Ácido Clavulánico 875 mg / 125 mg (Tabletas)",
  "",
  "Ibuprofeno 400 mg (Tabletas)",
].join("\n");

const RECETA_INDICACIONES = [
  "Amoxicilina + Ácido Clavulánico:",
  "Tomar 1 tableta vía oral cada 12 horas por 7 días.",
  "",
  "Ibuprofeno:",
  "Tomar 1 tableta vía oral cada 8 horas por 5 días (con alimentos).",
].join("\n");

const DIAS_REPOSO =
  "Nota: En vista de la sintomatología del paciente se indican cumplir 3 días de reposo médico completo.";

function sectionsFor(type) {
  switch (type) {
    case "informe":
      return [
        Section.DATOS_PACIENTE,
        Section.MOTIVO_CONSULTA,
        Section.ENFERMEDAD_ACTUAL,
        Section.EXAMEN_FISICO,
        Section.DIAGNOSTICO,
      ];
    case "reposo":
      return [
        Section.DATOS_PACIENTE,
        Section.MOTIVO_CONSULTA,
        Section.ENFERMEDAD_ACTUAL,
        Section.EXAMEN_FISICO,
        Section.DIAGNOSTICO,
        Section.DIAS_REPOSO,
      ];
    case "historiaClinica":
      return [
        Section.DATOS_PACIENTE,
        Section.MOTIVO_CONSULTA,
        Section.ENFERMEDAD_ACTUAL,
        Section.ANTECEDENTES_PERSONALES,
        Section.ANTECEDENTES_FAMILIARES,
        Section.HABITOS_PSICOBIOLOGICOS,
        Section.EXAMEN_FUNCIONAL,
        Section.EXAMEN_FISICO,
        Section.DIAGNOSTICO,
        Section.IMPRESION_DIAGNOSTICA,
        Section.PLAN,
        Section.OBSERVACIONES,
      ];
    case "ordenesMedicas":
      return [Section.DATOS_PACIENTE, Section.ORDENES];
    case "receta":
      return [Section.DATOS_PACIENTE, Section.RECIPE, Section.INDICACIONES];
    default:
      return [Section.DATOS_PACIENTE];
  }
}

function textsFor(type) {
  if (type === "ordenesMedicas") return { [Section.ORDENES]: ORDENES_MOLDE };
  if (type === "receta") {
    return {
      [Section.RECIPE]: RECETA_RECIPE,
      [Section.INDICACIONES]: RECETA_INDICACIONES,
    };
  }
  if (type === "reposo") return { [Section.DIAS_REPOSO]: DIAS_REPOSO };
  return {};
}

function makeDefaultTemplates() {
  return Object.keys(LABELS).map((type) => ({
    id: `clinic_default_${type}`,
    name: `Plantilla ${LABELS[type]}`,
    documentType: type,
    sections: sectionsFor(type),
    isDefault: true,
    enabledPhysicalExamSystemIds: [...EXAM_IDS],
    enfermedadActualEjemplo:
      type === "informe" || type === "historiaClinica" || type === "reposo"
        ? ENFERMEDAD_EJEMPLO
        : "",
    sectionDefaultTexts: textsFor(type),
  }));
}

function makeDefaultHeader(clinicName) {
  return {
    id: "clinic_default_header",
    name: "Encabezado del centro",
    doctorName: String(clinicName || "Centro de salud").trim() || "Centro de salud",
    subtitle: "Documentos institucionales",
    description: "",
    isDefault: true,
  };
}

/**
 * Si faltan plantillas/encabezado, los crea. No pisa los que el centro ya editó.
 * @returns {{ templates: object[], headers: object[], seeded: boolean }}
 */
async function ensureClinicDefaultCatalog(db, clinicId, clinicName) {
  const clinicRef = db.collection("clinicosdoc_clinics").doc(clinicId);
  const tplCol = clinicRef.collection("templates");
  const hdrCol = clinicRef.collection("headers");
  const [tplSnap, hdrSnap] = await Promise.all([tplCol.get(), hdrCol.get()]);

  const existingTypes = new Set(
    tplSnap.docs.map((d) => String((d.data() || {}).documentType || "")).filter(Boolean),
  );
  const needed = Object.keys(LABELS).filter((t) => !existingTypes.has(t));
  let seeded = false;
  const now = new Date().toISOString();

  if (needed.length) {
    const defaults = makeDefaultTemplates().filter((t) => needed.includes(t.documentType));
    const batch = db.batch();
    for (const t of defaults) {
      batch.set(tplCol.doc(t.id), { ...t, updatedAt: now, seededAt: now });
    }
    await batch.commit();
    seeded = true;
  }

  if (hdrSnap.empty) {
    const header = makeDefaultHeader(clinicName);
    await hdrCol.doc(header.id).set({ ...header, updatedAt: now, seededAt: now });
    seeded = true;
  }

  const [tplAfter, hdrAfter] = await Promise.all([tplCol.get(), hdrCol.get()]);
  const templates = tplAfter.docs.map((d) => {
    const data = d.data() || {};
    return {
      id: String(data.id || d.id),
      name: String(data.name || "Plantilla"),
      documentType: data.documentType,
      sections: Array.isArray(data.sections) ? data.sections.map(String) : [],
      isDefault: Boolean(data.isDefault),
      enabledPhysicalExamSystemIds: Array.isArray(data.enabledPhysicalExamSystemIds)
        ? data.enabledPhysicalExamSystemIds.map(String)
        : [],
      sectionDefaultTexts:
        data.sectionDefaultTexts && typeof data.sectionDefaultTexts === "object"
          ? data.sectionDefaultTexts
          : {},
      enfermedadActualEjemplo: String(data.enfermedadActualEjemplo || ""),
    };
  });
  const headers = hdrAfter.docs.map((d) => {
    const data = d.data() || {};
    return {
      id: String(data.id || d.id),
      name: String(data.name || "Encabezado"),
      logoBase64: data.logoBase64 || null,
      doctorName: String(data.doctorName || ""),
      subtitle: String(data.subtitle || ""),
      description: String(data.description || ""),
      isDefault: Boolean(data.isDefault),
    };
  });

  return { templates, headers, seeded };
}

module.exports = {
  makeDefaultTemplates,
  makeDefaultHeader,
  ensureClinicDefaultCatalog,
};
