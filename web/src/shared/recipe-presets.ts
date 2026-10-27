/** Recetas predeterminadas del médico (biblioteca personal). */
import { RECIPE_SECTION, RECETA_INDICACIONES_SECTION } from "./receta";

export interface RecipePresetFarmaco {
  principioActivo: string;
  presentacion: string;
  concentracion: string;
  /** Cantidad a dispensar, opcional (ej. "14 tabletas"). */
  disponase: string;
  /** Cómo tomarlo el paciente. */
  indicaciones: string;
}

export interface RecipePreset {
  id: string;
  name: string;
  farmacos: RecipePresetFarmaco[];
  createdAt: string;
  updatedAt: string;
}

export function formatFarmacoRecipeLine(f: RecipePresetFarmaco): string {
  const conc = f.concentracion.trim();
  const base = conc
    ? `${f.principioActivo.trim()} ${conc} (${f.presentacion.trim()})`
    : `${f.principioActivo.trim()} (${f.presentacion.trim()})`;
  const disp = f.disponase.trim();
  if (!disp) return base;
  return `${base}\nDispóngase: ${disp}`;
}

/** Contenido del documento clínico (mismo formato que redactar receta). */
export function buildRecipePresetContent(farmacos: RecipePresetFarmaco[]): string {
  const recipeBody = farmacos.map(formatFarmacoRecipeLine).join("\n\n");
  const indicacionesBody = farmacos
    .map((f) => {
      const name = f.principioActivo.trim();
      const ind = f.indicaciones.trim() || "Según indicación médica.";
      return `${name}:\n${ind}`;
    })
    .join("\n\n");
  return [
    `[[SECTION:${RECIPE_SECTION}]]`,
    recipeBody,
    "",
    `[[SECTION:${RECETA_INDICACIONES_SECTION}]]`,
    indicacionesBody,
  ].join("\n");
}

export function previewRecipeText(preset: RecipePreset): string {
  if (!preset.farmacos.length) return "(Sin fármacos)";
  return preset.farmacos
    .map((f) => {
      const line = formatFarmacoRecipeLine(f);
      const ind = f.indicaciones.trim() || "—";
      return `${line}\n→ ${ind}`;
    })
    .join("\n\n");
}
