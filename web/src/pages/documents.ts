import { registerRoute, navigate } from "../app/router";
import {
  defaultHeader,
  deleteDocument,
  getDocument,
  loadDocuments,
  loadHeaders,
  saveDocument,
  templateForType,
  loadTemplates,
} from "../services/clinical-store";
import type { ClinicalDocument, DocumentHeader } from "../shared/models";
import { DocumentReportTitles, DocumentTypeLabels } from "../shared/models";
import {
  buildFullDocumentHtml,
  printFromClinicalDocument,
} from "../services/document-pdf";
import { parseDocumentSections, serializeDocumentSections } from "../services/document-parser";
import {
  applyVitalsToBody,
  bodyWithoutVitals,
  isPhysicalExamTitle,
  parseVitalsFromBody,
  readVitalsFromForm,
  vitalSignsFieldsHtml,
} from "../services/vital-signs";
import { loadDoctorProfile } from "../services/doctor-local";
import { loadJson } from "../services/local-store";
import type { Patient } from "../shared/models";
import { bindSectionRegenerateButtons, sectionRegenerateButtonHtml } from "../ui/section-regenerate";
import { bindNavButtons, emptyState, page } from "./helpers";
import { setOrdenesFromCasePending } from "./generar-ordenes";

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

    let sections = parseDocumentSections(doc.content);
    const canRegenerate = Boolean(doc.rawDictation?.trim());
    const patient =
      loadJson<Patient[]>("patients", []).find((p) => p.id === doc!.patientId) ?? null;
    const template =
      (doc.templateId ? loadTemplates().find((t) => t.id === doc!.templateId) : null) ??
      templateForType(doc.type);
    const doctor = loadDoctorProfile();

    const sectionsHtml = sections
      .map((sec, i) => {
        const isExam = isPhysicalExamTitle(sec.title);
        const vitals = isExam ? parseVitalsFromBody(sec.body) : null;
        const bodyText = isExam ? bodyWithoutVitals(sec.body) : sec.body;
        return `
          <div class="card-panel section-edit" data-sec-idx="${i}">
            <div class="field">
              <span class="field-label">Título de sección</span>
              <input type="text" class="sec-title" value="${escapeHtml(sec.title)}" placeholder="(sin título)" />
            </div>
            ${vitals ? vitalSignsFieldsHtml(vitals, `vs${i}`) : ""}
            <div class="field">
              <span class="field-label">${isExam ? "Resto del examen físico" : "Contenido"}</span>
              <textarea class="sec-body" rows="${isExam ? 8 : 5}">${escapeHtml(bodyText)}</textarea>
            </div>
            ${canRegenerate ? sectionRegenerateButtonHtml(i) : ""}
          </div>`;
      })
      .join("");

    const el = page(
      DocumentReportTitles[doc.type],
      `
      <p class="muted">${escapeHtml(doc.patientNombre)} · C.I. ${escapeHtml(doc.patientCedula)} · ${new Date(doc.createdAt).toLocaleString("es")}</p>

      <div class="result-actions">
        <button type="button" class="btn btn-primary" id="btn-save">Guardar cambios</button>
        <button type="button" class="btn btn-secondary" id="btn-print">Imprimir / PDF</button>
        <button type="button" class="btn btn-ghost" id="btn-scroll-preview">Vista previa</button>
      </div>

      <div class="field">
        <span class="field-label">Encabezado</span>
        <select id="header-select">
          ${headers
            .map(
              (h) =>
                `<option value="${h.id}" ${selectedHeader?.id === h.id ? "selected" : ""}>${escapeHtml(h.name)}</option>`,
            )
            .join("")}
        </select>
      </div>

      <h2 class="home-section-title">Editar secciones</h2>
      <div id="sections-editor" class="stack">${sectionsHtml}</div>

      <h2 class="home-section-title" id="preview-heading">Vista previa (hoja)</h2>
      <div class="doc-paper-wrap">
        <div class="doc-paper doc-live-preview" id="live-preview"></div>
      </div>

      <div class="result-actions result-actions-bottom">
        <button type="button" class="btn btn-primary" id="btn-save-2">Guardar cambios</button>
        <button type="button" class="btn btn-secondary" id="btn-print-2">Imprimir / PDF</button>
        <button type="button" class="btn btn-secondary" id="btn-copy">Copiar texto</button>
        ${
          doc.type === "informe" || doc.type === "historiaClinica"
            ? `<button type="button" class="btn btn-secondary" id="btn-ordenes">Generar órdenes médicas</button>`
            : ""
        }
        <button type="button" class="btn btn-ghost" data-nav="/informes">Volver</button>
        <button type="button" class="btn btn-ghost" id="btn-delete">Eliminar</button>
      </div>
      `,
    );

    const collectContent = (): string => {
      const boxes = Array.from(el.querySelectorAll(".section-edit")) as HTMLElement[];
      sections = boxes.map((box, i) => {
        const title = (box.querySelector(".sec-title") as HTMLInputElement).value.trim();
        let body = (box.querySelector(".sec-body") as HTMLTextAreaElement).value;
        if (isPhysicalExamTitle(title) || box.querySelector(".vitals-editor")) {
          body = applyVitalsToBody(body, readVitalsFromForm(box, `vs${i}`));
        }
        return { id: sections[i]?.id ?? crypto.randomUUID(), title, body };
      });
      return serializeDocumentSections(sections);
    };

    const refreshPreview = () => {
      const content = collectContent();
      const box = el.querySelector("#live-preview") as HTMLElement;
      box.innerHTML = buildFullDocumentHtml({
        type: doc!.type,
        content,
        header: selectedHeader,
        membrete: doc!.membrete,
      });
      return content;
    };

    refreshPreview();

    el.querySelector("#header-select")?.addEventListener("change", (e) => {
      const hid = (e.target as HTMLSelectElement).value;
      selectedHeader = headers.find((h) => h.id === hid) ?? defaultHeader();
      refreshPreview();
    });

    el.querySelector("#sections-editor")?.addEventListener("input", () => refreshPreview());

    if (canRegenerate && patient && doctor) {
      bindSectionRegenerateButtons(el, {
        rawDictation: doc.rawDictation ?? "",
        template,
        patient,
        doctor,
        getSections: () => {
          const boxes = Array.from(el.querySelectorAll(".section-edit")) as HTMLElement[];
          return boxes.map((box, i) => {
            const title = (box.querySelector(".sec-title") as HTMLInputElement).value.trim();
            let body = (box.querySelector(".sec-body") as HTMLTextAreaElement).value;
            if (isPhysicalExamTitle(title) || box.querySelector(".vitals-editor")) {
              body = applyVitalsToBody(body, readVitalsFromForm(box, `vs${i}`));
            }
            return { id: sections[i]?.id ?? crypto.randomUUID(), title, body };
          });
        },
        applySectionBody: (index, body) => {
          const box = el.querySelector(`.section-edit[data-sec-idx="${index}"]`);
          const ta = box?.querySelector(".sec-body") as HTMLTextAreaElement | null;
          if (ta) ta.value = body;
        },
        onAfterRegenerate: () => refreshPreview(),
      });
    }

    el.querySelector("#btn-scroll-preview")?.addEventListener("click", () => {
      el.querySelector("#preview-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const doSave = () => {
      const content = refreshPreview();
      const updated: ClinicalDocument = {
        ...doc!,
        content,
        headerId: selectedHeader?.id,
        headerSnapshot: selectedHeader ? { ...selectedHeader } : doc!.headerSnapshot,
      };
      doc = saveDocument(updated);
      alert("Cambios guardados");
    };

    const doPrint = () => {
      const content = refreshPreview();
      printFromClinicalDocument({
        ...doc!,
        content,
        headerSnapshot: selectedHeader ?? doc!.headerSnapshot,
      });
    };

    el.querySelector("#btn-save")?.addEventListener("click", doSave);
    el.querySelector("#btn-save-2")?.addEventListener("click", doSave);
    el.querySelector("#btn-print")?.addEventListener("click", doPrint);
    el.querySelector("#btn-print-2")?.addEventListener("click", doPrint);

    el.querySelector("#btn-copy")?.addEventListener("click", async () => {
      const content = refreshPreview();
      await navigator.clipboard.writeText(content);
      alert("Copiado");
    });

    el.querySelector("#btn-delete")?.addEventListener("click", () => {
      if (!confirm("¿Eliminar este documento?")) return;
      deleteDocument(doc!.id);
      navigate("/informes");
    });

    el.querySelector("#btn-ordenes")?.addEventListener("click", () => {
      const content = refreshPreview();
      setOrdenesFromCasePending({
        patientId: doc!.patientId,
        caseContent: content,
        sourceDocumentId: doc!.id,
        headerId: selectedHeader?.id ?? doc!.headerId,
        sourceTypeLabel: DocumentTypeLabels[doc!.type],
      });
      navigate("/ordenes/desde-caso");
    });

    bindNavButtons(el);
    return el;
  },
});
