import { registerRoute, navigate } from "../app/router";
import { generateDocument } from "../services/ai/document-ai-service";
import { getAiProvider } from "../services/ai/ai-service";
import { bindExamSystemsEditor, orderEnabledByCatalog, loadExamCatalog } from "../services/exam-catalog";
import {
  defaultHeader,
  deleteDraft,
  getDraft,
  loadHeaders,
  saveDocument,
  templateForType,
  upsertDraft,
  upsertTemplate,
} from "../services/clinical-store";
import { loadDoctorProfile, saveDoctorProfile, type DoctorProfileLocal } from "../services/doctor-local";
import {
  buildFullDocumentHtml,
  buildMembreteFromPatient,
  printClinicalDocument,
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
import { loadJson } from "../services/local-store";
import { isSpeechSupported, startDictation } from "../services/speech";
import { getProfessionalSession } from "../registro/session";
import type {
  ClinicalDraft,
  DocumentHeader,
  DocumentTemplate,
  DocumentType,
  Patient,
} from "../shared/models";
import { DocumentReportTitles, DocumentTypeLabels } from "../shared/models";
import { catalogFor } from "../shared/section-catalog";
import {
  ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT,
  resolveEnfermedadActualEjemplo,
  saveEnfermedadActualEjemplo,
} from "../shared/enfermedad-actual";
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

  let step: "paciente" | "plantilla" | "dictado" | "resultado" =
    existingDraft?.generatedContent ? "resultado" : "paciente";
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

  let workingTemplate: DocumentTemplate = structuredClone(templateForType(docType));
  let selectedHeader: DocumentHeader | undefined =
    loadHeaders().find((h) => h.id === existingDraft?.headerId) ?? defaultHeader();

  const session = getProfessionalSession();
  let doctor = loadDoctorProfile() ?? {
    nombre: session?.nombre ?? "",
    cedula: session?.cedula ?? "",
    especialidad: session?.especialidad || "Médico general",
    mpps: session?.mpps ?? "",
  };

  if (existingDraft && !existingDraft.generatedContent) {
    step = existingDraft.dictation ? "dictado" : "paciente";
  }

  function render(): void {
    if (step === "paciente") renderPaciente();
    else if (step === "plantilla") renderPlantilla();
    else if (step === "dictado") renderDictado();
    else renderResultado();
  }

  function renderPaciente(): void {
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
      <p class="step-badge">1 / 4 · Paciente</p>
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
          <label>Nombre<input name="docNombre" required value="${escapeHtml(doctor?.nombre ?? "")}" /></label>
          <label>Cédula<input name="docCedula" value="${escapeHtml(doctor?.cedula ?? "")}" /></label>
          <label>Especialidad<input name="docEsp" required value="${escapeHtml(doctor?.especialidad ?? "Médico general")}" /></label>
          <label>MPPS<input name="docMpps" value="${escapeHtml(doctor?.mpps ?? "")}" /></label>
        </fieldset>
        <button type="submit" class="btn btn-primary" ${patients.length ? "" : "disabled"}>Continuar a plantilla</button>
        <button type="button" class="btn btn-ghost" data-nav="/">Cancelar</button>
      </form>
    `;

    root.querySelectorAll("[data-pick-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        docType = btn.getAttribute("data-pick-type") as DocumentType;
        workingTemplate = structuredClone(templateForType(docType));
        renderPaciente();
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
      workingTemplate = structuredClone(templateForType(docType));
      step = "plantilla";
      render();
    });

    bindNavButtons(root);
  }

  function renderPlantilla(): void {
    const catalog = catalogFor(docType);
    let draftExamIds = orderEnabledByCatalog(
      workingTemplate.enabledPhysicalExamSystemIds?.length
        ? workingTemplate.enabledPhysicalExamSystemIds
        : loadExamCatalog().map((s) => s.id),
      loadExamCatalog(),
    );
    const needsExam = docType === "historiaClinica" || docType === "informe";
    const showEjemplo = needsExam;
    const ejemploActual = resolveEnfermedadActualEjemplo(workingTemplate.enfermedadActualEjemplo);

    root.innerHTML = `
      <p class="step-badge">2 / 4 · Plantilla</p>
      <p class="lead">Configura secciones${needsExam ? " y examen físico" : ""} para este documento.</p>
      <form class="form" id="tpl-step-form">
        <label>Nombre de plantilla
          <input name="name" required value="${escapeHtml(workingTemplate.name)}" />
        </label>
        <fieldset class="card-panel">
          <legend><strong>Secciones</strong></legend>
          <div class="stack">
            ${catalog
              .map((sec) => {
                const checked = workingTemplate.sections.includes(sec) ? "checked" : "";
                const locked = sec === "Datos del paciente" ? "disabled" : "";
                return `<label class="check-row"><input type="checkbox" name="section" value="${escapeHtml(sec)}" ${checked} ${locked} /> ${escapeHtml(sec)}</label>`;
              })
              .join("")}
          </div>
        </fieldset>
        ${
          showEjemplo
            ? `
        <fieldset class="card-panel">
          <legend><strong>Enfermedad actual — ejemplo</strong></legend>
          <p class="muted">Estilo que seguirá la IA. Editable a su gusto.</p>
          <textarea name="enfermedadEjemplo" rows="7">${escapeHtml(ejemploActual || ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT)}</textarea>
        </fieldset>`
            : ""
        }
        ${
          needsExam
            ? `
        <fieldset class="card-panel">
          <legend><strong>Examen físico (sistemas activos)</strong></legend>
          <div id="exam-systems-box"></div>
        </fieldset>`
            : ""
        }
        <p class="muted">IA: ${getAiProvider()} · ${isSpeechSupported() ? "Dictado por voz disponible" : "Dictado solo texto"}</p>
        <label class="check-row"><input type="checkbox" name="saveTpl" value="1" /> Guardar esta configuración como plantilla por defecto</label>
        <button type="submit" class="btn btn-primary">Continuar al dictado</button>
        <button type="button" class="btn btn-ghost" id="btn-back-pac">Volver</button>
      </form>
    `;

    if (needsExam) {
      bindExamSystemsEditor(root.querySelector("#exam-systems-box") as HTMLElement, {
        enabledIds: draftExamIds,
        onChange: (ids) => {
          draftExamIds = ids;
        },
      });
    }

    root.querySelector("#btn-back-pac")?.addEventListener("click", () => {
      step = "paciente";
      render();
    });

    root.querySelector("#tpl-step-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const sections = Array.from(fd.getAll("section")).map(String);
      if (!sections.includes("Datos del paciente")) sections.unshift("Datos del paciente");
      const ordered = catalog.filter((s) => sections.includes(s));
      const examIds = draftExamIds;
      if (needsExam && examIds.length === 0) {
        alert("Seleccione al menos un sistema de examen físico.");
        return;
      }
      const ejemplo = showEjemplo
        ? String(fd.get("enfermedadEjemplo") ?? "").trim() || ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT
        : "";
      if (ejemplo) saveEnfermedadActualEjemplo(ejemplo);
      workingTemplate = {
        ...workingTemplate,
        name: String(fd.get("name")).trim() || workingTemplate.name,
        sections: ordered,
        enabledPhysicalExamSystemIds: examIds,
        enfermedadActualEjemplo: ejemplo,
        isDefault: true,
      };
      if (fd.get("saveTpl") === "1") {
        upsertTemplate(workingTemplate);
      }
      step = "dictado";
      render();
    });
  }

  function renderDictado(): void {
    root.innerHTML = `
      <p class="step-badge">3 / 4 · Dictado</p>
      <p class="muted"><strong>${escapeHtml(selectedPatient?.nombre ?? "")}</strong> · ${DocumentTypeLabels[docType]} · ${escapeHtml(workingTemplate.name)}</p>
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
        <button type="button" class="btn btn-ghost" id="btn-cfg-tpl">Configurar plantilla</button>
        <button type="button" class="btn btn-ghost" id="btn-back">Volver</button>
      </div>
    `;

    const ta = root.querySelector("#dictation") as HTMLTextAreaElement;
    ta.addEventListener("input", () => {
      dictation = ta.value;
    });

    root.querySelector("#mic-btn")?.addEventListener("click", () => {
      const errEl = root.querySelector("#error-msg") as HTMLElement;
      const micBtn = root.querySelector("#mic-btn") as HTMLButtonElement;
      const status = micBtn?.nextElementSibling as HTMLElement | null;
      if (listening) {
        stopSpeech?.();
        stopSpeech = null;
        listening = false;
        dictation = (root.querySelector("#dictation") as HTMLTextAreaElement)?.value ?? dictation;
        if (micBtn) {
          micBtn.classList.remove("mic-active");
          micBtn.textContent = "🎤 Dictar";
        }
        if (status) status.textContent = "Toque para hablar o escriba";
        return;
      }
      if (!isSpeechSupported()) {
        errEl.textContent = "Use Chrome o Edge para dictado por voz.";
        return;
      }
      listening = true;
      if (micBtn) {
        micBtn.classList.add("mic-active");
        micBtn.textContent = "⏹ Detener";
      }
      if (status) status.textContent = "Escuchando…";
      const taNow = root.querySelector("#dictation") as HTMLTextAreaElement;
      stopSpeech = startDictation(
        taNow?.value ?? dictation,
        (text) => {
          dictation = text;
          const t = root.querySelector("#dictation") as HTMLTextAreaElement;
          if (t) t.value = text;
        },
        (msg) => {
          errEl.textContent = msg;
          listening = false;
          stopSpeech = null;
          if (micBtn) {
            micBtn.classList.remove("mic-active");
            micBtn.textContent = "🎤 Dictar";
          }
          if (status) status.textContent = "Toque para hablar o escriba";
        },
      );
    });

    root.querySelector("#btn-back")?.addEventListener("click", () => {
      stopSpeech?.();
      listening = false;
      step = "plantilla";
      render();
    });
    root.querySelector("#btn-cfg-tpl")?.addEventListener("click", () => {
      stopSpeech?.();
      listening = false;
      step = "plantilla";
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
        generatedContent = await generateDocument({
          template: workingTemplate,
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
    const headers = loadHeaders();
    if (!selectedHeader) selectedHeader = defaultHeader();

    let sections = parseDocumentSections(generatedContent);

    const headerOpts = headers
      .map(
        (h) =>
          `<option value="${h.id}" ${selectedHeader?.id === h.id ? "selected" : ""}>${escapeHtml(h.name)}</option>`,
      )
      .join("");

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
          </div>`;
      })
      .join("");

    root.innerHTML = `
      <p class="step-badge">4 / 4 · Resultado</p>
      <p class="status-badge status-ok">${DocumentReportTitles[docType]} generado</p>
      <p class="muted">${escapeHtml(selectedPatient?.nombre ?? "")} · ${escapeHtml(selectedPatient?.cedula ?? "")}</p>
      <p class="muted">Los <strong>datos del paciente</strong> aparecen en el membrete de la vista previa (no como sección editable).</p>

      <div class="result-actions">
        <button type="button" class="btn btn-primary" id="btn-save">Guardar</button>
        <button type="button" class="btn btn-secondary" id="btn-print">Imprimir / PDF</button>
        <button type="button" class="btn btn-ghost" id="btn-scroll-preview">Vista previa</button>
      </div>

      <div class="field">
        <span class="field-label">Encabezado</span>
        <select id="header-select">${headerOpts || `<option value="">Sin encabezados — cree uno en Plantillas</option>`}</select>
      </div>

      <h2 class="home-section-title">Editar secciones</h2>
      <div id="sections-editor" class="stack">${sectionsHtml}</div>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-add-section">+ Sección</button>

      <h2 class="home-section-title" id="preview-heading">Vista previa (hoja)</h2>
      <div class="doc-paper-wrap">
        <div class="doc-paper doc-live-preview" id="live-preview"></div>
      </div>

      <div class="result-actions result-actions-bottom">
        <button type="button" class="btn btn-primary" id="btn-save-2">Guardar documento</button>
        <button type="button" class="btn btn-secondary" id="btn-print-2">Imprimir / PDF</button>
        <button type="button" class="btn btn-secondary" id="btn-copy">Copiar texto</button>
        <button type="button" class="btn btn-ghost" id="btn-edit">Editar dictado y regenerar</button>
        <button type="button" class="btn btn-ghost" data-nav="/informes">Ver informes</button>
      </div>
    `;

    const collectContent = (): string => {
      const boxes = Array.from(root.querySelectorAll(".section-edit")) as HTMLElement[];
      sections = boxes.map((box, i) => {
        const title = (box.querySelector(".sec-title") as HTMLInputElement).value.trim();
        let body = (box.querySelector(".sec-body") as HTMLTextAreaElement).value;
        if (isPhysicalExamTitle(title) || box.querySelector(".vitals-editor")) {
          const vitals = readVitalsFromForm(box, `vs${i}`);
          body = applyVitalsToBody(body, vitals);
        }
        return { id: sections[i]?.id ?? crypto.randomUUID(), title, body };
      });
      generatedContent = serializeDocumentSections(sections);
      return generatedContent;
    };

    const refreshPreview = () => {
      collectContent();
      const box = root.querySelector("#live-preview") as HTMLElement;
      if (box) {
        box.innerHTML = buildFullDocumentHtml({
          type: docType,
          content: generatedContent,
          header: selectedHeader,
          membrete: selectedPatient ? buildMembreteFromPatient(selectedPatient) : undefined,
        });
      }
      persistDraft();
    };

    refreshPreview();

    root.querySelector("#header-select")?.addEventListener("change", (e) => {
      const id = (e.target as HTMLSelectElement).value;
      selectedHeader = headers.find((h) => h.id === id) ?? defaultHeader();
      refreshPreview();
    });

    root.querySelector("#sections-editor")?.addEventListener("input", () => refreshPreview());

    root.querySelector("#btn-add-section")?.addEventListener("click", () => {
      collectContent();
      sections = [...sections, { id: crypto.randomUUID(), title: "", body: "" }];
      generatedContent = serializeDocumentSections(sections);
      renderResultado();
    });

    root.querySelector("#btn-scroll-preview")?.addEventListener("click", () => {
      root.querySelector("#preview-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const doPrint = () => {
      refreshPreview();
      if (!selectedPatient) return;
      printClinicalDocument({
        type: docType,
        content: generatedContent,
        header: selectedHeader,
        membrete: buildMembreteFromPatient(selectedPatient),
        patientNombre: selectedPatient.nombre,
      });
    };

    const doSave = () => {
      if (!selectedPatient) return;
      refreshPreview();
      const membreteData = buildMembreteFromPatient(selectedPatient);
      const doc = saveDocument({
        id: crypto.randomUUID(),
        patientId: selectedPatient.id,
        patientNombre: selectedPatient.nombre,
        patientCedula: selectedPatient.cedula,
        type: docType,
        content: generatedContent,
        rawDictation: dictation,
        createdAt: new Date().toISOString(),
        templateId: workingTemplate.id,
        templateName: workingTemplate.name,
        headerId: selectedHeader?.id,
        headerSnapshot: selectedHeader ? { ...selectedHeader } : undefined,
        membrete: membreteData,
      });
      deleteDraft(currentDraftId);
      alert("Documento guardado");
      navigate(`/informes/${doc.id}`);
    };

    root.querySelector("#btn-print")?.addEventListener("click", doPrint);
    root.querySelector("#btn-print-2")?.addEventListener("click", doPrint);
    root.querySelector("#btn-save")?.addEventListener("click", doSave);
    root.querySelector("#btn-save-2")?.addEventListener("click", doSave);

    root.querySelector("#btn-copy")?.addEventListener("click", async () => {
      refreshPreview();
      await navigator.clipboard.writeText(generatedContent);
      alert("Copiado al portapapeles");
    });

    root.querySelector("#btn-edit")?.addEventListener("click", () => {
      refreshPreview();
      step = "dictado";
      render();
    });

    bindNavButtons(root);
  }

  function persistDraft(): void {
    if (!selectedPatient) return;
    const draft: ClinicalDraft = {
      id: currentDraftId,
      patientId: selectedPatient.id,
      patientNombre: selectedPatient.nombre,
      patientCedula: selectedPatient.cedula,
      documentType: docType,
      dictation,
      templateId: workingTemplate.id,
      templateName: workingTemplate.name,
      headerId: selectedHeader?.id,
      generatedContent: generatedContent || undefined,
      createdAt: existingDraft?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    upsertDraft(draft);
  }

  render();
}
