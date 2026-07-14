import { registerRoute, navigate } from "../app/router";
import { generateDocument } from "../services/ai/document-ai-service";
import { getAiProvider } from "../services/ai/ai-service";
import {
  defaultHeader,
  deleteDraft,
  getDraft,
  saveDocument,
  templateForType,
  upsertDraft,
} from "../services/clinical-store";
import { loadDoctorProfile, saveDoctorProfile, type DoctorProfileLocal } from "../services/doctor-local";
import { loadJson } from "../services/local-store";
import { parseDocumentSections } from "../services/document-parser";
import { isSpeechSupported, startDictation } from "../services/speech";
import { getProfessionalSession } from "../registro/session";
import type { ClinicalDraft, DocumentType, Patient } from "../shared/models";
import { DocumentTypeLabels } from "../shared/models";
import { bindNavButtons, page } from "./helpers";

function hashQuery(): URLSearchParams {
  const raw = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(raw);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

registerRoute({
  path: "/redactar",
  title: "Redactar",
  medicoOnly: true,
  render: () => {
    const el = page("Redactar", `<div id="redactar-root"></div>`);
    mountRedactar(el.querySelector("#redactar-root") as HTMLElement);
    bindNavButtons(el);
    return el;
  },
});

function mountRedactar(root: HTMLElement): void {
  const q = hashQuery();
  const draftId = q.get("draft");
  const tipoQ = q.get("tipo") as DocumentType | null;
  const existingDraft = draftId ? getDraft(draftId) : undefined;

  let step: "setup" | "dictado" | "resultado" = existingDraft?.generatedContent ? "resultado" : "setup";
  let dictation = existingDraft?.dictation ?? "";
  let generatedContent = existingDraft?.generatedContent ?? "";
  let processing = false;
  let listening = false;
  let stopSpeech: (() => void) | null = null;
  let currentDraftId = existingDraft?.id ?? crypto.randomUUID();

  const patients = loadJson<Patient[]>("patients", []);
  let selectedPatient: Patient | null =
    patients.find((p) => p.id === existingDraft?.patientId) ?? null;

  let docType: DocumentType =
    existingDraft?.documentType ??
    (tipoQ && ["historiaClinica", "informe", "reposo"].includes(tipoQ) ? tipoQ : "informe");

  const session = getProfessionalSession();
  let doctor = loadDoctorProfile() ?? {
    nombre: session?.nombre ?? "",
    cedula: session?.cedula ?? "",
    especialidad: session?.especialidad || "Médico general",
    mpps: session?.mpps ?? "",
  };

  if (existingDraft && !existingDraft.generatedContent) step = "dictado";

  function render(): void {
    if (step === "setup") renderSetup();
    else if (step === "dictado") renderDictado();
    else renderResultado();
  }

  function renderSetup(): void {
    const patientOptions = patients
      .map(
        (p) =>
          `<option value="${p.id}" ${selectedPatient?.id === p.id ? "selected" : ""}>${p.nombre} (${p.cedula})</option>`,
      )
      .join("");

    const typeBtns = (["historiaClinica", "informe", "reposo"] as DocumentType[])
      .map(
        (t) =>
          `<button type="button" class="tile ${docType === t ? "tile-selected" : ""}" data-pick-type="${t}">${DocumentTypeLabels[t]}</button>`,
      )
      .join("");

    root.innerHTML = `
      <p class="lead">¿Para qué paciente es este ${DocumentTypeLabels[docType].toLowerCase()}?</p>
      <div class="grid-2" style="margin-bottom:1rem">${typeBtns}</div>
      <form class="form" id="setup-form">
        <label>Paciente
          <select name="patientId" required ${patients.length ? "" : "disabled"}>
            <option value="">Selecciona…</option>
            ${patientOptions}
          </select>
        </label>
        ${patients.length === 0 ? `<p class="muted"><a href="#/pacientes/nuevo">Registrar paciente</a></p>` : ""}
        <fieldset class="card-panel">
          <legend><strong>Datos del médico</strong></legend>
          <label>Nombre<input name="docNombre" required value="${doctor?.nombre ?? ""}" /></label>
          <label>Cédula<input name="docCedula" value="${doctor?.cedula ?? ""}" /></label>
          <label>Especialidad<input name="docEsp" required value="${doctor?.especialidad ?? "Médico general"}" /></label>
          <label>MPPS<input name="docMpps" value="${doctor?.mpps ?? ""}" /></label>
        </fieldset>
        <p class="muted">Plantilla: ${templateForType(docType).name} · IA: ${getAiProvider()} · ${isSpeechSupported() ? "Dictado por voz disponible" : "Dictado solo texto"}</p>
        <button type="submit" class="btn btn-primary" ${patients.length ? "" : "disabled"}>Continuar al dictado</button>
        <button type="button" class="btn btn-ghost" data-nav="/">Cancelar</button>
      </form>
    `;

    root.querySelectorAll("[data-pick-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        docType = btn.getAttribute("data-pick-type") as DocumentType;
        renderSetup();
      });
    });

    root.querySelector("#setup-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const p = patients.find((x) => x.id === String(fd.get("patientId")));
      if (!p) return;
      selectedPatient = p;
      doctor = {
        nombre: String(fd.get("docNombre")),
        cedula: String(fd.get("docCedula")),
        especialidad: String(fd.get("docEsp")),
        mpps: String(fd.get("docMpps")),
      };
      saveDoctorProfile(doctor as DoctorProfileLocal);
      step = "dictado";
      render();
    });

    bindNavButtons(root);
  }

  function renderDictado(): void {
    root.innerHTML = `
      <p class="muted"><strong>${selectedPatient?.nombre}</strong> · ${DocumentTypeLabels[docType]}</p>
      <div class="dictado-toolbar">
        <button type="button" class="mic-btn ${listening ? "mic-active" : ""}" id="mic-btn">
          ${listening ? "⏹ Detener" : "🎤 Dictar"}
        </button>
        <span class="muted">${listening ? "Escuchando…" : "Toque para hablar o escriba"}</span>
      </div>
      <label class="search-label">Dictado clínico
        <textarea id="dictation" rows="10" placeholder="Hable o escriba el caso clínico…">${escapeHtml(dictation)}</textarea>
      </label>
      <p class="muted" id="error-msg"></p>
      <div class="stack">
        <button type="button" class="btn btn-primary" id="btn-process" ${processing ? "disabled" : ""}>
          ${processing ? "Procesando con IA…" : "Procesar con IA"}
        </button>
        <button type="button" class="btn btn-secondary" id="btn-draft">Guardar borrador</button>
        <button type="button" class="btn btn-ghost" id="btn-back">Volver</button>
      </div>
    `;

    const ta = root.querySelector("#dictation") as HTMLTextAreaElement;
    ta.addEventListener("input", () => {
      dictation = ta.value;
    });

    root.querySelector("#mic-btn")?.addEventListener("click", () => {
      const errEl = root.querySelector("#error-msg") as HTMLElement;
      if (listening) {
        stopSpeech?.();
        stopSpeech = null;
        listening = false;
        renderDictado();
        return;
      }
      if (!isSpeechSupported()) {
        errEl.textContent = "Use Chrome o Edge para dictado por voz.";
        return;
      }
      listening = true;
      renderDictado();
      const ta2 = root.querySelector("#dictation") as HTMLTextAreaElement;
      stopSpeech = startDictation(
        ta2?.value ?? dictation,
        (text) => {
          dictation = text;
          const t = root.querySelector("#dictation") as HTMLTextAreaElement;
          if (t) t.value = text;
        },
        (msg) => {
          errEl.textContent = msg;
          listening = false;
          stopSpeech = null;
        },
      );
    });

    root.querySelector("#btn-back")?.addEventListener("click", () => {
      stopSpeech?.();
      listening = false;
      step = "setup";
      render();
    });

    root.querySelector("#btn-draft")?.addEventListener("click", () => {
      dictation = (root.querySelector("#dictation") as HTMLTextAreaElement).value;
      persistDraft();
      alert("Borrador guardado");
    });

    root.querySelector("#btn-process")?.addEventListener("click", async () => {
      dictation = (root.querySelector("#dictation") as HTMLTextAreaElement).value.trim();
      const errEl = root.querySelector("#error-msg") as HTMLElement;
      if (!dictation) {
        errEl.textContent = "Dicta o escribe el contenido antes de procesar.";
        return;
      }
      if (!selectedPatient || !doctor) return;

      processing = true;
      errEl.textContent = "";
      stopSpeech?.();
      listening = false;
      renderDictado();

      try {
        const template = templateForType(docType);
        generatedContent = await generateDocument({
          template,
          patient: selectedPatient,
          doctor,
          dictation,
        });
        persistDraft();
        step = "resultado";
        processing = false;
        render();
      } catch (err) {
        errEl.textContent = err instanceof Error ? err.message : "Error al procesar";
        processing = false;
        renderDictado();
      }
    });
  }

  function renderResultado(): void {
    const sections = parseDocumentSections(generatedContent);
    const body = sections
      .map((s) => {
        const title = s.title ? `<h3>${escapeHtml(s.title)}</h3>` : "";
        return `<article class="doc-section">${title}<pre class="doc-pre">${escapeHtml(s.body)}</pre></article>`;
      })
      .join("");

    root.innerHTML = `
      <p class="status-badge status-ok">Documento generado · ${DocumentTypeLabels[docType]}</p>
      <p class="muted">${selectedPatient?.nombre} · ${selectedPatient?.cedula}</p>
      <label class="search-label">Contenido (editable)
        <textarea id="content-edit" rows="14">${escapeHtml(generatedContent)}</textarea>
      </label>
      <div class="doc-preview" style="display:none">${body}</div>
      <div class="stack" style="margin-top:1rem">
        <button type="button" class="btn btn-primary" id="btn-save">Guardar documento</button>
        <button type="button" class="btn btn-secondary" id="btn-copy">Copiar texto</button>
        <button type="button" class="btn btn-ghost" id="btn-edit">Editar dictado y regenerar</button>
        <button type="button" class="btn btn-ghost" data-nav="/informes">Ver informes</button>
      </div>
    `;

    root.querySelector("#btn-copy")?.addEventListener("click", async () => {
      generatedContent = (root.querySelector("#content-edit") as HTMLTextAreaElement).value;
      await navigator.clipboard.writeText(generatedContent);
      alert("Copiado al portapapeles");
    });

    root.querySelector("#btn-edit")?.addEventListener("click", () => {
      generatedContent = (root.querySelector("#content-edit") as HTMLTextAreaElement).value;
      step = "dictado";
      render();
    });

    root.querySelector("#btn-save")?.addEventListener("click", () => {
      if (!selectedPatient) return;
      generatedContent = (root.querySelector("#content-edit") as HTMLTextAreaElement).value;
      const template = templateForType(docType);
      const header = defaultHeader();
      const doc = saveDocument({
        id: crypto.randomUUID(),
        patientId: selectedPatient.id,
        patientNombre: selectedPatient.nombre,
        patientCedula: selectedPatient.cedula,
        type: docType,
        content: generatedContent,
        rawDictation: dictation,
        createdAt: new Date().toISOString(),
        templateId: template.id,
        templateName: template.name,
        headerId: header?.id,
      });
      deleteDraft(currentDraftId);
      alert("Documento guardado");
      navigate(`/informes/${doc.id}`);
    });

    bindNavButtons(root);
  }

  function persistDraft(): void {
    if (!selectedPatient) return;
    const template = templateForType(docType);
    const draft: ClinicalDraft = {
      id: currentDraftId,
      patientId: selectedPatient.id,
      patientNombre: selectedPatient.nombre,
      patientCedula: selectedPatient.cedula,
      documentType: docType,
      dictation,
      templateId: template.id,
      templateName: template.name,
      headerId: defaultHeader()?.id,
      generatedContent: generatedContent || undefined,
      createdAt: existingDraft?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    upsertDraft(draft);
  }

  render();
}
