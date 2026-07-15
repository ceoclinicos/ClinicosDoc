import { PhysicalExamDefaults, orderEnabledIds, displayPriority } from "../../shared/physical-exam-defaults";
import type { DocumentTemplate, PhysicalExamSystem } from "../../shared/models";
import { loadJson } from "../local-store";

function loadCatalog(): PhysicalExamSystem[] {
  const stored = loadJson<PhysicalExamSystem[]>("physical_exam", []);
  return stored.length ? stored : PhysicalExamDefaults;
}

function reportDisplayOrder(systems: PhysicalExamSystem[]): PhysicalExamSystem[] {
  return [...systems].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const pa = displayPriority[a.id] ?? 100;
    const pb = displayPriority[b.id] ?? 100;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

/** Sistemas activos de la plantilla, en orden clínico (paridad con la app). */
export function resolveSystemsForReport(
  template: DocumentTemplate,
  textOverrides: Record<string, string> = {},
): PhysicalExamSystem[] {
  const catalog = loadCatalog().reduce<Record<string, PhysicalExamSystem>>((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});
  const ids = orderEnabledIds(
    template.enabledPhysicalExamSystemIds?.length
      ? template.enabledPhysicalExamSystemIds
      : PhysicalExamDefaults.map((s) => s.id),
  );
  return reportDisplayOrder(
    ids
      .map((id) => catalog[id])
      .filter((s): s is PhysicalExamSystem => Boolean(s))
      .map((s) => (textOverrides[s.id] ? { ...s, defaultText: textOverrides[s.id] } : s)),
  );
}

/**
 * Bloque de examen físico para el prompt (misma lógica que PhysicalExamPromptBuilder de la app).
 */
export function buildPhysicalExamBlock(
  template: DocumentTemplate,
  textOverrides: Record<string, string> = {},
): string {
  const systems = resolveSystemsForReport(template, textOverrides);
  if (!systems.length) return "";

  const vitalsSystem = systems.find((s) => s.id === "signos_vitales");
  const bodySystems = systems.filter((s) => s.id !== "signos_vitales");
  const namesInOrder = bodySystems.map((s) => s.name).join(", ");

  const lines: string[] = [
    "SISTEMAS DE EXAMEN FÍSICO ACTIVOS (OBLIGATORIO incluir TODOS, en este orden):",
  ];
  systems.forEach((system, index) => {
    lines.push(`${index + 1}. ${system.name} [${system.id}]`);
    if (system.id === "signos_vitales") {
      lines.push("   → Solo si hay valores dictados; si no, omitir esta línea.");
    } else {
      lines.push("   → Texto base (usar intacto si el dictado NO menciona este sistema):");
      lines.push(`     "${system.name}: ${system.defaultText}"`);
    }
  });
  lines.push(
    "",
    "REGLAS OBLIGATORIAS DEL EXAMEN FÍSICO:",
    "- DEBES escribir TODOS los sistemas activos listados arriba, aunque el dictado solo mencione uno.",
    "- Ejemplo: si solo se dictó Extremidades, igual debes incluir General, Piel, Cabeza y cuello, Cardiopulmonar, Abdomen, Neurológico, etc. (los activos) con su texto base.",
    "- Solo el/los sistemas mencionados en el dictado se editan o reemplazan con los hallazgos dictados.",
    "- Los sistemas NO mencionados se copian EXACTAMENTE con su texto base (sin inventar patología ni omitirlos).",
    "- PROHIBIDO dejar solo el sistema dictado. PROHIBIDO omitir sistemas activos.",
  );
  if (bodySystems.length) {
    lines.push(`- Formato: UNA línea por sistema, empezando con el nombre exacto: "${namesInOrder}".`);
    lines.push(`- Orden exacto de aparición: ${namesInOrder}.`);
  }
  if (vitalsSystem) {
    lines.push("- Signos vitales (si dictados): línea aparte al inicio, solo valores presentes.");
    lines.push("  Formato: TA: 120/80 mmHg | FR: 18 rpm | FC: 82 lpm | SaTO2: 98%");
    lines.push("- Signos no dictados: omitirlos (no escribas 0). Si no hay ningún signo, no pongas línea de vitales.");
  }
  lines.push(
    "- Coloca cada signo en el sistema correcto (ej. Rovsing → Abdomen).",
    "- Si el dictado contradice la base de un sistema, sustituye SOLO ese sistema.",
    "- NO inventes hallazgos no dictados.",
  );
  return lines.join("\n");
}

export function loadPhysicalExamCatalog(): PhysicalExamSystem[] {
  return reportDisplayOrder(loadCatalog());
}

/** Orden clínico fijo para UI de plantilla (mismo que informe/historia). */
export function catalogInClinicalOrder(systems?: PhysicalExamSystem[]): PhysicalExamSystem[] {
  return reportDisplayOrder(systems ?? loadCatalog());
}
