import type { DocumentSection } from "./document-parser";
import { parseDocumentSections, serializeDocumentSections } from "./document-parser";
import { SectionCatalog } from "../shared/section-catalog";

const DEFAULT_BODY: Record<string, string> = {
  [SectionCatalog.MOTIVO_CONSULTA]: "Evaluación médica.",
  [SectionCatalog.ENFERMEDAD_ACTUAL]:
    "Se trata de paciente referido para evaluación clínica. Sin mayores detalles aportados en la evaluación actual.",
  [SectionCatalog.EXAMEN_FISICO]:
    "TA: --- mmHg | FR: --- rpm | FC: --- lpm | SaTO2: ---%\nExamen físico según plantilla de sistemas activos.",
  [SectionCatalog.DIAGNOSTICO]: "1. Evaluación clínica.",
  [SectionCatalog.CONCLUSIONES]: "Conclusiones según hallazgos de la evaluación.",
  [SectionCatalog.PLAN]: [
    "1. Hospitalizar o mantener bajo observación 4 horas",
    "2. Omeprazol 40 mg EV",
    "3. Ketoprofeno 100 mg EV cada 12 horas",
    "4. Control de signos vitales",
  ].join("\n"),
  [SectionCatalog.RECOMENDACIONES]: [
    "1. Hospitalizar o mantener bajo observación 4 horas",
    "2. Omeprazol 40 mg EV",
    "3. Ketoprofeno 100 mg EV cada 12 horas",
    "4. Control de signos vitales",
  ].join("\n"),
  [SectionCatalog.OBSERVACIONES]: "Sin observaciones adicionales.",
  [SectionCatalog.IMPRESION_DIAGNOSTICA]:
    "Impresión diagnóstica pendiente de correlacionar con evolución clínica.",
  [SectionCatalog.DIAS_REPOSO]: "Días de reposo a indicar según criterio médico.",
  [SectionCatalog.INDICACIONES]: "Indicaciones médicas según evolución.",
};

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findByTitle(sections: DocumentSection[], title: string): DocumentSection | undefined {
  const n = norm(title);
  return sections.find((s) => norm(s.title) === n);
}

/** Heurística: párrafo "Se trata de paciente…" → Enfermedad actual. */
function looksLikeEnfermedadActual(body: string): boolean {
  return /se\s+trata\s+de\s+paciente/i.test(body.trim());
}

/**
 * Garantiza que el cuerpo tenga TODAS las secciones clínicas pedidas (orden plantilla),
 * con marcadores [[SECTION:…]]. Corrige el caso típico: Motivo no sale y la narrativa
 * queda sin título.
 */
export function ensureTemplateSections(content: string, requiredClinical: string[]): string {
  const required = requiredClinical.filter(
    (s) => norm(s) !== norm(SectionCatalog.DATOS_PACIENTE),
  );
  if (!required.length) return content.trim();

  let parsed = parseDocumentSections(content);
  // Si solo hay un bloque sin título, intentar clasificarlo
  if (parsed.length === 1 && !parsed[0].title.trim() && parsed[0].body.trim()) {
    const body = parsed[0].body;
    if (looksLikeEnfermedadActual(body) && required.some((r) => norm(r) === norm(SectionCatalog.ENFERMEDAD_ACTUAL))) {
      parsed = [{ ...parsed[0], title: SectionCatalog.ENFERMEDAD_ACTUAL }];
    }
  }

  // Bloque sin título + se pide Enfermedad actual y no existe aún
  const untitled = parsed.filter((s) => !s.title.trim() && s.body.trim());
  for (const u of untitled) {
    if (
      looksLikeEnfermedadActual(u.body) &&
      required.some((r) => norm(r) === norm(SectionCatalog.ENFERMEDAD_ACTUAL)) &&
      !findByTitle(parsed, SectionCatalog.ENFERMEDAD_ACTUAL)
    ) {
      u.title = SectionCatalog.ENFERMEDAD_ACTUAL;
    }
  }

  const byNorm = new Map<string, DocumentSection>();
  for (const s of parsed) {
    const key = norm(s.title);
    if (!key) continue;
    if (!byNorm.has(key)) byNorm.set(key, s);
  }

  const ordered: DocumentSection[] = required.map((title) => {
    const existing = byNorm.get(norm(title));
    if (existing) {
      byNorm.delete(norm(title));
      return { ...existing, title }; // nombre canónico de plantilla
    }
    return {
      id: crypto.randomUUID(),
      title,
      body: DEFAULT_BODY[title] ?? "Sin datos adicionales referidos.",
    };
  });

  // Conservar extras tituladas no previstas (p.ej. inventadas por la IA) al final
  for (const s of byNorm.values()) {
    if (s.body.trim()) ordered.push(s);
  }

  return serializeDocumentSections(ordered);
}
