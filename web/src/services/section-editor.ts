/** Editor de secciones de plantilla: activar, ordenar, editar texto ejemplo y agregar custom. */
import type { DocumentType } from "../shared/models";
import {
  SectionCatalog,
  catalogFor,
  normalizeTemplateSections,
} from "../shared/section-catalog";
import { defaultTextForSection } from "./ai/section-defaults";

export interface SectionsEditorState {
  layoutOrder: string[];
  activeSections: string[];
  sectionDefaultTexts: Record<string, string>;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function initialLayout(type: DocumentType, active: string[]): string[] {
  const catalog = catalogFor(type);
  const normalized = normalizeTemplateSections(type, active);
  const inactive = catalog.filter((s) => !normalized.includes(s));
  return [...normalized, ...inactive];
}

export function bindSectionsEditor(
  container: HTMLElement,
  options: {
    documentType: DocumentType;
    activeSections: string[];
    sectionDefaultTexts?: Record<string, string>;
    onChange: (state: SectionsEditorState) => void;
  },
): void {
  const locked = SectionCatalog.DATOS_PACIENTE;
  let layoutOrder = initialLayout(options.documentType, options.activeSections);
  let active = new Set(normalizeTemplateSections(options.documentType, options.activeSections));
  let texts: Record<string, string> = { ...(options.sectionDefaultTexts ?? {}) };

  const emit = () => {
    const activeList = normalizeTemplateSections(
      options.documentType,
      layoutOrder.filter((s) => active.has(s)),
    );
    options.onChange({
      layoutOrder,
      activeSections: activeList,
      sectionDefaultTexts: texts,
    });
  };

  const ensureDialog = (): { dialog: HTMLDialogElement; form: HTMLFormElement } => {
    let dialog = document.getElementById("section-edit-dialog") as HTMLDialogElement | null;
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "section-edit-dialog";
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = `
      <form class="form" id="section-edit-form">
        <h3 id="section-edit-title">Editar sección</h3>
        <input type="hidden" name="mode" />
        <input type="hidden" name="original" />
        <label id="section-name-label">Título<input name="name" required placeholder="Ej. Antecedentes quirúrgicos" /></label>
        <label>Texto ejemplo / predeterminado
          <textarea name="defaultText" rows="6" placeholder="Texto que usará la IA si el dictado no aporta datos…"></textarea>
        </label>
        <p class="muted">La IA usa este texto solo si el dictado no aporta datos para la sección.</p>
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" id="section-edit-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    `;
    return { dialog, form: dialog.querySelector("#section-edit-form") as HTMLFormElement };
  };

  const isEditable = (section: string) =>
    section.toLowerCase() !== locked.toLowerCase() &&
    section.toLowerCase() !== SectionCatalog.EXAMEN_FISICO.toLowerCase();

  const previewFor = (section: string) => {
    const custom = texts[section]?.trim();
    if (custom) return custom;
    return defaultTextForSection(section);
  };

  const render = () => {
    container.innerHTML = `
      <p class="muted">Marca, ordena (↑↓) y edita (✎) el texto ejemplo. Puedes agregar secciones nuevas.</p>
      <ul class="list exam-systems-editor" id="sections-list">
        ${layoutOrder
          .map((sec, i) => {
            const isLocked = sec.toLowerCase() === locked.toLowerCase();
            const checked = isLocked || active.has(sec) ? "checked" : "";
            const lockedAttr = isLocked ? "disabled" : "";
            const preview = isEditable(sec)
              ? `<span class="muted exam-sys-preview">${escapeHtml(previewFor(sec))}</span>`
              : sec.toLowerCase() === SectionCatalog.EXAMEN_FISICO.toLowerCase()
                ? `<span class="muted exam-sys-preview">Se configura en sistemas de examen físico</span>`
                : "";
            return `
          <li class="list-item exam-sys-row" data-section="${escapeAttr(sec)}">
            <label class="check-row exam-sys-check">
              <input type="checkbox" data-sec-check value="${escapeAttr(sec)}" ${checked} ${lockedAttr} />
              <span>
                <strong>${escapeHtml(sec)}</strong>
                ${preview}
              </span>
            </label>
            <div class="exam-sys-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-up ${i === 0 || isLocked ? "disabled" : ""} title="Subir">↑</button>
              <button type="button" class="btn btn-ghost btn-sm" data-down ${i === layoutOrder.length - 1 || isLocked ? "disabled" : ""} title="Bajar">↓</button>
              ${
                isEditable(sec)
                  ? `<button type="button" class="btn btn-ghost btn-sm" data-edit title="Editar texto">✎</button>`
                  : ""
              }
            </div>
          </li>`;
          })
          .join("")}
      </ul>
      <button type="button" class="btn btn-secondary btn-sm" id="section-add">+ Nueva sección</button>
    `;

    const { dialog, form } = ensureDialog();

    container.querySelectorAll("[data-sec-check]").forEach((node) => {
      node.addEventListener("change", () => {
        const input = node as HTMLInputElement;
        if (input.disabled) return;
        if (input.checked) active.add(input.value);
        else active.delete(input.value);
        emit();
      });
    });

    const move = (section: string, delta: number) => {
      const idx = layoutOrder.indexOf(section);
      const swap = idx + delta;
      if (idx < 0 || swap < 0 || swap >= layoutOrder.length) return;
      if (layoutOrder[swap]?.toLowerCase() === locked.toLowerCase()) return;
      const next = [...layoutOrder];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      layoutOrder = next;
      emit();
      render();
    };

    container.querySelectorAll("[data-up]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if ((btn as HTMLButtonElement).disabled) return;
        const sec = (btn as HTMLElement).closest("[data-section]")?.getAttribute("data-section");
        if (sec) move(sec, -1);
      });
    });

    container.querySelectorAll("[data-down]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if ((btn as HTMLButtonElement).disabled) return;
        const sec = (btn as HTMLElement).closest("[data-section]")?.getAttribute("data-section");
        if (sec) move(sec, +1);
      });
    });

    const openEdit = (section: string | null, creating: boolean) => {
      (form.elements.namedItem("mode") as HTMLInputElement).value = creating ? "create" : "edit";
      (form.elements.namedItem("original") as HTMLInputElement).value = section ?? "";
      const nameInput = form.elements.namedItem("name") as HTMLInputElement;
      const textArea = form.elements.namedItem("defaultText") as HTMLTextAreaElement;
      const nameLabel = dialog.querySelector("#section-name-label") as HTMLElement;
      if (creating) {
        nameLabel.hidden = false;
        nameInput.value = "";
        nameInput.required = true;
        textArea.value = "";
        (dialog.querySelector("#section-edit-title") as HTMLElement).textContent = "Nueva sección";
      } else {
        nameLabel.hidden = true;
        nameInput.value = section ?? "";
        nameInput.required = false;
        textArea.value = texts[section!] ?? defaultTextForSection(section!);
        (dialog.querySelector("#section-edit-title") as HTMLElement).textContent =
          `Texto ejemplo — ${section}`;
      }
      dialog.showModal();
    };

    container.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const sec = (btn as HTMLElement).closest("[data-section]")?.getAttribute("data-section");
        if (sec) openEdit(sec, false);
      });
    });

    container.querySelector("#section-add")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEdit(null, true);
    });

    dialog.querySelector("#section-edit-cancel")?.addEventListener("click", () => dialog.close());

    form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const mode = String(fd.get("mode"));
      const defaultText = String(fd.get("defaultText")).trim();
      if (mode === "create") {
        const title = String(fd.get("name")).trim();
        if (!title || title.toLowerCase() === locked.toLowerCase()) return;
        if (layoutOrder.some((s) => s.toLowerCase() === title.toLowerCase())) {
          alert("Ya existe una sección con ese nombre.");
          return;
        }
        layoutOrder = [...layoutOrder, title];
        active.add(title);
        texts = {
          ...texts,
          [title]: defaultText || "Sin datos adicionales referidos.",
        };
      } else {
        const original = String(fd.get("original"));
        if (!original) return;
        if (defaultText) texts = { ...texts, [original]: defaultText };
        else {
          const next = { ...texts };
          delete next[original];
          texts = next;
        }
      }
      emit();
      dialog.close();
      render();
    };
  };

  render();
  emit();
}
