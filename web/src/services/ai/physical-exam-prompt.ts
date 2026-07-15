import { PhysicalExamDefaults } from "../../shared/physical-exam-defaults";
import type { DocumentTemplate, PhysicalExamSystem } from "../../shared/models";
import { loadJson } from "../local-store";

function loadCatalog(): PhysicalExamSystem[] {
  const stored = loadJson<PhysicalExamSystem[]>("physical_exam", []);
  return stored.length ? stored : PhysicalExamDefaults;
}

/** Bloque de examen físico para el prompt de IA (misma lógica que la app). */
export function buildPhysicalExamBlock(template: DocumentTemplate): string {
  const catalog = loadCatalog();
  const ids = template.enabledPhysicalExamSystemIds?.length
    ? template.enabledPhysicalExamSystemIds
    : catalog.map((s) => s.id);

  const systems = catalog
    .filter((s) => ids.includes(s.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (!systems.length) return "";

  const lines = [
    "SISTEMAS DE EXAMEN FÍSICO ACTIVOS (solo estos bloques; configurados en la plantilla):",
    ...systems.flatMap((s) => [`• ${s.name} [${s.id}]:`, `  Base normal: ${s.defaultText}`]),
    "",
    "REGLAS DE REDACCIÓN DEL EXAMEN FÍSICO:",
    `- Usa UNA línea por sistema activo: "${systems[0].name}: ..." (nombre exacto del catálogo).`,
    "- Parte del texto base de cada sistema.",
    "- Si el dictado trae hallazgos de un sistema, MEZCLA o REEMPLAZA solo en ese bloque.",
    "- NO inventes signos ni síntomas no dictados.",
    "- Sistemas activos sin datos en el dictado conservan el texto base normal.",
  ];
  return lines.join("\n");
}

export function loadPhysicalExamCatalog(): PhysicalExamSystem[] {
  return loadCatalog();
}
