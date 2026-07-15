/** Ejemplo editable de Enfermedad actual (paridad con EnfermedadActualStorage Android). */

export const ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT =
  "Se trata de paciente masculino de 35 años de edad, natural de Carúpano, procedente de la localidad, " +
  "sin diagnóstico patológico conocido, quien refiere inicio de enfermedad actual el día de hoy 15/07/2026 " +
  "por presentar caída desde su plano de sustentación evidenciándose aumento de volumen y limitación " +
  "funcional de miembro inferior derecho; por tal motivo acude a este centro donde es evaluado por el " +
  "equipo médico de guardia.";

export const ENFERMEDAD_ACTUAL_STYLE_RULES = [
  'Si nació y reside en el mismo sitio: use "natural y procedente de la localidad".',
  'Si nació en otro sitio y reside aquí: "natural de [lugar], procedente de la localidad".',
  'Sin enfermedad de base: "sin diagnóstico patológico conocido".',
  'Con enfermedad de base: "con diagnóstico de hipertensión arterial controlada" (adapte al dictado).',
  'Fecha de inicio: "el día de hoy dd/MM/yyyy" si es hoy, o "el día dd/MM/yyyy" si es anterior.',
  'Cierre típico: "por tal motivo acude a este centro donde es evaluado por el equipo médico de guardia" (adapte al dictado).',
].join("\n");

const STORAGE_KEY = "enfermedad_actual_ejemplo";
const OLD_DEFAULT =
  "Paciente refiere inicio de síntomas hace 3 días con dolor de características cólicas, " +
  "de intensidad moderada, localizado en epigastrio, asociado a náuseas sin vómitos, " +
  "sin fiebre referida, sin cambios en el hábito intestinal. Consultó previamente en " +
  "centro de salud donde se indicó tratamiento sintomático con mejoría parcial.";

export function loadEnfermedadActualEjemplo(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw === OLD_DEFAULT) return ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT;
    return raw;
  } catch {
    return ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT;
  }
}

export function saveEnfermedadActualEjemplo(text: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, text.trim() || ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT);
  } catch {
    /* ignore */
  }
}

export function resolveEnfermedadActualEjemplo(fromTemplate?: string): string {
  const t = (fromTemplate ?? "").trim();
  if (t) return t;
  return loadEnfermedadActualEjemplo();
}

export function enfermedadActualPromptBlock(ejemplo: string): string {
  const sample = resolveEnfermedadActualEjemplo(ejemplo);
  return [
    "ENFERMEDAD ACTUAL — ejemplo de estilo (referencia; adapta al dictado, sexo, edad y hechos reales):",
    '"""',
    sample,
    '"""',
    "Reglas de estilo:",
    ENFERMEDAD_ACTUAL_STYLE_RULES,
  ].join("\n");
}
