import { registerRoute, navigate } from "../app/router";
import { generateOrdenesFromCase } from "../services/ai/document-ai-service";
import {
  defaultHeader,
  loadHeaders,
  saveDocument,
  templateForType,
} from "../services/clinical-store";
import { loadDoctorProfile } from "../services/doctor-local";
import {
  buildFullDocumentHtml,
  buildMembreteFromPatient,
  printClinicalDocument,
} from "../services/document-pdf";
import { parseDocumentSections, serializeDocumentSections } from "../services/document-parser";
import { loadJson } from "../services/local-store";
import { getProfessionalSession } from "../registro/session";
import type { DocumentHeader, Patient } from "../shared/models";
import {
  ORDENES_MODO_LABELS,
  type OrdenesModo,
} from "../shared/ordenes-medicas";
import { bindNavButtons, page } from "./helpers";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Pending = {
  patientId: string;
  caseContent: string;
  sourceDocumentId?: string;
  headerId?: string;
  sourceTypeLabel?: string;
};

const PENDING_KEY = "ordenes_from_case_pending";

export function setOrdenesFromCasePending(p: Pending): void {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
}

function takePending(): Pending | null {
  const raw = sessionStorage.getItem(PENDING_KEY);
  sessionStorage.removeItem(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Pending;
  } catch {
    return null;
  }
}

registerRoute({
  path: "/ordenes/desde-caso",
  title: "Generar órdenes",
  medicoOnly: true,
  render: () => {
    const pending = takePending();
    if (!pending) {
      navigate("/informes");
      return page("Órdenes", `<p class="muted">No hay caso cargado.</p>`);
    }

    const patients = loadJson<Patient[]>("patients", []);
    const patient = patients.find((p) => p.id === pending.patientId);
    if (!patient) {
      navigate("/informes");
      return page("Órdenes", `<p class="muted">Paciente no encontrado.</p>`);
    }

    const session = getProfessionalSession();
    const docProfile = loadDoctorProfile();
    const doctor = {
      nombre: docProfile?.nombre || session?.nombre || "Médico",
      especialidad: docProfile?.especialidad || session?.especialidad || "",
    };
    const headers = loadHeaders();
    const selectedHeader: DocumentHeader | undefined =
      (pending.headerId && headers.find((h) => h.id === pending.headerId)) || defaultHeader();
    const template = templateForType("ordenesMedicas");

    let caseText = pending.caseContent;
    let notes = "";
    let modo: OrdenesModo = "ordenes";
    let generated = "";
    let processing = false;

    const root = page("Generar órdenes", `<div id="ordenes-flow"></div>`);
    const box = root.querySelector("#ordenes-flow") as HTMLElement;

    const render = () => {
      if (!generated) {
        box.innerHTML = `
          <p class="muted"><strong>${escapeHtml(patient.nombre)}</strong> · C.I. ${escapeHtml(patient.cedula)}</p>
          ${pending.sourceTypeLabel ? `<p class="muted">Desde: ${escapeHtml(pending.sourceTypeLabel)}</p>` : ""}
          <label class="field">Caso clínico (editable)
            <textarea id="case-text" rows="12">${escapeHtml(caseText)}</textarea>
          </label>
          <fieldset class="card-panel">
            <legend><strong>Tipo de hoja</strong></legend>
            ${(Object.keys(ORDENES_MODO_LABELS) as OrdenesModo[])
              .map(
                (k) => `
              <label class="check-row">
                <input type="radio" name="modo" value="${k}" ${modo === k ? "checked" : ""} />
                ${ORDENES_MODO_LABELS[k]}
              </label>`,
              )
              .join("")}
          </fieldset>
          <label class="field">Notas / dictado adicional (opcional)
            <textarea id="notes" rows="4" placeholder="Ej. agregar ceftriaxona, oxígeno 2 L…">${escapeHtml(notes)}</textarea>
          </label>
          <p class="muted" id="err"></p>
          <button type="button" class="btn btn-primary" id="btn-gen" ${processing ? "disabled" : ""}>
            ${processing ? "Generando…" : "Generar órdenes"}
          </button>
          <button type="button" class="btn btn-ghost" data-nav="/informes">Cancelar</button>
        `;

        box.querySelectorAll('input[name="modo"]').forEach((n) => {
          n.addEventListener("change", () => {
            modo = (n as HTMLInputElement).value as OrdenesModo;
          });
        });

        box.querySelector("#btn-gen")?.addEventListener("click", async () => {
          caseText = (box.querySelector("#case-text") as HTMLTextAreaElement).value;
          notes = (box.querySelector("#notes") as HTMLTextAreaElement).value;
          const err = box.querySelector("#err") as HTMLElement;
          if (!caseText.trim()) {
            err.textContent = "El caso clínico está vacío";
            return;
          }
          processing = true;
          render();
          try {
            generated = await generateOrdenesFromCase({
              patient,
              doctor,
              caseContent: caseText.trim(),
              notes: notes.trim(),
              modo,
            });
          } catch (e) {
            processing = false;
            render();
            const errEl = box.querySelector("#err") as HTMLElement | null;
            if (errEl) errEl.textContent = e instanceof Error ? e.message : "Error al generar";
            return;
          }
          processing = false;
          render();
        });
      } else {
        let sections = parseDocumentSections(generated);
        const sectionsHtml = sections
          .map(
            (sec, i) => `
          <div class="card-panel section-edit" data-sec-idx="${i}">
            <div class="field">
              <span class="field-label">Título</span>
              <input type="text" class="sec-title" value="${escapeHtml(sec.title)}" />
            </div>
            <div class="field">
              <span class="field-label">Contenido</span>
              <textarea class="sec-body" rows="10">${escapeHtml(sec.body)}</textarea>
            </div>
          </div>`,
          )
          .join("");

        box.innerHTML = `
          <p class="status-badge status-ok">${ORDENES_MODO_LABELS[modo]}</p>
          <p class="muted">${escapeHtml(patient.nombre)} · ${escapeHtml(patient.cedula)}</p>
          <div class="result-actions">
            <button type="button" class="btn btn-primary" id="btn-save">Guardar</button>
            <button type="button" class="btn btn-secondary" id="btn-print">Imprimir / PDF</button>
          </div>
          <div id="sections-editor" class="stack">${sectionsHtml}</div>
          <h2 class="home-section-title">Vista previa</h2>
          <div class="doc-paper-wrap">
            <div class="doc-paper doc-live-preview" id="live-preview"></div>
          </div>
          <div class="result-actions result-actions-bottom">
            <button type="button" class="btn btn-primary" id="btn-save-2">Guardar documento</button>
            <button type="button" class="btn btn-ghost" data-nav="/informes">Ver informes</button>
          </div>
        `;

        const collect = (): string => {
          const els = Array.from(box.querySelectorAll(".section-edit")) as HTMLElement[];
          sections = els.map((el, i) => ({
            id: sections[i]?.id ?? crypto.randomUUID(),
            title: (el.querySelector(".sec-title") as HTMLInputElement).value.trim(),
            body: (el.querySelector(".sec-body") as HTMLTextAreaElement).value,
          }));
          generated = serializeDocumentSections(sections);
          return generated;
        };

        const refreshPreview = () => {
          collect();
          const preview = box.querySelector("#live-preview") as HTMLElement;
          preview.innerHTML = buildFullDocumentHtml({
            type: "ordenesMedicas",
            content: generated,
            header: selectedHeader,
            membrete: buildMembreteFromPatient(patient),
          });
        };
        refreshPreview();
        box.querySelector("#sections-editor")?.addEventListener("input", () => refreshPreview());

        const doSave = () => {
          collect();
          const id = crypto.randomUUID();
          saveDocument({
            id,
            patientId: patient.id,
            patientNombre: patient.nombre,
            patientCedula: patient.cedula,
            type: "ordenesMedicas",
            content: generated,
            rawDictation: notes.trim() || caseText.slice(0, 500),
            createdAt: new Date().toISOString(),
            templateId: template.id,
            templateName: template.name,
            headerId: selectedHeader?.id,
            headerSnapshot: selectedHeader,
            membrete: buildMembreteFromPatient(patient),
            sourceDocumentId: pending.sourceDocumentId,
          });
          alert("Órdenes guardadas");
          navigate(`/informes/${id}`);
        };

        box.querySelector("#btn-save")?.addEventListener("click", doSave);
        box.querySelector("#btn-save-2")?.addEventListener("click", doSave);
        box.querySelector("#btn-print")?.addEventListener("click", () => {
          collect();
          printClinicalDocument({
            type: "ordenesMedicas",
            content: generated,
            header: selectedHeader,
            membrete: buildMembreteFromPatient(patient),
            patientNombre: patient.nombre,
          });
        });
      }
      bindNavButtons(box);
    };

    render();
    return root;
  },
});
