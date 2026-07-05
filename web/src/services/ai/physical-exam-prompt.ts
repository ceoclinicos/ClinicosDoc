import { PhysicalExamDefaults } from "../../shared/physical-exam-defaults";
import type { DocumentTemplate } from "../../shared/models";

export function buildPhysicalExamBlock(template: DocumentTemplate): string {
  const ids = template.enabledPhysicalExamSystemIds?.length
    ? template.enabledPhysicalExamSystemIds
    : PhysicalExamDefaults.map((s) => s.id);

  const systems = PhysicalExamDefaults.filter((s) => ids.includes(s.id)).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
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
