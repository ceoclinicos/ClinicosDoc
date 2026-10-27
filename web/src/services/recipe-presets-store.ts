import type { RecipePreset, RecipePresetFarmaco } from "../shared/recipe-presets";
import { loadJson, saveJson } from "./local-store";

const KEY = "recipe_presets_v1";

export function loadRecipePresets(): RecipePreset[] {
  return loadJson<RecipePreset[]>(KEY, []).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function saveRecipePresets(list: RecipePreset[]): void {
  saveJson(KEY, list);
}

export function getRecipePreset(id: string): RecipePreset | undefined {
  return loadRecipePresets().find((r) => r.id === id);
}

export function upsertRecipePreset(input: {
  id?: string;
  name: string;
  farmacos: RecipePresetFarmaco[];
}): RecipePreset {
  const name = input.name.trim();
  if (!name) throw new Error("Indique un nombre para la receta");
  if (!input.farmacos.length) throw new Error("Agregue al menos un fármaco");
  for (const f of input.farmacos) {
    if (!f.principioActivo.trim()) throw new Error("Cada fármaco necesita principio activo");
    if (!f.indicaciones.trim()) throw new Error("Cada fármaco necesita indicaciones");
  }
  const now = new Date().toISOString();
  const all = loadRecipePresets();
  const id = input.id || crypto.randomUUID();
  const existing = all.find((r) => r.id === id);
  const preset: RecipePreset = {
    id,
    name,
    farmacos: input.farmacos.map((f) => ({
      principioActivo: f.principioActivo.trim(),
      presentacion: f.presentacion.trim() || "Tabletas",
      concentracion: f.concentracion.trim(),
      disponase: f.disponase.trim(),
      indicaciones: f.indicaciones.trim(),
    })),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  const next = existing ? all.map((r) => (r.id === id ? preset : r)) : [...all, preset];
  saveRecipePresets(next);
  return preset;
}

export function deleteRecipePreset(id: string): void {
  saveRecipePresets(loadRecipePresets().filter((r) => r.id !== id));
}
