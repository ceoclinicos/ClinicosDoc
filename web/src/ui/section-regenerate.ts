import type { DocumentSection } from "../services/document-parser";
import { regenerateSection, type DoctorInfo } from "../services/ai/document-ai-service";
import type { DocumentTemplate, Patient } from "../shared/models";

export interface SectionRegenerateContext {
  rawDictation: string;
  template: DocumentTemplate;
  patient: Patient;
  doctor: DoctorInfo;
  /** Lee secciones actuales del DOM (tras collectContent). */
  getSections: () => DocumentSection[];
  /** Escribe el body regenerado en el textarea de la sección. */
  applySectionBody: (index: number, body: string) => void;
  onAfterRegenerate: () => void;
}

/** Enlaza botones «Regenerar esta sección» dentro del editor de secciones. */
export function bindSectionRegenerateButtons(
  root: HTMLElement,
  ctx: SectionRegenerateContext,
): void {
  root.querySelectorAll<HTMLButtonElement>(".btn-regen-section").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const dictation = ctx.rawDictation.trim();
      if (!dictation) {
        alert("Este documento no tiene dictado original guardado.");
        return;
      }
      const idx = Number(btn.dataset.secIdx);
      if (Number.isNaN(idx)) return;

      const sections = ctx.getSections();
      const target = sections[idx];
      if (!target) return;

      const prevLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Regenerando…";
      try {
        const newBody = await regenerateSection({
          template: ctx.template,
          patient: ctx.patient,
          doctor: ctx.doctor,
          dictation,
          sectionTitle: target.title,
          currentSectionBody: target.body,
          otherSections: sections.filter((_, i) => i !== idx),
        });
        ctx.applySectionBody(idx, newBody);
        ctx.onAfterRegenerate();
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo regenerar la sección");
      } finally {
        btn.disabled = false;
        btn.textContent = prevLabel ?? "Regenerar esta sección";
      }
    });
  });
}

/** Fragmento HTML del botón regenerar (una sección). */
export function sectionRegenerateButtonHtml(index: number): string {
  return `<button type="button" class="btn btn-ghost btn-sm btn-regen-section" data-sec-idx="${index}">Regenerar esta sección</button>`;
}
