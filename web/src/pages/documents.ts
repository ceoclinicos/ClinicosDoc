import { registerRoute, navigate } from "../app/router";
import { deleteDocument, getDocument, loadDocuments } from "../services/clinical-store";
import type { ClinicalDocument } from "../shared/models";
import { DocumentTypeLabels } from "../shared/models";
import { parseDocumentSections } from "../services/document-parser";
import { bindNavButtons, emptyState, page } from "./helpers";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderDocBody(doc: ClinicalDocument): string {
  const sections = parseDocumentSections(doc.content);
  if (sections.length === 0) return `<pre class="doc-pre">${escapeHtml(doc.content)}</pre>`;
  return sections
    .map((s) => {
      const title = s.title ? `<h3>${escapeHtml(s.title)}</h3>` : "";
      return `<article class="doc-section">${title}<pre class="doc-pre">${escapeHtml(s.body)}</pre></article>`;
    })
    .join("");
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
              <span class="muted">${d.patientNombre} · ${d.templateName ?? ""} · ${new Date(d.createdAt).toLocaleString("es")}</span>
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
    const doc = getDocument(id);
    if (!doc) {
      return page("Informe", emptyState("Documento no encontrado.", "Volver", "/informes"));
    }

    const el = page(
      DocumentTypeLabels[doc.type],
      `
      <p class="muted">${doc.patientNombre} · C.I. ${doc.patientCedula} · ${new Date(doc.createdAt).toLocaleString("es")}</p>
      <div class="doc-preview">${renderDocBody(doc)}</div>
      <div class="stack" style="margin-top:1rem">
        <button type="button" class="btn btn-primary" id="btn-copy">Copiar texto</button>
        <button type="button" class="btn btn-ghost" data-nav="/informes">Volver</button>
        <button type="button" class="btn btn-ghost" id="btn-delete">Eliminar</button>
      </div>
      `,
    );

    el.querySelector("#btn-copy")?.addEventListener("click", async () => {
      await navigator.clipboard.writeText(doc.content);
      alert("Copiado");
    });
    el.querySelector("#btn-delete")?.addEventListener("click", () => {
      if (!confirm("¿Eliminar este documento?")) return;
      deleteDocument(doc.id);
      navigate("/informes");
    });
    bindNavButtons(el);
    return el;
  },
});
