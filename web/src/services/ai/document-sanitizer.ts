import type { PhysicalExamSystem } from "../../shared/models";
import { priorityForName } from "../../shared/physical-exam-defaults";

const PATIENT_LINE = /^(nombre|edad|sexo|fecha)\s*:/i;
const PATIENT_SECTION = /^datos del paciente$/i;
const DOCUMENT_TITLE_LINE =
  /^(\*\*)?\s*(informe\s+m[eé]dico|historia\s+cl[ií]nica|reposo\s+m[eé]dico)\s*(\*\*)?:?\s*$/i;
const SECTION_MARKER = /^\[\[SECTION:(.+?)]]\s*$/;
const EXAMEN_FISICO_SECTION = /^examen\s+f[ií]sico$/i;
const SYSTEM_LINE_START =
  /^(signos\s+vitales|general|piel|cabeza(\s+y\s+|\s*\/\s*)?cuello|cardiopulmonar|abdomen|extremidades|neurol[oó]gico)\s*[:\-]?\s*/i;

export function sanitizeDocumentContent(content: string): string {
  let text = content.trim();
  text = removePatientDataSection(text);
  text = removeLeadingPatientLines(text);
  text = text
    .split("\n")
    .filter((line) => !DOCUMENT_TITLE_LINE.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  text = reorderPhysicalExamSystems(text);
  return text;
}

/**
 * Completa sistemas activos faltantes con su texto base (paridad con la intención de la app).
 * Signos vitales solo se insertan si la IA ya los trajo.
 */
export function ensurePhysicalExamSystems(
  content: string,
  systems: PhysicalExamSystem[],
): string {
  if (!systems.length || !content.includes("[[SECTION:")) return content;

  const bodySystems = systems.filter((s) => s.id !== "signos_vitales" && s.defaultText.trim());
  if (!bodySystems.length) return content;

  const chunks = content
    .split(/(?=\[\[SECTION:[^\]]+]])/)
    .map((c) => c.trim())
    .filter(Boolean);

  return chunks
    .map((chunk) => {
      const lines = chunk.split("\n");
      const first = lines[0]?.trim() ?? "";
      const m = SECTION_MARKER.exec(first);
      const title = m?.[1]?.trim() ?? "";
      if (!EXAMEN_FISICO_SECTION.test(title)) return chunk;

      const body = lines.slice(1).join("\n");
      const present = new Set<string>();
      for (const line of body.split("\n")) {
        const match = SYSTEM_LINE_START.exec(line.trim());
        if (!match) continue;
        const key = normalizeSystemKey(match[1]);
        if (key) present.add(key);
      }

      const missingLines = bodySystems
        .filter((s) => !present.has(normalizeSystemKey(s.name)))
        .map((s) => `${s.name}: ${s.defaultText}`);

      if (!missingLines.length) {
        return `${first}\n${reorderExamBodyLines(body)}`.trim();
      }

      const merged = [body.trim(), ...missingLines].filter(Boolean).join("\n");
      return `${first}\n${reorderExamBodyLines(merged)}`.trim();
    })
    .join("\n\n");
}

function normalizeSystemKey(name: string): string {
  const n = name.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (n.startsWith("signos")) return "signos";
  if (n.startsWith("general")) return "general";
  if (n.startsWith("piel")) return "piel";
  if (n.startsWith("cabeza")) return "cabeza";
  if (n.startsWith("cardiopulmonar") || n.startsWith("cardio")) return "cardio";
  if (n.startsWith("abdomen")) return "abdomen";
  if (n.startsWith("extremidades")) return "extremidades";
  if (n.startsWith("neurol")) return "neurologico";
  return n;
}

function reorderPhysicalExamSystems(content: string): string {
  if (!content.includes("[[SECTION:")) return reorderExamBodyLines(content);
  const chunks = content
    .split(/(?=\[\[SECTION:[^\]]+]])/)
    .map((c) => c.trim())
    .filter(Boolean);
  return chunks
    .map((chunk) => {
      const lines = chunk.split("\n");
      const first = lines[0]?.trim() ?? "";
      const m = SECTION_MARKER.exec(first);
      const title = m?.[1]?.trim() ?? "";
      if (!EXAMEN_FISICO_SECTION.test(title)) return chunk;
      const body = lines.slice(1).join("\n");
      return `${first}\n${reorderExamBodyLines(body)}`.trim();
    })
    .join("\n\n");
}

function reorderExamBodyLines(body: string): string {
  const lines = body.split("\n");
  if (!lines.some((l) => SYSTEM_LINE_START.test(l.trim()))) return body;

  type Block = { priority: number; text: string; index: number };
  const preamble: string[] = [];
  const blocks: Block[] = [];
  let current: string[] | null = null;
  let currentPriority = 100;
  let blockIndex = 0;

  const flush = () => {
    if (!current) return;
    blocks.push({
      priority: currentPriority,
      text: current.join("\n").trim(),
      index: blockIndex++,
    });
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const match = SYSTEM_LINE_START.exec(trimmed);
    if (match) {
      flush();
      currentPriority = priorityForName(match[1]);
      current = [line];
    } else if (current) {
      current.push(line);
    } else {
      preamble.push(line);
    }
  }
  flush();

  if (blocks.length < 2) return body;
  const ordered = [...blocks].sort((a, b) =>
    a.priority !== b.priority ? a.priority - b.priority : a.index - b.index,
  );
  return [...preamble, ...ordered.map((b) => b.text)].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function removePatientDataSection(content: string): string {
  if (content.includes("[[SECTION:")) {
    const chunks = content.split(/(?=\[\[SECTION:[^\]]+]])/).map((c) => c.trim()).filter(Boolean);
    return chunks
      .filter((chunk) => {
        const first = chunk.split("\n")[0]?.trim() ?? "";
        const m = SECTION_MARKER.exec(first);
        const title = m?.[1]?.trim() ?? "";
        return !PATIENT_SECTION.test(title);
      })
      .join("\n\n");
  }
  return content;
}

function removeLeadingPatientLines(content: string): string {
  const lines = content.split("\n");
  while (lines.length) {
    const line = lines[0].trim();
    if (!line) {
      lines.shift();
      continue;
    }
    if (PATIENT_LINE.test(line) || /\*\*datos del paciente\*\*/i.test(line)) {
      lines.shift();
      continue;
    }
    if (DOCUMENT_TITLE_LINE.test(line)) {
      lines.shift();
      continue;
    }
    break;
  }
  return lines.join("\n");
}
