import { registerRoute, navigate } from "../app/router";
import { generateDocument, generateOrdenesFromCase, generateReceta, appendFarmacoToReceta } from "../services/ai/document-ai-service";
import { bindExamSystemsEditor, orderEnabledByCatalog, loadExamCatalog } from "../services/exam-catalog";
import { bindSectionsEditor } from "../services/section-editor";
import {
  defaultHeader,
  deleteDraft,
  getDocument,
  getDraft,
  loadDocuments,
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
  downloadClinicalPdf,
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
import { loadJson, saveJson } from "../services/local-store";
import { findPatientByCedula, matchesCedula, normalizeCedula } from "../services/cedula";
import { canSync, findPatientByCedulaAnywhere, pushPatient, syncQuiet } from "../services/cloud-sync";
import { isSpeechSupported, startDictation } from "../services/speech";
import { getProfessionalSession } from "../registro/session";
import type {
  ClinicalDocument,
  ClinicalDraft,
  DocumentHeader,
  DocumentTemplate,
  DocumentType,
  Patient,
  PatientMembrete,
} from "../shared/models";
import { DocumentReportTitles, DocumentTypeLabels } from "../shared/models";
import {
  ENFERMEDAD_ACTUAL_EJEMPLO_DEFAULT,
  resolveEnfermedadActualEjemplo,
  saveEnfermedadActualEjemplo,
} from "../shared/enfermedad-actual";
import { ORDENES_MODO_LABELS, type OrdenesModo } from "../shared/ordenes-medicas";
import {
  type RecetaFuente,
} from "../shared/receta";
import { openFarmacoDialog } from "../ui/farmaco-dialog";
import { bindSectionRegenerateButtons, sectionRegenerateButtonHtml } from "../ui/section-regenerate";
import { bindMembreteEditor, membreteEditorHtml, readMembreteFromEditor } from "../ui/membrete-editor";
import { bindNavButtons, page } from "./helpers";
import { setOrdenesFromCasePending } from "./generar-ordenes";

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
    const el = page(
      "Redactar",
      `<div id="redactar-root"></div>`,
      `<div class="tools-wrap">
        <button type="button" class="btn btn-ghost btn-sm" id="btn-tools">Herramientas ▾</button>
        <div id="tools-menu" class="tools-menu" hidden>
          <button type="button" data-tool="preview">Vista previa</button>
          <button type="button" data-tool="pdf">Guardar PDF</button>
          <button type="button" data-tool="print">Imprimir</button>
        </div>
      </div>`,
    );
    mountRedactar(el.querySelector("#redactar-root") as HTMLElement, el);
    bindNavButtons(el);
    return el;
  },
});

function mountRedactar(root: HTMLElement, pageEl: HTMLElement): void {
  const q = hashQuery();
  const draftId = q.get("draft");
  const tipoQ = q.get("tipo") as DocumentType | null;
  const existingDraft = draftId ? getDraft(draftId) : undefined;

  let step: "paciente" | "plantilla" | "dictado" | "resultado" =
    existingDraft?.generatedContent ? "resultado" : "paciente";
  let dictation = existingDraft?.dictation ?? "";
  let generatedContent = existingDraft?.generatedContent ?? "";
  /** Si ya se guardó el documento en esta sesión, regenerar/guardar actualiza el mismo. */
  let savedDocumentId: string | null = null;
  let processing = false;
  let listening = false;
  let stopSpeech: (() => void) | null = null;
  let currentDraftId = existingDraft?.id ?? crypto.randomUUID();
  let ordenesUsarInforme = false;
  let ordenesNotes = "";
  let ordenesModo: OrdenesModo = "ordenes";
  let selectedSourceDocId: string | null = null;
  let recetaFuente: RecetaFuente = "dictar";
  let diagnosticoText = "";
  let cedulaSearch = "";
  let patientSearchMessage = "";
  let editableMembrete: PatientMembrete | null = null;

  let patients = loadJson<Patient[]>("patients", []);
  let selectedPatient: Patient | null =
    patients.find((p) => p.id === existingDraft?.patientId) ?? null;

  let docType: DocumentType =
    existingDraft?.documentType ??
    (tipoQ && ["historiaClinica", "informe", "reposo", "ordenesMedicas", "receta"].includes(tipoQ) ? tipoQ : "informe");

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

  /** Dictado efectivo para IA/regenerar (incluye diagnóstico en receta por protocolos). */
  function effectiveDictation(): string {
    return dictation.trim() || diagnosticoText.trim();
  }

  function currentMembrete(): PatientMembrete {
    if (editableMembrete) return editableMembrete;
    if (selectedPatient) return buildMembreteFromPatient(selectedPatient);
    return { nombre: "", edad: "", sexo: "", fechaNacimiento: "", fecha: "" };
  }

  function upsertPatientInList(patient: Patient): Patient {
    const idx = patients.findIndex(
      (p) => p.id === patient.id || normalizeCedula(p.cedula) === normalizeCedula(patient.cedula),
    );
    let saved = patient;
    if (idx >= 0) {
      saved = { ...patient, id: patients[idx].id };
      patients[idx] = saved;
    } else {
      saved = { ...patient, id: crypto.randomUUID() };
      patients.unshift(saved);
    }
    saveJson("patients", patients);
    if (canSync()) syncQuiet(() => pushPatient(saved));
    return saved;
  }

  function patientCaseDocs(): ClinicalDocument[] {
    if (!selectedPatient) return [];
    return loadDocuments().filter(
      (d) =>
        d.patientId === selectedPatient!.id &&
        (d.type === "informe" || d.type === "historiaClinica"),
    );
  }

  function runTool(tool: string): void {
    if (!selectedPatient || !generatedContent) {
      alert("Primero genera el documento para usar esta herramienta.");
      return;
    }
    const menu = pageEl.querySelector("#tools-menu") as HTMLElement | null;
    if (menu) menu.hidden = true;
    if (tool === "preview") {
      const box = root.querySelector("#live-preview") as HTMLElement | null;
      if (box) {
        box.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        // Si aún no hay preview en pantalla, mostrar alerta con HTML en nueva ventana simple
        const w = window.open("", "_blank");
        if (w) {
          w.document.write(
            buildFullDocumentHtml({
              type: docType,
              content: generatedContent,
              header: selectedHeader,
              membrete: currentMembrete(),
            }),
          );
          w.document.close();
        }
      }
      return;
    }
    if (tool === "pdf") {
      void downloadClinicalPdf({
        type: docType,
        content: generatedContent,
        header: selectedHeader,
        membrete: currentMembrete(),
        patientNombre: selectedPatient.nombre,
        patientCedula: selectedPatient.cedula,
      }).catch((err) => {
        alert(err instanceof Error ? err.message : "No se pudo generar el PDF");
      });
      return;
    }
    if (tool === "print") {
      printClinicalDocument({
        type: docType,
        content: generatedContent,
        header: selectedHeader,
        membrete: currentMembrete(),
        patientNombre: selectedPatient.nombre,
        patientCedula: selectedPatient.cedula,
      });
    }
  }

  pageEl.querySelector("#btn-tools")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = pageEl.querySelector("#tools-menu") as HTMLElement | null;
    if (menu) menu.hidden = !menu.hidden;
  });
  pageEl.querySelectorAll("[data-tool]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tool = btn.getAttribute("data-tool");
      if (tool) runTool(tool);
    });
  });
  document.addEventListener("click", () => {
    const menu = pageEl.querySelector("#tools-menu") as HTMLElement | null;
    if (menu) menu.hidden = true;
  });

  function render(): void {
    if (step === "paciente") renderPaciente();
    else if (step === "plantilla") renderPlantilla();
    else if (step === "dictado") renderDictado();
    else renderResultado();
  }

  function renderPaciente(): void {
    const q = normalizeCedula(cedulaSearch);
    const filtered = q
      ? patients.filter((p) => matchesCedula(p.cedula, cedulaSearch))
      : patients;

    const patientOptions = filtered
      .map(
        (p) =>
          `<option value="${p.id}" ${selectedPatient?.id === p.id ? "selected" : ""}>${escapeHtml(p.nombre)} (${escapeHtml(p.cedula)})</option>`,
      )
      .join("");

    const typeBtns = (["historiaClinica", "informe", "reposo", "ordenesMedicas", "receta"] as DocumentType[])
      .map(
        (t) =>
          `<button type="button" class="tile ${docType === t ? "tile-selected" : ""}" data-pick-type="${t}">${DocumentTypeLabels[t]}</button>`,
      )
      .join("");

    root.innerHTML = `
      <p class="step-badge">1 / 4 · Paciente</p>
      <p class="lead">¿Para qué paciente es este ${DocumentTypeLabels[docType].toLowerCase()}?</p>
      <div class="grid-2" style="margin-bottom:1rem">${typeBtns}</div>
      <div class="search-row">
        <label class="search-label">Buscar por cédula
          <input type="text" id="cedula-search" value="${escapeHtml(cedulaSearch)}" placeholder="Ej. V-12345678" inputmode="numeric" />
        </label>
        <button type="button" class="btn btn-secondary" id="btn-cedula-search">Buscar</button>
      </div>
      <p class="muted" id="patient-search-msg">${escapeHtml(patientSearchMessage)}</p>
      <form class="form" id="setup-form">
        <label>Paciente
          <select name="patientId" required ${filtered.length ? "" : "disabled"}>
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
        <button type="submit" class="btn btn-primary" ${filtered.length ? "" : "disabled"}>Continuar a plantilla</button>
        <button type="button" class="btn btn-ghost" data-nav="/pacientes/nuevo">Agregar paciente</button>
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

    root.querySelector("#cedula-search")?.addEventListener("input", (e) => {
      cedulaSearch = (e.target as HTMLInputElement).value;
      patientSearchMessage = "";
      renderPaciente();
    });

    root.querySelector("#btn-cedula-search")?.addEventListener("click", () => void searchPatientByCedula());
    root.querySelector("#cedula-search")?.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") {
        e.preventDefault();
        void searchPatientByCedula();
      }
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
      persistDraft();
      step = "plantilla";
      render();
    });

    bindNavButtons(root);
  }

  async function searchPatientByCedula(): Promise<void> {
    const input = root.querySelector("#cedula-search") as HTMLInputElement | null;
    cedulaSearch = input?.value.trim() ?? "";
    if (!cedulaSearch) {
      patientSearchMessage = "Ingresa una cédula válida";
      renderPaciente();
      return;
    }
    patientSearchMessage = "Buscando…";
    renderPaciente();

    const local = findPatientByCedula(patients, cedulaSearch);
    let found: Patient | null = local ?? null;
    if (!found) {
      try {
        found = await findPatientByCedulaAnywhere(cedulaSearch);
      } catch {
        /* sin conexión */
      }
    }

    if (found) {
      const saved = upsertPatientInList(found);
      selectedPatient = saved;
      patientSearchMessage = `Seleccionado: ${saved.nombre}`;
      workingTemplate = structuredClone(templateForType(docType));
      persistDraft();
      step = "plantilla";
      render();
    } else {
      patientSearchMessage = "No se encontró paciente con esa cédula";
      renderPaciente();
    }
  }

  function renderPlantilla(): void {
    let draftExamIds = orderEnabledByCatalog(
      workingTemplate.enabledPhysicalExamSystemIds?.length
        ? workingTemplate.enabledPhysicalExamSystemIds
        : loadExamCatalog().map((s) => s.id),
      loadExamCatalog(),
    );
    let draftSections = [...workingTemplate.sections];
    let draftSectionTexts: Record<string, string> = {
      ...(workingTemplate.sectionDefaultTexts ?? {}),
    };
    const needsExam = docType === "historiaClinica" || docType === "informe" || docType === "reposo";
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
          <div id="sections-box"></div>
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
        <p class="muted">${isSpeechSupported() ? "Dictado por voz disponible" : "Dictado solo texto"}</p>
        <label class="check-row"><input type="checkbox" name="saveTpl" value="1" /> Guardar esta configuración como plantilla por defecto</label>
        <button type="submit" class="btn btn-primary">Continuar al dictado</button>
        <button type="button" class="btn btn-ghost" id="btn-back-pac">Volver</button>
      </form>
    `;

    bindSectionsEditor(root.querySelector("#sections-box") as HTMLElement, {
      documentType: docType,
      activeSections: draftSections,
      sectionDefaultTexts: draftSectionTexts,
      onChange: (state) => {
        draftSections = state.activeSections;
        draftSectionTexts = state.sectionDefaultTexts;
      },
    });

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
      const examIds = orderEnabledByCatalog(draftExamIds, loadExamCatalog());
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
        sections: draftSections,
        enabledPhysicalExamSystemIds: examIds,
        enfermedadActualEjemplo: ejemplo,
        sectionDefaultTexts: draftSectionTexts,
        isDefault: true,
      };
      if (fd.get("saveTpl") === "1") {
        upsertTemplate(workingTemplate);
      }
      persistDraft();
      step = "dictado";
      render();
    });
  }

  function renderDictado(): void {
    const isOrdenes = docType === "ordenesMedicas";
    const isReceta = docType === "receta";
    const caseDocs = patientCaseDocs();
    const canUsarInforme = caseDocs.length > 0;
    if (!canUsarInforme) {
      ordenesUsarInforme = false;
      if (recetaFuente === "informe") recetaFuente = "dictar";
    }

    const showInformePicker =
      (isOrdenes && ordenesUsarInforme) || (isReceta && recetaFuente === "informe");
    const showDiagnostico = isReceta && recetaFuente === "diagnostico";

    const sourceBlock = isOrdenes
      ? `
      <fieldset class="card-panel">
        <legend><strong>Fuente del caso</strong></legend>
        <label class="check-row"><input type="radio" name="ordenes-src" value="dictar" ${!ordenesUsarInforme ? "checked" : ""} /> Dictar</label>
        <label class="check-row ${canUsarInforme ? "" : "muted"}">
          <input type="radio" name="ordenes-src" value="informe" ${ordenesUsarInforme ? "checked" : ""} ${canUsarInforme ? "" : "disabled"} />
          Pasar informe / historia ${canUsarInforme ? "" : "(sin documentos de este paciente)"}
        </label>
      </fieldset>`
      : isReceta
        ? `
      <fieldset class="card-panel">
        <legend><strong>Cómo crear la receta</strong></legend>
        <label class="check-row"><input type="radio" name="receta-src" value="dictar" ${recetaFuente === "dictar" ? "checked" : ""} /> Dictar / escribir fármacos</label>
        <label class="check-row ${canUsarInforme ? "" : "muted"}">
          <input type="radio" name="receta-src" value="informe" ${recetaFuente === "informe" ? "checked" : ""} ${canUsarInforme ? "" : "disabled"} />
          Usar informe / historia ${canUsarInforme ? "" : "(sin documentos de este paciente)"}
        </label>
        <label class="check-row">
          <input type="radio" name="receta-src" value="diagnostico" ${recetaFuente === "diagnostico" ? "checked" : ""} />
          Por diagnóstico (protocolos / guías)
        </label>
      </fieldset>`
        : "";

    let mainInput = "";
    if (showInformePicker && canUsarInforme) {
      mainInput = `<div class="stack" id="case-docs">
            <p class="muted">Informes / historias de este paciente</p>
            ${caseDocs
              .map(
                (d) => `
              <label class="check-row card-panel">
                <input type="radio" name="src-doc" value="${d.id}" ${selectedSourceDocId === d.id ? "checked" : ""} />
                <span><strong>${escapeHtml(DocumentTypeLabels[d.type])}</strong> · ${escapeHtml(d.createdAt.slice(0, 19).replace("T", " "))}</span>
              </label>`,
              )
              .join("")}
            <label class="search-label">Contexto (editable)
              <textarea id="dictation" rows="10">${escapeHtml(dictation)}</textarea>
            </label>
            <label class="search-label">Notas / dictado adicional (opcional)
              <textarea id="ordenes-notes" rows="3">${escapeHtml(ordenesNotes)}</textarea>
            </label>
          </div>`;
    } else if (showDiagnostico) {
      mainInput = `
        <label class="search-label">Diagnóstico
          <textarea id="diagnostico" rows="5" placeholder="Ej. Faringoamigdalitis aguda bacteriana">${escapeHtml(diagnosticoText)}</textarea>
        </label>
        <p class="muted">La IA propondrá fármacos según protocolos y guías clínicas habituales.</p>
        <label class="search-label">Notas / restricciones (opcional)
          <textarea id="ordenes-notes" rows="3">${escapeHtml(ordenesNotes)}</textarea>
        </label>`;
    } else {
      mainInput = `
      <div class="dictado-toolbar">
        <button type="button" class="mic-btn ${listening ? "mic-active" : ""}" id="mic-btn">
          ${listening ? "⏹ Detener" : "🎤 Dictar"}
        </button>
        <span class="muted">${listening ? "Escuchando…" : "Toque para hablar o escriba"}</span>
      </div>
      <label class="search-label">${isReceta ? "Fármacos (dictar o escribir)" : "Dictado clínico"}
        <textarea id="dictation" rows="10" placeholder="${isReceta ? "Ej. amoxicilina clavulánico tabletas 7 días…" : "Hable o escriba el caso clínico…"}">${escapeHtml(dictation)}</textarea>
      </label>`;
    }

    const modoBlock = isOrdenes
      ? `<fieldset class="card-panel">
          <legend><strong>Tipo de hoja</strong></legend>
          ${(Object.keys(ORDENES_MODO_LABELS) as OrdenesModo[])
            .map(
              (m) =>
                `<label class="check-row"><input type="radio" name="ordenes-modo" value="${m}" ${ordenesModo === m ? "checked" : ""} /> ${ORDENES_MODO_LABELS[m]}</label>`,
            )
            .join("")}
        </fieldset>`
      : "";

    root.innerHTML = `
      <p class="step-badge">3 / 4 · Dictado</p>
      <p class="muted"><strong>${escapeHtml(selectedPatient?.nombre ?? "")}</strong> · ${DocumentTypeLabels[docType]} · ${escapeHtml(workingTemplate.name)}</p>
      ${sourceBlock}
      ${mainInput}
      ${modoBlock}
      <p class="muted" id="error-msg"></p>
      <div class="stack">
        <button type="button" class="btn btn-primary" id="btn-process" ${processing ? "disabled" : ""}>
          ${processing ? "Procesando con IA…" : "Procesar con IA"}
        </button>
        <button type="button" class="btn btn-ghost" id="btn-cfg-tpl">Configurar plantilla</button>
        <button type="button" class="btn btn-ghost" id="btn-back">Volver</button>
      </div>
    `;

    const ta = root.querySelector("#dictation") as HTMLTextAreaElement | null;
    let draftTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleDraft = () => {
      if (draftTimer) clearTimeout(draftTimer);
      draftTimer = setTimeout(() => persistDraft(), 800);
    };
    ta?.addEventListener("input", () => {
      dictation = ta.value;
      scheduleDraft();
    });
    root.querySelector("#ordenes-notes")?.addEventListener("input", (e) => {
      ordenesNotes = (e.target as HTMLTextAreaElement).value;
      scheduleDraft();
    });

    root.querySelectorAll('input[name="ordenes-src"]').forEach((el) => {
      el.addEventListener("change", () => {
        const v = (root.querySelector('input[name="ordenes-src"]:checked') as HTMLInputElement)?.value;
        ordenesUsarInforme = v === "informe";
        renderDictado();
      });
    });

    root.querySelectorAll('input[name="receta-src"]').forEach((el) => {
      el.addEventListener("change", () => {
        recetaFuente = ((root.querySelector('input[name="receta-src"]:checked') as HTMLInputElement)
          ?.value ?? "dictar") as RecetaFuente;
        renderDictado();
      });
    });

    root.querySelector("#diagnostico")?.addEventListener("input", (e) => {
      diagnosticoText = (e.target as HTMLTextAreaElement).value;
      scheduleDraft();
    });

    root.querySelectorAll('input[name="src-doc"]').forEach((el) => {
      el.addEventListener("change", () => {
        const id = (el as HTMLInputElement).value;
        selectedSourceDocId = id;
        const doc = caseDocs.find((d) => d.id === id);
        if (doc) {
          dictation = doc.content;
          renderDictado();
        }
      });
    });

    root.querySelectorAll('input[name="ordenes-modo"]').forEach((el) => {
      el.addEventListener("change", () => {
        ordenesModo = ((root.querySelector('input[name="ordenes-modo"]:checked') as HTMLInputElement)?.value ??
          "ordenes") as OrdenesModo;
      });
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

    root.querySelector("#btn-process")?.addEventListener("click", async () => {
      dictation = (root.querySelector("#dictation") as HTMLTextAreaElement)?.value.trim() ?? dictation.trim();
      const notesEl = root.querySelector("#ordenes-notes") as HTMLTextAreaElement | null;
      if (notesEl) ordenesNotes = notesEl.value;
      const dxEl = root.querySelector("#diagnostico") as HTMLTextAreaElement | null;
      if (dxEl) diagnosticoText = dxEl.value;
      const errEl = root.querySelector("#error-msg") as HTMLElement;
      const isReceta = docType === "receta";
      const isOrdenes = docType === "ordenesMedicas";
      const inputBlank =
        isReceta && recetaFuente === "diagnostico" ? !diagnosticoText.trim() : !dictation;
      if (inputBlank) {
        errEl.textContent =
          isReceta && recetaFuente === "diagnostico"
            ? "Escribe el diagnóstico."
            : (isOrdenes && ordenesUsarInforme) || (isReceta && recetaFuente === "informe")
              ? "Selecciona o pega el informe como contexto."
              : isReceta
                ? "Dicta o escribe los fármacos."
                : "Dicta o escribe el contenido antes de procesar.";
        return;
      }
      if (!selectedPatient || !doctor) return;

      processing = true;
      errEl.textContent = "";
      stopSpeech?.();
      listening = false;
      renderDictado();

      try {
        if (isOrdenes) {
          generatedContent = await generateOrdenesFromCase({
            patient: selectedPatient,
            doctor,
            caseContent: dictation,
            notes: ordenesUsarInforme ? ordenesNotes : "",
            modo: ordenesModo,
          });
        } else if (isReceta) {
          generatedContent = await generateReceta({
            patient: selectedPatient,
            doctor,
            fuente: recetaFuente,
            input: recetaFuente === "diagnostico" ? diagnosticoText : dictation,
            notes: recetaFuente === "dictar" ? "" : ordenesNotes,
          });
        } else {
          generatedContent = await generateDocument({
            template: workingTemplate,
            patient: selectedPatient,
            doctor,
            dictation,
          });
        }
        if (!editableMembrete && selectedPatient) {
          editableMembrete = buildMembreteFromPatient(selectedPatient);
        }
        step = "resultado";
        processing = false;
        if (savedDocumentId && generatedContent) {
          persistGeneratedDocument({ showAlert: true, navigateAfter: false });
        } else {
          persistDraft();
        }
        render();
      } catch (err) {
        errEl.textContent = err instanceof Error ? err.message : "Error al procesar";
        processing = false;
        renderDictado();
      }
    });
  }

  function persistGeneratedDocument(opts?: {
    showAlert?: boolean;
    navigateAfter?: boolean;
  }): ClinicalDocument | null {
    if (!selectedPatient || !generatedContent) return null;
    const existing = savedDocumentId ? getDocument(savedDocumentId) : undefined;
    const id = savedDocumentId ?? crypto.randomUUID();
    const membreteData = currentMembrete();
    editableMembrete = membreteData;
    const doc = saveDocument({
      id,
      patientId: selectedPatient.id,
      patientNombre: selectedPatient.nombre,
      patientCedula: selectedPatient.cedula,
      type: docType,
      content: generatedContent,
      rawDictation: effectiveDictation(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      templateId: workingTemplate.id,
      templateName: workingTemplate.name,
      headerId: selectedHeader?.id,
      headerSnapshot: selectedHeader ? { ...selectedHeader } : undefined,
      membrete: membreteData,
      sourceDocumentId:
        existing?.sourceDocumentId ??
        (docType === "ordenesMedicas" || (docType === "receta" && recetaFuente === "informe")
          ? selectedSourceDocId ?? undefined
          : undefined),
    });
    savedDocumentId = id;
    deleteDraft(currentDraftId);
    if (opts?.showAlert !== false) {
      alert(existing ? "Documento actualizado" : "Documento guardado");
    }
    if (opts?.navigateAfter) {
      navigate(`/informes/${doc.id}`);
    }
    return doc;
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

    const canRegenerate = Boolean(effectiveDictation());
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

    if (!editableMembrete && selectedPatient) {
      editableMembrete = buildMembreteFromPatient(selectedPatient);
    }
    const membrete = currentMembrete();

    root.innerHTML = `
      <p class="step-badge">4 / 4 · Resultado</p>
      <p class="status-badge status-ok">${DocumentReportTitles[docType]} generado</p>
      <p class="muted">${escapeHtml(selectedPatient?.nombre ?? "")} · ${escapeHtml(selectedPatient?.cedula ?? "")}</p>

      <div class="result-actions">
        <button type="button" class="btn btn-primary" id="btn-save">${savedDocumentId ? "Actualizar" : "Guardar"}</button>
        <button type="button" class="btn btn-ghost" id="btn-scroll-preview">Ir a vista previa</button>
      </div>

      <div class="field">
        <span class="field-label">Encabezado</span>
        <select id="header-select">${headerOpts || `<option value="">Sin encabezados — cree uno en Plantillas</option>`}</select>
      </div>

      ${membreteEditorHtml(membrete)}

      <h2 class="home-section-title">Editar secciones</h2>
      <div id="sections-editor" class="stack">${sectionsHtml}</div>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-add-section">+ Sección</button>
      ${
        docType === "receta"
          ? `<button type="button" class="btn btn-secondary btn-sm" id="btn-add-farmaco">+ Agregar fármaco</button>`
          : ""
      }

      <h2 class="home-section-title" id="preview-heading">Vista previa (hoja)</h2>
      <div class="doc-paper-wrap">
        <div class="doc-paper doc-live-preview" id="live-preview"></div>
      </div>

      <div class="result-actions result-actions-bottom">
        <button type="button" class="btn btn-primary" id="btn-save-2">${savedDocumentId ? "Actualizar documento" : "Guardar documento"}</button>
        <button type="button" class="btn btn-secondary" id="btn-copy">Copiar texto</button>
        <button type="button" class="btn btn-ghost" id="btn-edit">Editar dictado y regenerar</button>
        ${
          docType === "informe" || docType === "historiaClinica"
            ? `<button type="button" class="btn btn-secondary" id="btn-ordenes">Generar órdenes médicas</button>`
            : ""
        }
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
      editableMembrete = currentMembrete();
      const box = root.querySelector("#live-preview") as HTMLElement;
      if (box) {
        box.innerHTML = buildFullDocumentHtml({
          type: docType,
          content: generatedContent,
          header: selectedHeader,
          membrete: editableMembrete,
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

    bindMembreteEditor(
      root,
      (m) => {
        editableMembrete = m;
        refreshPreview();
      },
      () => currentMembrete(),
    );

    root.querySelector("#sections-editor")?.addEventListener("input", () => refreshPreview());

    const doctor = loadDoctorProfile();
    if (canRegenerate && selectedPatient && doctor) {
      bindSectionRegenerateButtons(root, {
        rawDictation: effectiveDictation(),
        template: workingTemplate,
        patient: selectedPatient,
        doctor,
        getSections: () => {
          const boxes = Array.from(root.querySelectorAll(".section-edit")) as HTMLElement[];
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
          const box = root.querySelector(`.section-edit[data-sec-idx="${index}"]`);
          const ta = box?.querySelector(".sec-body") as HTMLTextAreaElement | null;
          if (ta) ta.value = body;
        },
        onAfterRegenerate: () => refreshPreview(),
      });
    }

    root.querySelector("#btn-add-section")?.addEventListener("click", () => {
      collectContent();
      sections = [...sections, { id: crypto.randomUUID(), title: "", body: "" }];
      generatedContent = serializeDocumentSections(sections);
      renderResultado();
    });

    root.querySelector("#btn-add-farmaco")?.addEventListener("click", async () => {
      const picked = await openFarmacoDialog();
      if (!picked) return;
      try {
        collectContent();
        generatedContent = await appendFarmacoToReceta({
          currentContent: generatedContent,
          principioActivo: picked.principioActivo,
          presentacion: picked.presentacion,
          concentracion: picked.concentracion,
          patient: selectedPatient ?? undefined,
        });
        if (savedDocumentId) persistGeneratedDocument({ showAlert: false, navigateAfter: false });
        renderResultado();
        alert("Fármaco agregado");
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo agregar el fármaco");
      }
    });

    root.querySelector("#btn-scroll-preview")?.addEventListener("click", () => {
      root.querySelector("#preview-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const doSave = () => {
      if (!selectedPatient) return;
      editableMembrete = readMembreteFromEditor(root, currentMembrete());
      refreshPreview();
      persistGeneratedDocument({ showAlert: true, navigateAfter: false });
      renderResultado();
    };

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

    root.querySelector("#btn-ordenes")?.addEventListener("click", () => {
      if (!selectedPatient) return;
      refreshPreview();
      setOrdenesFromCasePending({
        patientId: selectedPatient.id,
        caseContent: generatedContent,
        headerId: selectedHeader?.id,
        sourceTypeLabel: DocumentTypeLabels[docType],
      });
      navigate("/ordenes/desde-caso");
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
      dictation: effectiveDictation(),
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
