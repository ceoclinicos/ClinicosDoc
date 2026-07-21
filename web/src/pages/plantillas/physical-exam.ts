import { registerRoute } from "../../app/router";
import { loadJson, saveJson } from "../../services/local-store";
import type { PhysicalExamSystem } from "../../shared/models";
import { PhysicalExamDefaults, displayPriority } from "../../shared/physical-exam-defaults";
import { canSync, deletePhysicalExamCloud, pushPhysicalExam, syncQuiet } from "../../services/cloud-sync";
import { page } from "../helpers";

const KEY = "physical_exam";

function clinicalOrder(systems: PhysicalExamSystem[]): PhysicalExamSystem[] {
  return [...systems].sort((a, b) => {
    const pa = displayPriority[a.id] ?? a.sortOrder + 100;
    const pb = displayPriority[b.id] ?? b.sortOrder + 100;
    if (pa !== pb) return pa - pb;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

function loadCatalog(): PhysicalExamSystem[] {
  return clinicalOrder(loadJson(KEY, PhysicalExamDefaults));
}

function persist(systems: PhysicalExamSystem[]): void {
  saveJson(KEY, clinicalOrder(systems));
}

registerRoute({
  path: "/plantillas/examen-fisico",
  title: "Catálogo examen físico",
  medicoOnly: true,
  render: () => {
    let systems = loadCatalog();
    const el = page(
      "Catálogo examen físico",
      `
      <p class="lead">Sistemas y texto base para la IA. Toca para editar.</p>
      <ul class="list" id="exam-list"></ul>
      <button type="button" class="btn btn-secondary" id="add-system">+ Nuevo sistema</button>
      <dialog id="edit-dialog">
        <form method="dialog" class="form" id="edit-form">
          <h2 id="dialog-title">Editar sistema</h2>
          <input type="hidden" name="id" />
          <label>Nombre<input name="name" required /></label>
          <label>Texto base<textarea name="defaultText" rows="5" required></textarea></label>
          <div class="dialog-actions">
            <button type="button" class="btn btn-ghost" id="cancel-edit">Cancelar</button>
            <button type="button" class="btn btn-ghost" id="delete-system" hidden>Eliminar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </dialog>
      `,
    );

    const list = el.querySelector("#exam-list") as HTMLElement;
    const dialog = el.querySelector("#edit-dialog") as HTMLDialogElement;
    const form = el.querySelector("#edit-form") as HTMLFormElement;
    const deleteBtn = el.querySelector("#delete-system") as HTMLButtonElement;

    function renderList(): void {
      list.innerHTML = systems
        .map(
          (s) => `
        <li class="list-item list-item-action" data-id="${s.id}">
          <div>
            <strong>${s.name}</strong>
            <p class="preview">${s.defaultText}</p>
            <small class="muted">Variable: ${s.id}</small>
          </div>
          <div class="list-item-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-edit="${s.id}">Editar</button>
            <button type="button" class="btn btn-ghost btn-sm" data-delete="${s.id}">Eliminar</button>
          </div>
        </li>`,
        )
        .join("");

      list.querySelectorAll("[data-edit]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-edit")!;
          const system = systems.find((x) => x.id === id);
          if (!system) return;
          openEdit(system);
        });
      });
      list.querySelectorAll("[data-delete]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-delete")!;
          const system = systems.find((x) => x.id === id);
          if (system) void removeSystem(system);
        });
      });
      list.querySelectorAll(".list-item-action").forEach((row) => {
        row.addEventListener("click", () => {
          const id = row.getAttribute("data-id")!;
          const system = systems.find((x) => x.id === id);
          if (system) openEdit(system);
        });
      });
    }

    function openEdit(system: PhysicalExamSystem): void {
      (form.elements.namedItem("id") as HTMLInputElement).value = system.id;
      (form.elements.namedItem("name") as HTMLInputElement).value = system.name;
      (form.elements.namedItem("defaultText") as HTMLTextAreaElement).value = system.defaultText;
      const exists = systems.some((s) => s.id === system.id);
      deleteBtn.hidden = !exists;
      dialog.showModal();
    }

    function removeSystem(system: PhysicalExamSystem): void {
      if (
        !confirm(
          `¿Eliminar "${system.name}" del catálogo? Las plantillas que lo usen dejarán de incluirlo.`,
        )
      ) {
        return;
      }
      systems = systems.filter((s) => s.id !== system.id);
      persist(systems);
      if (canSync()) syncQuiet(() => deletePhysicalExamCloud(system.id));
      dialog.close();
      renderList();
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const id = String(fd.get("id"));
      const updated: PhysicalExamSystem = {
        id,
        name: String(fd.get("name")).trim(),
        defaultText: String(fd.get("defaultText")).trim(),
        sortOrder: displayPriority[id] ?? systems.find((s) => s.id === id)?.sortOrder ?? 100,
      };
      const idx = systems.findIndex((s) => s.id === id);
      if (idx >= 0) systems[idx] = updated;
      else systems.push(updated);
      systems = clinicalOrder(systems);
      persist(systems);
      if (canSync()) syncQuiet(() => pushPhysicalExam(updated));
      dialog.close();
      renderList();
    });

    el.querySelector("#cancel-edit")?.addEventListener("click", () => dialog.close());
    deleteBtn.addEventListener("click", () => {
      const id = (form.elements.namedItem("id") as HTMLInputElement).value;
      const system = systems.find((s) => s.id === id);
      if (system) void removeSystem(system);
    });
    el.querySelector("#add-system")?.addEventListener("click", () => {
      openEdit({
        id: `sistema_${crypto.randomUUID().slice(0, 6)}`,
        name: "",
        defaultText: "",
        sortOrder: 100,
      });
    });

    renderList();
    return el;
  },
});
