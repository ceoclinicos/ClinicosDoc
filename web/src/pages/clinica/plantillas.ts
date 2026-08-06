import { registerRoute } from "../../app/router";
import { getClinicSession } from "../../clinic/session";
import {
  deleteClinicTemplate,
  listClinicTemplates,
  upsertClinicTemplate,
} from "../../clinic/store";
import type { DocumentTemplate, DocumentType } from "../../shared/models";
import { DocumentTypeLabels } from "../../shared/models";
import { defaultSectionsFor } from "../../shared/section-catalog";
import { PhysicalExamDefaults } from "../../shared/physical-exam-defaults";
import { bindSectionsEditor } from "../../services/section-editor";
import { bindNavButtons, page } from "../helpers";

const DOC_TYPES: DocumentType[] = [
  "historiaClinica",
  "informe",
  "reposo",
  "ordenesMedicas",
  "receta",
];

registerRoute({
  path: "/clinica/plantillas",
  title: "Plantillas",
  clinicOnly: true,
  nav: true,
  navLabel: "Plantillas",
  render: () => {
    const session = getClinicSession()!;
    const el = page(
      "Plantillas institucionales",
      `
      <p class="lead">Moldes que usarán los médicos vinculados. Puedes crear varios del mismo tipo (ej. HC femenina, masculina, pediatría).</p>
      <div class="grid-2" style="margin-bottom:1rem">
        <button type="button" class="tile tile-home" data-nav="/clinica/encabezados">
          <strong>Encabezados</strong>
          <span class="muted">Logo y membrete del centro</span>
        </button>
      </div>
      <button type="button" class="btn btn-secondary" id="btn-add">+ Nuevo molde</button>
      <div id="status" class="muted" style="margin-top:0.75rem">Cargando…</div>
      <ul class="list" id="tpl-list"></ul>
      <dialog id="edit-dialog">
        <form method="dialog" class="form" id="edit-form" style="min-width:min(100%,28rem)">
          <h2>Molde del centro</h2>
          <input type="hidden" name="id" />
          <label>Nombre<input name="name" required placeholder="Ej. HC Day Hospital" /></label>
          <label>Tipo de documento
            <select name="documentType" required>
              ${DOC_TYPES.map((t) => `<option value="${t}">${DocumentTypeLabels[t]}</option>`).join("")}
            </select>
          </label>
          <div id="sections-root"></div>
          <label class="check-row"><input type="checkbox" name="isDefault" /> Predeterminado para este tipo</label>
          <div class="dialog-actions">
            <button type="button" class="btn btn-ghost" id="cancel-edit">Cancelar</button>
            <button type="button" class="btn btn-ghost" id="btn-delete" hidden>Eliminar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </dialog>
      `,
    );

    const status = el.querySelector("#status") as HTMLElement;
    const list = el.querySelector("#tpl-list") as HTMLElement;
    const dialog = el.querySelector("#edit-dialog") as HTMLDialogElement;
    const form = el.querySelector("#edit-form") as HTMLFormElement;
    const btnDelete = el.querySelector("#btn-delete") as HTMLButtonElement;
    const sectionsRoot = el.querySelector("#sections-root") as HTMLElement;
    let templates: DocumentTemplate[] = [];
    let draftSections: string[] = [];
    let draftSectionTexts: Record<string, string> = {};

    function escapeHtml(s: string): string {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function bindSections(type: DocumentType, sections: string[], texts?: Record<string, string>): void {
      draftSections = [...sections];
      draftSectionTexts = { ...(texts ?? {}) };
      bindSectionsEditor(sectionsRoot, {
        documentType: type,
        activeSections: draftSections,
        sectionDefaultTexts: draftSectionTexts,
        onChange: (state) => {
          draftSections = state.activeSections;
          draftSectionTexts = state.sectionDefaultTexts;
        },
      });
    }

    async function refresh(): Promise<void> {
      try {
        templates = await listClinicTemplates(session.clinicId);
        if (!templates.length) {
          status.textContent = "Sin moldes aún. Crea el primero.";
          list.innerHTML = "";
          return;
        }
        status.textContent = `${templates.length} molde(s)`;
        list.innerHTML = templates
          .map(
            (t) => `
          <li class="list-item list-item-action" data-id="${t.id}">
            <div>
              <strong>${escapeHtml(t.name)}</strong>
              <p class="muted">${DocumentTypeLabels[t.documentType]} · ${t.sections.length} secciones</p>
              ${t.isDefault ? `<span class="status-badge status-ok">Predeterminado</span>` : ""}
            </div>
            <button type="button" class="btn btn-ghost btn-sm" data-edit="${t.id}">Editar</button>
          </li>`,
          )
          .join("");
        list.querySelectorAll("[data-edit], .list-item-action").forEach((node) => {
          node.addEventListener("click", (e) => {
            e.stopPropagation();
            const id =
              (node as HTMLElement).getAttribute("data-edit") ||
              (node as HTMLElement).getAttribute("data-id");
            const t = templates.find((x) => x.id === id);
            if (t) openEdit(t);
          });
        });
      } catch (err) {
        status.textContent = err instanceof Error ? err.message : "Error al cargar";
      }
    }

    function openEdit(t: DocumentTemplate, isNew = false): void {
      (form.elements.namedItem("id") as HTMLInputElement).value = t.id;
      (form.elements.namedItem("name") as HTMLInputElement).value = t.name;
      (form.elements.namedItem("documentType") as HTMLSelectElement).value = t.documentType;
      (form.elements.namedItem("isDefault") as HTMLInputElement).checked = t.isDefault;
      bindSections(t.documentType, t.sections, t.sectionDefaultTexts);
      btnDelete.hidden = isNew;
      dialog.showModal();
    }

    form.querySelector('[name="documentType"]')?.addEventListener("change", () => {
      const type = (form.elements.namedItem("documentType") as HTMLSelectElement).value as DocumentType;
      bindSections(type, defaultSectionsFor(type));
    });

    el.querySelector("#btn-add")?.addEventListener("click", () => {
      openEdit(
        {
          id: crypto.randomUUID(),
          name: "Nuevo molde",
          documentType: "historiaClinica",
          sections: defaultSectionsFor("historiaClinica"),
          isDefault: templates.length === 0,
          enabledPhysicalExamSystemIds: PhysicalExamDefaults.map((s) => s.id),
        },
        true,
      );
    });

    el.querySelector("#cancel-edit")?.addEventListener("click", () => dialog.close());
    btnDelete.addEventListener("click", async () => {
      const id = (form.elements.namedItem("id") as HTMLInputElement).value;
      if (!confirm("¿Eliminar este molde?")) return;
      try {
        await deleteClinicTemplate(session.clinicId, id);
        dialog.close();
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo eliminar");
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const type = String(fd.get("documentType")) as DocumentType;
      const payload: DocumentTemplate = {
        id: String(fd.get("id")),
        name: String(fd.get("name")).trim(),
        documentType: type,
        sections: draftSections.length ? draftSections : defaultSectionsFor(type),
        isDefault: (form.elements.namedItem("isDefault") as HTMLInputElement).checked,
        enabledPhysicalExamSystemIds: PhysicalExamDefaults.map((s) => s.id),
        sectionDefaultTexts: Object.keys(draftSectionTexts).length ? draftSectionTexts : undefined,
      };
      try {
        if (payload.isDefault) {
          for (const t of templates.filter((x) => x.documentType === type && x.id !== payload.id)) {
            await upsertClinicTemplate(session.clinicId, { ...t, isDefault: false });
          }
        }
        await upsertClinicTemplate(session.clinicId, payload);
        dialog.close();
        await refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });

    void refresh();
    bindNavButtons(el);
    return el;
  },
});
