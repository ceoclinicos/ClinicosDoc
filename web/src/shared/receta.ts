/** Molde y pautas de Receta médica (paridad con RecetaDefaults.kt). */

export const RECIPE_SECTION = "Recipe";
export const RECETA_INDICACIONES_SECTION = "Indicaciones";

export type RecetaFuente = "dictar" | "informe" | "diagnostico";

export const RECETA_PRESENTACIONES = [
  "Tabletas",
  "Cápsulas",
  "Jarabe",
  "Suspensión",
  "Gotas",
  "Crema",
  "Ungüento",
  "Gel",
  "Inyectable",
  "Sobres",
  "Óvulos",
  "Otro",
] as const;

export const RECETA_MOLDE_RECIPE = [
  "Amoxicilina + Ácido Clavulánico 875 mg / 125 mg (Tabletas)",
  "Dispóngase: 14 tabletas.",
  "",
  "Ibuprofeno 400 mg (Tabletas)",
  "Dispóngase: 20 tabletas.",
].join("\n");

/** Títulos válidos de la sección Recipe (paridad PDF Android). */
export function isRecipeSectionTitle(title: string): boolean {
  const t = title.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return t === "recipe" || t === "rp" || t === "farmacos";
}

export function isRecetaIndicacionesTitle(title: string): boolean {
  return title.trim().toLowerCase() === RECETA_INDICACIONES_SECTION.toLowerCase();
}

export const RECETA_MOLDE_INDICACIONES = [
  "Amoxicilina + Ácido Clavulánico:",
  "Tomar 1 tableta vía oral cada 12 horas por 7 días.",
  "",
  "Ibuprofeno:",
  "Tomar 1 tableta vía oral cada 8 horas por 5 días (con alimentos).",
].join("\n");

export function recetaPromptBlock(
  moldeRecipe = RECETA_MOLDE_RECIPE,
  moldeIndicaciones = RECETA_MOLDE_INDICACIONES,
  allowProtocolInference = false,
): string {
  return [
    "FORMATO OBLIGATORIO DE RECETA MÉDICA:",
    "- Responde SOLO con dos secciones marcadas exactamente así:",
    "  [[SECTION:Recipe]]",
    "  [[SECTION:Indicaciones]]",
    "- NO incluyas Motivo de consulta, datos del paciente ni encabezado.",
    allowProtocolInference
      ? "- Basas el tratamiento en protocolos clínicos y guías científicas (primera línea habitual VE/LatAm)."
      : "- NO inventes fármacos que no estén en el dictado/caso.",
    "",
    "SECCIÓN Recipe (lo que se dispensa en farmacia):",
    "- Por cada medicamento: nombre + concentración + forma en una línea.",
    '- Debajo: "Dispóngase: N tabletas/frasco/…".',
    "- Ejemplo de estilo:",
    "---",
    moldeRecipe,
    "---",
    "",
    "SECCIÓN Indicaciones (cómo tomarlo el paciente):",
    '- Nombre con ":" y debajo posología (vía, dosis, frecuencia, duración).',
    "- Ejemplo de estilo:",
    "---",
    moldeIndicaciones,
    "---",
    "",
    "El orden de fármacos en Recipe e Indicaciones debe coincidir.",
  ].join("\n");
}
