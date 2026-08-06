import { markRedactarTutorialSeen } from "../services/onboarding";
import {
  ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT,
  loadEnfermedadActualEjemplo,
  saveEnfermedadActualEjemplo,
} from "../shared/enfermedad-actual";
import { loadExamCatalog, upsertExamSystem } from "../services/exam-catalog";
import type { PhysicalExamSystem } from "../shared/models";

function loadExamSystems(): PhysicalExamSystem[] {
  return loadExamCatalog()
    .filter((s) => s.id !== "signos_vitales" && (s.defaultText || "").trim())
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

type Phase =
  | { kind: "intro" }
  | { kind: "ea" }
  | { kind: "exam"; index: number }
  | { kind: "add" };

export type RedactarTutorialOptions = {
  onStartRedactar?: () => void;
  onClose?: () => void;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function openRedactarTutorial(options: RedactarTutorialOptions = {}): void {
  let systems = loadExamSystems();
  let eaText = loadEnfermedadActualEjemplo() || ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT;
  let editingEa = false;
  let editingExam = false;
  let examDraft = "";
  let phaseIndex = 0;

  const phases = (): Phase[] => {
    const list: Phase[] = [{ kind: "intro" }, { kind: "ea" }];
    systems.forEach((_, i) => list.push({ kind: "exam", index: i }));
    list.push({ kind: "add" });
    return list;
  };

  const dialog = document.createElement("dialog");
  dialog.className = "sheet-dialog tutorial-dialog";

  const finish = (startRedactar: boolean) => {
    markRedactarTutorialSeen();
    dialog.close();
    dialog.remove();
    if (startRedactar && options.onStartRedactar) options.onStartRedactar();
    options.onClose?.();
  };

  const goNext = () => {
    editingEa = false;
    editingExam = false;
    const list = phases();
    if (phaseIndex < list.length - 1) {
      phaseIndex++;
      render();
    } else {
      finish(false);
    }
  };

  const render = () => {
    const list = phases();
    const phase = list[phaseIndex] ?? { kind: "intro" as const };
    const isLast = phaseIndex >= list.length - 1;
    const dots = list
      .map(
        (_, i) =>
          `<span class="tutorial-dot${i === phaseIndex ? " is-active" : i < phaseIndex ? " is-done" : ""}"></span>`,
      )
      .join('<span class="tutorial-dot-line"></span>');

    let card = "";
    if (phase.kind === "intro") {
      card = `
        <p class="tutorial-step-body">Nuestra IA entiende cómo te gustan las cosas, pero debes aclarar tus preferencias en las plantillas. Comenzaremos a personalizar.</p>`;
    } else if (phase.kind === "ea") {
      card = editingEa
        ? `
        <h3 class="tutorial-step-title">Enfermedad actual</h3>
        <p class="tutorial-step-body">Cambia el ejemplo a tu gusto.</p>
        <textarea id="tutorial-ea" rows="7">${escapeHtml(eaText)}</textarea>
        <div class="tutorial-inline-actions">
          <button type="button" class="btn btn-primary" id="tutorial-ea-save">Guardar mi estilo</button>
          <button type="button" class="btn btn-ghost" id="tutorial-ea-cancel">Cancelar</button>
        </div>`
        : `
        <h3 class="tutorial-step-title">Enfermedad actual</h3>
        <p class="tutorial-step-body">¿Te gusta esta forma de redacción? Si no, cambia el ejemplo a tu gusto.</p>
        <div class="tutorial-quote">${escapeHtml(eaText)}</div>
        <div class="tutorial-inline-actions">
          <button type="button" class="btn btn-primary" id="tutorial-ea-like">Me gusta así</button>
          <button type="button" class="btn btn-secondary" id="tutorial-ea-edit">Personalizar redacción</button>
        </div>`;
    } else if (phase.kind === "exam") {
      const system = systems[phase.index];
      if (!system) {
        goNext();
        return;
      }
      card = editingExam
        ? `
        <h3 class="tutorial-step-title">Examen físico · ${phase.index + 1}/${systems.length}</h3>
        <p class="tutorial-step-body"><strong>${escapeHtml(system.name)}</strong> — modifica el texto base de este sistema.</p>
        <textarea id="tutorial-exam" rows="5">${escapeHtml(examDraft)}</textarea>
        <div class="tutorial-inline-actions">
          <button type="button" class="btn btn-primary" id="tutorial-exam-save">Guardar este sistema</button>
          <button type="button" class="btn btn-ghost" id="tutorial-exam-cancel">Cancelar</button>
        </div>`
        : `
        <h3 class="tutorial-step-title">Examen físico · ${phase.index + 1}/${systems.length}</h3>
        <p class="tutorial-step-body"><strong>${escapeHtml(system.name)}</strong> — texto base cuando no dictas hallazgos. ¿Lo dejas así?</p>
        <div class="tutorial-quote"><strong>${escapeHtml(system.name)}:</strong> ${escapeHtml(system.defaultText)}</div>
        <div class="tutorial-inline-actions">
          <button type="button" class="btn btn-primary" id="tutorial-exam-like">Me gusta así</button>
          <button type="button" class="btn btn-secondary" id="tutorial-exam-edit">Modificar este sistema</button>
        </div>`;
    } else {
      card = `
        <h3 class="tutorial-step-title">¿Falta algún sistema?</h3>
        <p class="tutorial-step-body">Si usas un sistema que no está en el modelo, añádelo en <strong>Plantillas → Catálogo examen físico</strong>.<br/><br/>
        Nota: los <strong>signos vitales</strong> solo aparecen si los dictas; si no los mencionas, no se escriben.</p>`;
    }

    const showNav = !editingEa && !editingExam;
    const subtitle =
      phase.kind === "intro"
        ? `<p class="muted">Enfermedad actual y examen físico</p>`
        : "";
    dialog.innerHTML = `
      <div class="sheet-body tutorial-body">
        <h2>Personaliza tu estilo</h2>
        ${subtitle}
        <div class="tutorial-dots" aria-hidden="true">${dots}</div>
        <div class="tutorial-step-card">${card}</div>
        <div class="tutorial-actions">
          <button type="button" class="btn btn-ghost" id="tutorial-skip">Omitir</button>
          <div class="tutorial-actions-right">
            ${
              showNav && phaseIndex > 0
                ? `<button type="button" class="btn btn-ghost" id="tutorial-prev">Anterior</button>`
                : ""
            }
            ${
              showNav && phase.kind === "intro"
                ? `<button type="button" class="btn btn-primary" id="tutorial-next">Empezar revisión</button>`
                : ""
            }
            ${
              showNav && phase.kind === "add" && options.onStartRedactar
                ? `<button type="button" class="btn btn-primary" id="tutorial-start">Redactar</button>`
                : ""
            }
            ${
              showNav && phase.kind === "add" && !options.onStartRedactar
                ? `<button type="button" class="btn btn-primary" id="tutorial-next">${isLast ? "Entendido" : "Siguiente"}</button>`
                : ""
            }
          </div>
        </div>
      </div>`;

    dialog.querySelector("#tutorial-skip")?.addEventListener("click", () => finish(false));
    dialog.querySelector("#tutorial-prev")?.addEventListener("click", () => {
      phaseIndex--;
      editingEa = false;
      editingExam = false;
      render();
    });
    dialog.querySelector("#tutorial-next")?.addEventListener("click", () => {
      if (phase.kind === "add") finish(false);
      else goNext();
    });
    dialog.querySelector("#tutorial-start")?.addEventListener("click", () => finish(true));

    dialog.querySelector("#tutorial-ea-like")?.addEventListener("click", () => {
      saveEnfermedadActualEjemplo(eaText);
      goNext();
    });
    dialog.querySelector("#tutorial-ea-edit")?.addEventListener("click", () => {
      editingEa = true;
      render();
    });
    dialog.querySelector("#tutorial-ea-cancel")?.addEventListener("click", () => {
      editingEa = false;
      eaText = loadEnfermedadActualEjemplo() || ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT;
      render();
    });
    dialog.querySelector("#tutorial-ea-save")?.addEventListener("click", () => {
      const ta = dialog.querySelector("#tutorial-ea") as HTMLTextAreaElement | null;
      eaText = ta?.value.trim() || ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT;
      saveEnfermedadActualEjemplo(eaText);
      editingEa = false;
      goNext();
    });

    dialog.querySelector("#tutorial-exam-like")?.addEventListener("click", () => goNext());
    dialog.querySelector("#tutorial-exam-edit")?.addEventListener("click", () => {
      if (phase.kind !== "exam") return;
      examDraft = systems[phase.index]?.defaultText ?? "";
      editingExam = true;
      render();
    });
    dialog.querySelector("#tutorial-exam-cancel")?.addEventListener("click", () => {
      editingExam = false;
      render();
    });
    dialog.querySelector("#tutorial-exam-save")?.addEventListener("click", () => {
      if (phase.kind !== "exam") return;
      const system = systems[phase.index];
      if (!system) return;
      const ta = dialog.querySelector("#tutorial-exam") as HTMLTextAreaElement | null;
      const next = { ...system, defaultText: (ta?.value ?? examDraft).trim() };
      upsertExamSystem(next);
      systems = loadExamSystems();
      editingExam = false;
      goNext();
    });
  };

  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    finish(false);
  });

  document.body.appendChild(dialog);
  render();
  dialog.showModal();
}
