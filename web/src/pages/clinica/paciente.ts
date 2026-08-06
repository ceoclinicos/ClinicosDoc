import { registerRoute } from "../../app/router";
import { getClinicSession } from "../../clinic/session";
import { listClinicDocumentsForPatient } from "../../clinic/store";
import { DocumentTypeLabels, type ClinicalDocument } from "../../shared/models";
import {
  buildFullDocumentHtml,
  downloadClinicalPdf,
  printClinicalDocument,
} from "../../services/document-pdf";
import { bindNavButtons, page } from "../helpers";

registerRoute({
  path: "/clinica/paciente/:cedula",
  title: "Paciente",
  clinicOnly: true,
  render: () => {
    const session = getClinicSession();
    const raw = (window.location.hash.replace(/^#/, "").split("?")[0] || "").split("/");
    const cedula = decodeURIComponent(raw[raw.length - 1] || "");

    const el = page(
      "Historial del paciente",
      `
      <p class="muted"><a href="#/clinica/panel">← Pacientes</a></p>
      <p class="lead">C.I. ${escapeHtml(cedula)} · solo informes de <strong>${escapeHtml(session?.nombre ?? "este centro")}</strong></p>
      <div id="status" class="muted">Cargando…</div>
      <ul class="list" id="docs-list"></ul>
      <dialog id="doc-dialog" class="clinic-doc-dialog">
        <form method="dialog" class="form" style="max-width:min(96vw,48rem)">
          <h2 id="doc-title">Informe</h2>
          <div class="result-actions" style="margin-bottom:0.75rem">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-print">Imprimir</button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-pdf">PDF</button>
          </div>
          <div class="doc-paper-wrap" style="max-height:65vh;overflow:auto">
            <div class="doc-paper" id="doc-preview"></div>
          </div>
          <button type="submit" class="btn btn-primary" style="margin-top:0.75rem">Cerrar</button>
        </form>
      </dialog>
      `,
    );

    const status = el.querySelector("#status") as HTMLElement;
    const list = el.querySelector("#docs-list") as HTMLElement;
    const dialog = el.querySelector("#doc-dialog") as HTMLDialogElement;
    const preview = el.querySelector("#doc-preview") as HTMLElement;
    let currentDoc: ClinicalDocument | null = null;

    function showDoc(doc: ClinicalDocument): void {
      currentDoc = doc;
      (el.querySelector("#doc-title") as HTMLElement).textContent =
        DocumentTypeLabels[doc.type] ?? "Documento";
      preview.innerHTML = buildFullDocumentHtml({
        type: doc.type,
        content: doc.content || "",
        header: doc.headerSnapshot,
        membrete: doc.membrete,
        patientCedula: doc.patientCedula,
      });
      dialog.showModal();
    }

    el.querySelector("#btn-print")?.addEventListener("click", () => {
      if (!currentDoc) return;
      printClinicalDocument({
        type: currentDoc.type,
        content: currentDoc.content,
        header: currentDoc.headerSnapshot,
        membrete: currentDoc.membrete,
        patientCedula: currentDoc.patientCedula,
      });
    });

    el.querySelector("#btn-pdf")?.addEventListener("click", async () => {
      if (!currentDoc) return;
      try {
        await downloadClinicalPdf({
          type: currentDoc.type,
          content: currentDoc.content,
          header: currentDoc.headerSnapshot,
          membrete: currentDoc.membrete,
          patientNombre: currentDoc.patientNombre,
          patientCedula: currentDoc.patientCedula,
        });
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo generar el PDF");
      }
    });

    void (async () => {
      try {
        const docs = await listClinicDocumentsForPatient(session!.clinicId, cedula);
        if (!docs.length) {
          status.textContent = "Sin informes en este centro para este paciente.";
          return;
        }
        status.textContent = `${docs.length} documento(s)`;
        const nombre = docs[0]?.patientNombre ?? "Paciente";
        const h1 = el.querySelector(".page-header h1");
        if (h1) h1.textContent = nombre;

        list.innerHTML = docs
          .map(
            (d) => `
          <li class="list-item list-item-action" data-id="${d.id}">
            <div>
              <strong>${DocumentTypeLabels[d.type] ?? d.type}</strong>
              <p class="muted">${new Date(d.createdAt).toLocaleString("es")}${d.doctorNombre ? ` · ${escapeHtml(d.doctorNombre)}` : ""}</p>
              <p class="muted">${escapeHtml(d.templateName || "Sin plantilla")}</p>
            </div>
            <span class="muted">Ver →</span>
          </li>`,
          )
          .join("");

        list.querySelectorAll("[data-id]").forEach((node) => {
          node.addEventListener("click", () => {
            const id = node.getAttribute("data-id");
            const doc = docs.find((x) => x.id === id);
            if (doc) showDoc(doc);
          });
        });
      } catch (err) {
        status.textContent = err instanceof Error ? err.message : "Error al cargar";
      }
    })();

    bindNavButtons(el);
    return el;
  },
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
