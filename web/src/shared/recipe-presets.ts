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
  /** Dosis ponderal pediátrica en mg/kg/día ("" = no aplica). */
  dosisPonderalMgKg?: string;
  /** Tomas al día en que se divide la dosis ponderal (0 = no aplica, 2..6). */
  tomasAlDia?: number;
}

/** Marcador en indicaciones donde se inserta la dosis calculada. */
export const DOSIS_PLACEHOLDER = "{dosis}";

function fmtNum(v: number): string {
  return v % 1 === 0 ? String(Math.trunc(v)) : v.toFixed(1);
}

function ponderal(f: RecipePresetFarmaco): number | null {
  const p = Number(String(f.dosisPonderalMgKg || "").trim().replace(",", "."));
  return p > 0 ? p : null;
}

function concentracionMgMl(f: RecipePresetFarmaco): [number, number] | null {
  const m = /(\d+(?:[.,]\d+)?)\s*mg\s*\/\s*(\d+(?:[.,]\d+)?)\s*ml/i.exec(f.concentracion || "");
  if (!m) return null;
  const mg = Number(m[1].replace(",", "."));
  const ml = Number(m[2].replace(",", "."));
  return mg > 0 && ml > 0 ? [mg, ml] : null;
}

export function tieneDosisPonderal(f: RecipePresetFarmaco): boolean {
  const t = f.tomasAlDia || 0;
  return ponderal(f) != null && t >= 2 && t <= 6;
}

/** mg por toma según ponderal × peso ÷ tomas. */
export function mgPorToma(
  f: RecipePresetFarmaco,
  pesoKg: number | null | undefined,
): number | null {
  const p = ponderal(f);
  const t = f.tomasAlDia || 0;
  if (!p || !pesoKg || pesoKg <= 0 || t < 2 || t > 6) return null;
  return (p * pesoKg) / t;
}

/** cc (ml) por toma, solo si la concentración es "X mg/Y ml". */
export function mlPorToma(
  f: RecipePresetFarmaco,
  pesoKg: number | null | undefined,
): number | null {
  const mg = mgPorToma(f, pesoKg);
  const conc = concentracionMgMl(f);
  if (mg == null || !conc) return null;
  return mg / (conc[0] / conc[1]);
}

/**
 * Texto de dosis pediátrica. Si se pasa mlOverride (valor editado por el
 * médico) se usa ese en lugar del calculado.
 */
export function dosisPediatricaTexto(
  f: RecipePresetFarmaco,
  pesoKg: number | null | undefined,
  mlOverride?: number | null,
): string | null {
  const p = ponderal(f);
  const tomas = f.tomasAlDia || 0;
  if (!p || !pesoKg || pesoKg <= 0 || tomas < 2 || tomas > 6) return null;
  const mgToma = (p * pesoKg) / tomas;
  const conc = concentracionMgMl(f);
  let dosisTxt: string;
  if (mlOverride != null && mlOverride > 0) {
    const mgTxt = conc ? ` (${fmtNum(mlOverride * (conc[0] / conc[1]))} mg)` : "";
    dosisTxt = `${fmtNum(mlOverride)} cc${mgTxt}`;
  } else if (conc) {
    dosisTxt = `${fmtNum(mgToma / (conc[0] / conc[1]))} cc (${fmtNum(mgToma)} mg)`;
  } else {
    dosisTxt = `${fmtNum(mgToma)} mg`;
  }
  return (
    `Dosis pediátrica: ${dosisTxt} por toma ` +
    `(${String(f.dosisPonderalMgKg).trim()} mg/kg/día × ${fmtNum(pesoKg)} kg ÷ ${tomas} tomas).`
  );
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

/**
 * Contenido del documento clínico (mismo formato que redactar receta).
 * mlOverrides: ml por toma editados por el médico, por índice de fármaco.
 * Si las indicaciones contienen "{dosis}" se reemplaza ahí; si no, se
 * agrega una línea "Dosis pediátrica: …".
 */
export function buildRecipePresetContent(
  farmacos: RecipePresetFarmaco[],
  pesoKg: number | null = null,
  mlOverrides: Record<number, number> = {},
): string {
  const recipeBody = farmacos.map(formatFarmacoRecipeLine).join("\n\n");
  const indicacionesBody = farmacos
    .map((f, idx) => {
      const name = f.principioActivo.trim();
      let ind = f.indicaciones.trim() || "Según indicación médica.";
      const override = mlOverrides[idx];
      if (ind.includes(DOSIS_PLACEHOLDER) && tieneDosisPonderal(f) && pesoKg != null) {
        const ml = override ?? mlPorToma(f, pesoKg);
        const mg = mgPorToma(f, pesoKg);
        const txt = ml != null ? `${fmtNum(ml)} ml` : mg != null ? `${fmtNum(mg)} mg` : null;
        if (txt) ind = ind.split(DOSIS_PLACEHOLDER).join(txt);
        return `${name}:\n${ind}`;
      }
      const ped = dosisPediatricaTexto(f, pesoKg, override);
      return ped ? `${name}:\n${ind}\n${ped}` : `${name}:\n${ind}`;
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
      const ped = tieneDosisPonderal(f)
        ? `\nPonderal: ${String(f.dosisPonderalMgKg).trim()} mg/kg/día ÷ ${f.tomasAlDia} tomas`
        : "";
      return `${line}\n→ ${ind}${ped}`;
    })
    .join("\n\n");
}
