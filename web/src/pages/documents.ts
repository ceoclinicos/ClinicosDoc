import { registerRoute, navigate } from "../app/router";
import {
  defaultHeader,
  deleteDocument,
  getDocument,
  loadDocuments,
  loadHeaders,
  saveDocument,
} from "../services/clinical-store";
import type { ClinicalDocument, DocumentHeader } from "../shared/models";
import { DocumentReportTitles, DocumentTypeLabels } from "../shared/models";
import {
  buildFullDocumentHtml,
  printFromClinicalDocument,
} from "../services/document-pdf";
import { bindNavButtons, emptyState, page } from "./helpers";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

registerRoute({
  path: "/informes",
  title: "Informes",
  nav: true,
  navLabel: "Informe",
  medicoOnly: true,
  render: () => {
    const docs = loadDocuments();
    const body =
      docs.length === 0
        ? emptyState("Sin informes aún. Usa Redactar en Inicio.", "Redactar", "/")
        : `<ul class="list">${docs
            .map(
              (d) => `
            <li class="list-item list-item-action" data-nav="/informes/${d.id}">
              <strong>${DocumentTypeLabels[d.type]}</strong>
              <span class="muted">${escapeHtml(d.patientNombre)} · ${escapeHtml(d.templateName ?? "")} · ${new Date(d.createdAt).toLocaleString("es")}</span>
            </li>`,
            )
            .join("")}</ul>`;
    const el = page("Informes", body);
    bindNavButtons(el);
    return el;
  },
});

registerRoute({
  path: "/informes/:id",
  title: "Detalle informe",
  medicoOnly: true,
  render: () => {
    const id = window.location.hash.replace(/^#\/informes\//, "").split("?")[0];
    let doc = getDocument(id);
    if (!doc) {
      return page("Informe", emptyState("Documento no encontrado.", "Volver", "/informes"));
    }

    const headers = loadHeaders();
    let selectedHeader: DocumentHeader | undefined =
      (doc.headerId ? headers.find((h) => h.id === doc!.headerId) : undefined) ||
      doc.headerSnapshot ||
      defaultHeader();

    const el = page(
      DocumentReportTitles[doc.type],
      `
      <p class="muted">${escapeHtml(doc.patientNombre)} · C.I. ${escapeHtml(doc.patientCedula)} · ${new Date(doc.createdAt).toLocaleString("es")}</p>

      <label>Encabezado
        <select id="header-select">
          ${headers
            .map(
              (h) =>
                `<option value="${h.id}" ${selectedHeader?.id === h.id ? "selected" : ""}>${escapeHtml(h.name)}</option>`,
            )
            .join("")}
        </select>
      </label>

      <div class="card-panel doc-live-preview" id="live-preview"></div>

      <label class="search-label">Contenido (editable)
        <textarea id="content-edit" rows="12">${escapeHtml(doc.content)}</textarea>
      </label>

      <div class="stack" style="margin-top:1rem">
        <button type="button" class="btn btn-primary" id="btn-save">Guardar cambios</button>
        <button type="button" class="btn btn-secondary" id="btn-print">Imprimir / PDF</button>
        <button type="button" class="btn btn-secondary" id="btn-copy">Copiar texto</button>
        <button type="button" class="btn btn-ghost" data-nav="/informes">Volver</button>
        <button type="button" class="btn btn-ghost" id="btn-delete">Eliminar</button>
      </div>
      `,
    );

    const refreshPreview = () => {
      const content = (el.querySelector("#content-edit") as HTMLTextAreaElement).value;
      const box = el.querySelector("#live-preview") as HTMLElement;
      box.innerHTML = buildFullDocumentHtml({
        type: doc!.type,
        content,
        header: selectedHeader,
        membrete: doc!.membrete,
      });
    };

    refreshPreview();

    el.querySelector("#header-select")?.addEventListener("change", (e) => {
      const hid = (e.target as HTMLSelectElement).value;
      selectedHeader = headers.find((h) => h.id === hid) ?? defaultHeader();
      refreshPreview();
    });

    el.querySelector("#content-edit")?.addEventListener("input", () => refreshPreview());

    el.querySelector("#btn-save")?.addEventListener("click", () => {
      const content = (el.querySelector("#content-edit") as HTMLTextAreaElement).value;
      const updated: ClinicalDocument = {
        ...doc!,
        content,
        headerId: selectedHeader?.id,
        headerSnapshot: selectedHeader ? { ...selectedHeader } : doc!.headerSnapshot,
      };
      doc = saveDocument(updated);
      alert("Cambios guardados");
      refreshPreview();
    });

    el.querySelector("#btn-print")?.addEventListener("click", () => {
      const content = (el.querySelector("#content-edit") as HTMLTextAreaElement).value;
      printFromClinicalDocument({
        ...doc!,
        content,
        headerSnapshot: selectedHeader ?? doc!.headerSnapshot,
      });
    });

    el.querySelector("#btn-copy")?.addEventListener("click", async () => {
      const content = (el.querySelector("#content-edit") as HTMLTextAreaElement).value;
      await navigator.clipboard.writeText(content);
      alert("Copiado");
    });

    el.querySelector("#btn-delete")?.addEventListener("click", () => {
      if (!confirm("¿Eliminar este documento?")) return;
      deleteDocument(doc!.id);
      navigate("/informes");
    });

    bindNavButtons(el);
    return el;
  },
});
