import { registerRoute, navigate } from "../../app/router";
import {
  deleteHeader,
  loadHeaders,
  loadTemplates,
  upsertHeader,
  upsertTemplate,
} from "../../services/clinical-store";
import type { DocumentHeader, DocumentTemplate, DocumentType } from "../../shared/models";
import { DocumentTypeLabels } from "../../shared/models";
import { catalogFor } from "../../shared/section-catalog";
import { loadPhysicalExamCatalog } from "../../services/ai/physical-exam-prompt";
import { bindNavButtons, page } from "../helpers";
import { getProfessionalSession } from "../../registro/session";
import { loadDoctorProfile } from "../../services/doctor-local";

registerRoute({
  path: "/plantillas/encabezados",
  title: "Encabezados",
  medicoOnly: true,
  render: () => {
    let headers = loadHeaders();
    const el = page(
      "Encabezados",
      `
      <p class="lead">Hasta 4 encabezados para tus PDF (clínica o médico).</p>
      <ul class="list" id="headers-list"></ul>
      <button type="button" class="btn btn-secondary" id="btn-add" ${headers.length >= 4 ? "disabled" : ""}>+ Nuevo encabezado</button>
      <dialog id="edit-dialog">
        <form method="dialog" class="form" id="edit-form">
          <h2 id="dialog-title">Editar encabezado</h2>
          <input type="hidden" name="id" />
          <label>Nombre<input name="name" required /></label>
          <label>Médico / clínica<input name="doctorName" /></label>
          <label>Subtítulo<input name="subtitle" placeholder="Ej. Medicina interna" /></label>
          <label>Descripción<textarea name="description" rows="3" placeholder="Dirección, teléfono…"></textarea></label>
          <label class="check-row"><input type="checkbox" name="isDefault" /> Predeterminado</label>
          <div class="dialog-actions">
            <button type="button" class="btn btn-ghost" id="cancel-edit">Cancelar</button>
            <button type="button" class="btn btn-ghost" id="btn-delete" hidden>Eliminar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </dialog>
      `,
    );

    const list = el.querySelector("#headers-list") as HTMLElement;
    const dialog = el.querySelector("#edit-dialog") as HTMLDialogElement;
    const form = el.querySelector("#edit-form") as HTMLFormElement;
    const btnDelete = el.querySelector("#btn-delete") as HTMLButtonElement;

    function refresh(): void {
      headers = loadHeaders();
      list.innerHTML = headers
        .map(
          (h) => `
        <li class="list-item list-item-action" data-id="${h.id}">
          <div>
            <strong>${h.name}</strong>
            <p class="muted">${h.doctorName || "Sin nombre"} · ${h.subtitle || "—"}</p>
            ${h.isDefault ? `<span class="status-badge status-ok">Predeterminado</span>` : ""}
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-edit="${h.id}">Editar</button>
        </li>`,
        )
        .join("");
      list.querySelectorAll("[data-edit], .list-item-action").forEach((node) => {
        node.addEventListener("click", (e) => {
          e.stopPropagation();
          const id =
            (node as HTMLElement).getAttribute("data-edit") ||
            (node as HTMLElement).getAttribute("data-id");
          const h = headers.find((x) => x.id === id);
          if (h) openEdit(h);
        });
      });
      (el.querySelector("#btn-add") as HTMLButtonElement).disabled = headers.length >= 4;
    }

    function openEdit(h: DocumentHeader, isNew = false): void {
      (form.elements.namedItem("id") as HTMLInputElement).value = h.id;
      (form.elements.namedItem("name") as HTMLInputElement).value = h.name;
      (form.elements.namedItem("doctorName") as HTMLInputElement).value = h.doctorName ?? "";
      (form.elements.namedItem("subtitle") as HTMLInputElement).value = h.subtitle ?? "";
      (form.elements.namedItem("description") as HTMLTextAreaElement).value = h.description ?? "";
      (form.elements.namedItem("isDefault") as HTMLInputElement).checked = h.isDefault;
      btnDelete.hidden = isNew || headers.length <= 1;
      dialog.showModal();
    }

    el.querySelector("#btn-add")?.addEventListener("click", () => {
      const session = getProfessionalSession();
      const doc = loadDoctorProfile();
      openEdit(
        {
          id: crypto.randomUUID(),
          name: "Nuevo encabezado",
          doctorName: doc?.nombre || session?.nombre || "",
          subtitle: doc?.especialidad || session?.especialidad || "",
          description: "",
          isDefault: headers.length === 0,
        },
        true,
      );
    });

    el.querySelector("#cancel-edit")?.addEventListener("click", () => dialog.close());
    btnDelete.addEventListener("click", () => {
      const id = (form.elements.namedItem("id") as HTMLInputElement).value;
      if (confirm("¿Eliminar este encabezado?")) {
        deleteHeader(id);
        dialog.close();
        refresh();
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      upsertHeader({
        id: String(fd.get("id")),
        name: String(fd.get("name")).trim(),
        doctorName: String(fd.get("doctorName")).trim(),
        subtitle: String(fd.get("subtitle")).trim(),
        description: String(fd.get("description")).trim(),
        isDefault: (form.elements.namedItem("isDefault") as HTMLInputElement).checked,
      });
      dialog.close();
      refresh();
    });

    refresh();
    return el;
  },
});

registerRoute({
  path: "/plantillas/documentos",
  title: "Plantillas de documentos",
  medicoOnly: true,
  render: () => {
    const templates = loadTemplates();
    const el = page(
      "Informes y historias",
      `
      <p class="lead">Una plantilla por tipo. Toca para editar secciones.</p>
      <ul class="list">${templates
        .map(
          (t) => `
        <li class="list-item list-item-action" data-nav="/plantillas/documentos/${t.documentType}">
          <strong>${t.name}</strong>
          <span class="muted">${DocumentTypeLabels[t.documentType]} · ${t.sections.length} secciones</span>
        </li>`,
        )
        .join("")}</ul>
      `,
    );
    bindNavButtons(el);
    return el;
  },
});

registerRoute({
  path: "/plantillas/documentos/:tipo",
  title: "Editar plantilla",
  medicoOnly: true,
  render: () => {
    const tipo = (window.location.hash.replace(/^#\/plantillas\/documentos\//, "").split("?")[0] ||
      "informe") as DocumentType;
    if (!["historiaClinica", "informe", "reposo"].includes(tipo)) {
      navigate("/plantillas/documentos");
      return page("Plantilla", `<p>Tipo inválido</p>`);
    }

    let template: DocumentTemplate = loadTemplates().find((t) => t.documentType === tipo)!;
    const catalog = catalogFor(tipo);
    const examSystems = loadPhysicalExamCatalog().sort((a, b) => a.sortOrder - b.sortOrder);
    const needsExam = tipo === "historiaClinica" || tipo === "informe";
    const enabledExam = new Set(
      template.enabledPhysicalExamSystemIds?.length
        ? template.enabledPhysicalExamSystemIds
        : examSystems.map((s) => s.id),
    );
    const el = page(
      `Plantilla ${DocumentTypeLabels[tipo]}`,
      `
      <form class="form" id="tpl-form">
        <label>Nombre<input name="name" required value="${template.name}" /></label>
        <fieldset class="card-panel">
          <legend><strong>Secciones activas</strong></legend>
          <p class="muted">Marca las secciones que usarás al redactar.</p>
          <div class="stack" id="sections-box">
            ${catalog
              .map((sec) => {
                const checked = template.sections.includes(sec) ? "checked" : "";
                const locked = sec === "Datos del paciente" ? "disabled" : "";
                return `<label class="check-row"><input type="checkbox" name="section" value="${sec}" ${checked} ${locked} /> ${sec}</label>`;
              })
              .join("")}
          </div>
        </fieldset>
        ${
          needsExam
            ? `
        <fieldset class="card-panel">
          <legend><strong>Examen físico</strong></legend>
          <p class="muted">Sistemas que la IA incluirá por defecto.</p>
          <div class="stack">
            ${examSystems
              .map(
                (s) =>
                  `<label class="check-row"><input type="checkbox" name="examId" value="${s.id}" ${enabledExam.has(s.id) ? "checked" : ""} /> ${s.name}</label>`,
              )
              .join("")}
          </div>
        </fieldset>`
            : ""
        }
        <button type="submit" class="btn btn-primary">Guardar plantilla</button>
        <button type="button" class="btn btn-ghost" data-nav="/plantillas/documentos">Volver</button>
      </form>
      `,
    );

    el.querySelector("#tpl-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const sections = Array.from(fd.getAll("section")).map(String);
      if (!sections.includes("Datos del paciente")) sections.unshift("Datos del paciente");
      const ordered = catalog.filter((s) => sections.includes(s));
      const examIds = Array.from(fd.getAll("examId")).map(String);
      if (needsExam && examIds.length === 0) {
        alert("Seleccione al menos un sistema de examen físico.");
        return;
      }
      template = upsertTemplate({
        ...template,
        name: String(fd.get("name")).trim() || template.name,
        sections: ordered,
        enabledPhysicalExamSystemIds: examIds,
        isDefault: true,
      });
      alert("Plantilla guardada");
      navigate("/plantillas/documentos");
    });

    bindNavButtons(el);
    return el;
  },
});
