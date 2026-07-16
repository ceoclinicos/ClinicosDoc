/** Catálogo de examen físico con orden, crear y editar (paridad con la app). */
import type { PhysicalExamSystem } from "../shared/models";
import { PhysicalExamDefaults, displayPriority } from "../shared/physical-exam-defaults";
import { loadJson, saveJson } from "./local-store";
import { canSync, pushPhysicalExam, syncQuiet } from "./cloud-sync";

const KEY = "physical_exam";

export function clinicalOrder(systems: PhysicalExamSystem[]): PhysicalExamSystem[] {
  return [...systems].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const pa = displayPriority[a.id] ?? 100;
    const pb = displayPriority[b.id] ?? 100;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

export function loadExamCatalog(): PhysicalExamSystem[] {
  return clinicalOrder(loadJson(KEY, PhysicalExamDefaults));
}

function persistCatalog(systems: PhysicalExamSystem[]): PhysicalExamSystem[] {
  const ordered = clinicalOrder(systems).map((s, i) => ({ ...s, sortOrder: i }));
  saveJson(KEY, ordered);
  return ordered;
}

/** Persiste el orden actual del array (sin reordenar por sortOrder viejo). */
function persistInArrayOrder(systems: PhysicalExamSystem[]): PhysicalExamSystem[] {
  const renumbered = systems.map((s, i) => ({ ...s, sortOrder: i }));
  saveJson(KEY, renumbered);
  return renumbered;
}

export function orderEnabledByCatalog(ids: string[], catalog: PhysicalExamSystem[]): string[] {
  const set = new Set(ids);
  const known = clinicalOrder(catalog)
    .map((s) => s.id)
    .filter((id) => set.has(id));
  const unknown = ids.filter((id) => !catalog.some((s) => s.id === id));
  return [...known, ...unknown];
}

export function moveExamSystem(id: string, delta: number): PhysicalExamSystem[] {
  const ordered = loadExamCatalog();
  const idx = ordered.findIndex((s) => s.id === id);
  const swap = idx + delta;
  if (idx < 0 || swap < 0 || swap >= ordered.length) return ordered;
  const next = [...ordered];
  [next[idx], next[swap]] = [next[swap], next[idx]];
  // Importante: renumerar en el orden del swap; no volver a clinicalOrder()
  // con sortOrder antiguos (eso deshacía el movimiento).
  return persistInArrayOrder(next);
}

export function upsertExamSystem(system: PhysicalExamSystem): PhysicalExamSystem[] {
  const all = loadExamCatalog();
  const idx = all.findIndex((s) => s.id === system.id);
  const next = [...all];
  if (idx >= 0) next[idx] = system;
  else next.push({ ...system, sortOrder: all.length });
  const saved = persistCatalog(next);
  if (canSync()) syncQuiet(() => pushPhysicalExam(system));
  return saved;
}

export function createExamSystem(name: string, defaultText: string): PhysicalExamSystem {
  const slug =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "sistema";
  return {
    id: `${slug}_${crypto.randomUUID().slice(0, 6)}`,
    name: name.trim(),
    defaultText: defaultText.trim(),
    sortOrder: 999,
  };
}

/** HTML + handlers para lista editable de sistemas en plantillas. */
export function bindExamSystemsEditor(
  container: HTMLElement,
  options: {
    enabledIds: string[];
    onChange: (enabledIds: string[], catalog: PhysicalExamSystem[]) => void;
  },
): void {
  let catalog = loadExamCatalog();
  let enabled = new Set(options.enabledIds.length ? options.enabledIds : catalog.map((s) => s.id));

  const emit = () => {
    options.onChange(
      orderEnabledByCatalog([...enabled], catalog),
      catalog,
    );
  };

  /** Dialog fuera de cualquier <form> padre (formularios anidados rompen showModal / submit). */
  const ensureDialog = (): { dialog: HTMLDialogElement; form: HTMLFormElement } => {
    let dialog = document.getElementById("exam-sys-dialog") as HTMLDialogElement | null;
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "exam-sys-dialog";
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = `
      <form class="form" id="exam-sys-form">
        <h3 id="exam-sys-title">Editar sistema</h3>
        <input type="hidden" name="id" />
        <label>Nombre<input name="name" required placeholder="Ej. Genitourinario" /></label>
        <label>Texto base (ejemplo)<textarea name="defaultText" rows="5" required placeholder="Texto predeterminado del sistema…"></textarea></label>
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" id="exam-sys-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>
    `;
    const form = dialog.querySelector("#exam-sys-form") as HTMLFormElement;
    return { dialog, form };
  };

  const render = () => {
    catalog = clinicalOrder(catalog);
    container.innerHTML = `
      <p class="muted">Activa, ordena (↑↓) y edita (✎) los sistemas. Puedes crear nuevos.</p>
      <ul class="list exam-systems-editor" id="exam-sys-list">
        ${catalog
          .map(
            (s, i) => `
          <li class="list-item exam-sys-row" data-id="${escapeAttr(s.id)}">
            <label class="check-row exam-sys-check">
              <input type="checkbox" data-exam-check value="${escapeAttr(s.id)}" ${enabled.has(s.id) ? "checked" : ""} />
              <span>
                <strong>${escapeHtml(s.name)}</strong>
                <span class="muted exam-sys-preview">${escapeHtml(s.defaultText || "(sin texto)")}</span>
              </span>
            </label>
            <div class="exam-sys-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-up ${i === 0 ? "disabled" : ""} title="Subir">↑</button>
              <button type="button" class="btn btn-ghost btn-sm" data-down ${i === catalog.length - 1 ? "disabled" : ""} title="Bajar">↓</button>
              <button type="button" class="btn btn-ghost btn-sm" data-edit title="Editar">✎</button>
            </div>
          </li>`,
          )
          .join("")}
      </ul>
      <button type="button" class="btn btn-secondary btn-sm" id="exam-sys-add">+ Nuevo sistema</button>
    `;

    const { dialog, form } = ensureDialog();

    container.querySelectorAll("[data-exam-check]").forEach((node) => {
      node.addEventListener("change", () => {
        const input = node as HTMLInputElement;
        if (input.checked) enabled.add(input.value);
        else enabled.delete(input.value);
        emit();
      });
    });

    container.querySelectorAll("[data-up]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if ((btn as HTMLButtonElement).disabled) return;
        const id = (btn as HTMLElement).closest("[data-id]")?.getAttribute("data-id");
        if (!id) return;
        catalog = moveExamSystem(id, -1);
        emit();
        render();
      });
    });

    container.querySelectorAll("[data-down]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if ((btn as HTMLButtonElement).disabled) return;
        const id = (btn as HTMLElement).closest("[data-id]")?.getAttribute("data-id");
        if (!id) return;
        catalog = moveExamSystem(id, +1);
        emit();
        render();
      });
    });

    const openEdit = (system: PhysicalExamSystem, creating: boolean) => {
      (form.elements.namedItem("id") as HTMLInputElement).value = system.id;
      (form.elements.namedItem("name") as HTMLInputElement).value = system.name;
      (form.elements.namedItem("defaultText") as HTMLTextAreaElement).value = system.defaultText;
      (dialog.querySelector("#exam-sys-title") as HTMLElement).textContent = creating
        ? "Nuevo sistema"
        : `Editar ${system.name}`;
      dialog.showModal();
    };

    container.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = (btn as HTMLElement).closest("[data-id]")?.getAttribute("data-id");
        const system = catalog.find((s) => s.id === id);
        if (system) openEdit(system, false);
      });
    });

    container.querySelector("#exam-sys-add")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEdit(createExamSystem("", ""), true);
    });

    dialog.querySelector("#exam-sys-cancel")?.addEventListener("click", () => dialog.close());

    form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const id = String(fd.get("id"));
      const name = String(fd.get("name")).trim();
      const defaultText = String(fd.get("defaultText")).trim();
      if (!name) return;
      const existing = catalog.find((s) => s.id === id);
      const system: PhysicalExamSystem = existing
        ? { ...existing, name, defaultText }
        : { ...createExamSystem(name, defaultText), name, defaultText };
      if (!existing) enabled.add(system.id);
      catalog = upsertExamSystem(system);
      emit();
      dialog.close();
      render();
    };
  };

  render();
  emit();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
