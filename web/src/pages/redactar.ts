import { registerRoute } from "../app/router";
import { defaultTemplateFor, generateDocument } from "../services/ai/document-ai-service";
import { getAiProvider } from "../services/ai/ai-service";
import { loadDoctorProfile, saveDoctorProfile, type DoctorProfileLocal } from "../services/doctor-local";
import { loadJson, saveJson } from "../services/local-store";
import { parseDocumentSections } from "../services/document-parser";
import { isSpeechSupported, startDictation } from "../services/speech";
import type { ClinicalDraft, DocumentType, Patient } from "../shared/models";
import { bindNavButtons, page } from "./helpers";

registerRoute({
  path: "/redactar",
  title: "Redactar",
  nav: true,
  navLabel: "Redactar",
  medicoOnly: true,
  render: () => {
    const el = page("Redactar informe", `<div id="redactar-root"></div>`);
    mountRedactar(el.querySelector("#redactar-root") as HTMLElement);
    bindNavButtons(el);
    return el;
  },
});

function mountRedactar(root: HTMLElement): void {
  let step: "setup" | "dictado" | "resultado" = "setup";
  let dictation = "";
  let generatedContent = "";
  let processing = false;
  let listening = false;
  let stopSpeech: (() => void) | null = null;
  let selectedPatient: Patient | null = null;
  let docType: DocumentType = "informe";
  let doctor = loadDoctorProfile();

  const patients = loadJson<Patient[]>("patients", []);

  function render(): void {
    if (step === "setup") renderSetup();
    else if (step === "dictado") renderDictado();
    else renderResultado();
  }

  function renderSetup(): void {
    const patientOptions = patients
      .map((p) => `<option value="${p.id}" ${selectedPatient?.id === p.id ? "selected" : ""}>${p.nombre} (${p.cedula})</option>`)
      .join("");

    root.innerHTML = `
      <p class="lead">Seleccione paciente, datos del médico y tipo de documento.</p>
      <form class="form" id="setup-form">
        <label>Paciente
          <select name="patientId" required ${patients.length ? "" : "disabled"}>
            <option value="">Selecciona…</option>
            ${patientOptions}
          </select>
        </label>
        ${patients.length === 0 ? `<p class="muted"><a href="#/pacientes/nuevo">Registrar paciente</a> o use <a href="#/profesional">buscar por cédula</a>.</p>` : ""}
        <label>Tipo de documento
          <select name="docType">
            <option value="informe" ${docType === "informe" ? "selected" : ""}>Informe médico</option>
            <option value="historiaClinica" ${docType === "historiaClinica" ? "selected" : ""}>Historia clínica</option>
            <option value="reposo" ${docType === "reposo" ? "selected" : ""}>Reposo</option>
          </select>
        </label>
        <fieldset class="card-panel">
          <legend><strong>Datos del médico</strong></legend>
          <label>Nombre<input name="docNombre" required value="${doctor?.nombre ?? ""}" /></label>
          <label>Cédula<input name="docCedula" value="${doctor?.cedula ?? ""}" /></label>
          <label>Especialidad<input name="docEsp" required value="${doctor?.especialidad ?? "Médico general"}" /></label>
          <label>MPPS<input name="docMpps" value="${doctor?.mpps ?? ""}" /></label>
        </fieldset>
        <p class="muted">IA: ${getAiProvider()} · ${isSpeechSupported() ? "Dictado por voz disponible" : "Dictado solo texto (use Chrome)"}</p>
        <button type="submit" class="btn btn-primary" ${patients.length ? "" : "disabled"}>Continuar al dictado</button>
      </form>
    `;

    root.querySelector("#setup-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const pid = String(fd.get("patientId"));
      const p = patients.find((x) => x.id === pid);
      if (!p) return;
      selectedPatient = p;
      docType = String(fd.get("docType")) as DocumentType;
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
  }

  function renderDictado(): void {
    root.innerHTML = `
      <p class="muted">Paciente: <strong>${selectedPatient?.nombre}</strong> · ${selectedPatient?.cedula}</p>
      <div class="dictado-toolbar">
        <button type="button" class="mic-btn ${listening ? "mic-active" : ""}" id="mic-btn" title="Dictar">
          ${listening ? "⏹ Detener" : "🎤 Dictar"}
        </button>
        <span class="muted">${listening ? "Escuchando…" : "Toque para hablar o escriba abajo"}</span>
      </div>
      <label class="search-label">Dictado clínico
        <textarea id="dictation" rows="10" placeholder="Hable o escriba el caso clínico…">${dictation}</textarea>
      </label>
      <p class="muted" id="error-msg"></p>
      <div class="stack">
        <button type="button" class="btn btn-primary" id="btn-process" ${processing ? "disabled" : ""}>
          ${processing ? "Procesando con IA…" : "Procesar con IA"}
        </button>
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
        const template = defaultTemplateFor(docType);
        generatedContent = await generateDocument({
          template,
          patient: selectedPatient,
          doctor,
          dictation,
        });
        step = "resultado";
        saveDraft();
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
        const title = s.title ? `<h3>${s.title}</h3>` : "";
        return `<article class="doc-section">${title}<pre class="doc-pre">${escapeHtml(s.body)}</pre></article>`;
      })
      .join("");

    root.innerHTML = `
      <p class="status-badge status-ok">Documento generado</p>
      <div class="doc-preview">${body || `<pre class="doc-pre">${escapeHtml(generatedContent)}</pre>`}</div>
      <div class="stack" style="margin-top:1rem">
        <button type="button" class="btn btn-primary" id="btn-copy">Copiar texto</button>
        <button type="button" class="btn btn-secondary" id="btn-edit">Editar dictado y regenerar</button>
        <button type="button" class="btn btn-ghost" data-nav="/borradores">Ver borradores</button>
      </div>
    `;

    root.querySelector("#btn-copy")?.addEventListener("click", async () => {
      await navigator.clipboard.writeText(generatedContent);
      alert("Copiado al portapapeles");
    });

    root.querySelector("#btn-edit")?.addEventListener("click", () => {
      step = "dictado";
      render();
    });

    bindNavButtons(root);
  }

  function saveDraft(): void {
    if (!selectedPatient) return;
    const template = defaultTemplateFor(docType);
    const draft: ClinicalDraft = {
      id: crypto.randomUUID(),
      patientId: selectedPatient.id,
      patientNombre: selectedPatient.nombre,
      patientCedula: selectedPatient.cedula,
      documentType: docType,
      dictation,
      templateId: template.id,
      templateName: template.name,
      generatedContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const drafts = loadJson<ClinicalDraft[]>("drafts", []);
    saveJson("drafts", [draft, ...drafts]);
  }

  render();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
