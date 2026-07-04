import { registerRoute } from "../app/router";
import { loadJson, saveJson } from "../services/local-store";
import type { ClinicalDraft, DocumentType, Patient } from "../shared/models";
import { bindNavButtons, page } from "./helpers";

registerRoute({
  path: "/redactar",
  title: "Redactar",
  render: () => {
    const patients = loadJson<Patient[]>("patients", []);
  const patientOptions = patients
    .map((p) => `<option value="${p.id}">${p.nombre}</option>`)
    .join("");

    const el = page(
      "Redactar documento",
      `
      <form class="form" id="redactar-form">
        <label>Tipo de documento
          <select name="docType">
            <option value="informe">Informe</option>
            <option value="historiaClinica">Historia clínica</option>
            <option value="reposo">Reposo</option>
          </select>
        </label>
        <label>Paciente
          <select name="patientId" required ${patients.length ? "" : "disabled"}>
            <option value="">Selecciona…</option>
            ${patientOptions}
          </select>
        </label>
        <label>Dictado clínico
          <textarea name="dictation" rows="8" placeholder="Escribe o dicta el caso…" required></textarea>
        </label>
        <p class="muted">IA, plantillas y PDF: próximo paso. El borrador se guardará al procesar.</p>
        <button type="submit" class="btn btn-primary">Procesar con IA (demo)</button>
      </form>
      ${patients.length === 0 ? `<p class="muted">Primero <a href="#/pacientes/nuevo">agrega un paciente</a>.</p>` : ""}
      `,
    );

    el.querySelector("#redactar-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const patientId = String(fd.get("patientId"));
      const patient = patients.find((p) => p.id === patientId);
      if (!patient) return;

      const draft: ClinicalDraft = {
        id: crypto.randomUUID(),
        patientId: patient.id,
        patientNombre: patient.nombre,
        patientCedula: patient.cedula,
        documentType: String(fd.get("docType")) as DocumentType,
        dictation: String(fd.get("dictation")),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        generatedContent: "[[SECTION:Examen físico]]\n(Demo web — conectar IA)",
      };
      const drafts = loadJson<ClinicalDraft[]>("drafts", []);
      saveJson("drafts", [draft, ...drafts]);
      alert("Borrador demo guardado. Conecta la IA en services/ai.");
      window.location.hash = "/borradores";
    });

    bindNavButtons(el);
    return el;
  },
});
