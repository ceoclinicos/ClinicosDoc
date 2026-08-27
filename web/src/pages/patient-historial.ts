import { registerRoute, navigate } from "../app/router";
import { documentsForPatient } from "../services/patient-activity";
import { DocumentTypeLabels } from "../shared/models";
import { normalizeCedula } from "../services/cedula";
import { loadJson } from "../services/local-store";
import type { Patient } from "../shared/models";
import { formatDocumentDateTime } from "../shared/clinical-datetime";
import { bindNavButtons, emptyState, page } from "./helpers";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function loadPatients(): Patient[] {
  return loadJson<Patient[]>("patients", []);
}

registerRoute({
  path: "/pacientes/historial",
  title: "Informes del paciente",
  medicoOnly: true,
  render: () => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const cedulaRaw = params.get("cedula") || "";
    const patientId = params.get("id") || "";
    const cedNorm = normalizeCedula(cedulaRaw);
    const patients = loadPatients();
    const patient =
      patients.find((p) => normalizeCedula(p.cedula) === cedNorm) ||
      patients.find((p) => p.id === patientId) ||
      null;
    const docs = documentsForPatient(cedNorm || patientId);
    const nombre = patient?.nombre || docs[0]?.patientNombre || "Paciente";
    const edad = patient?.edad ? `${patient.edad} años` : docs[0]?.membrete?.edad || "—";

    const el = page(
      nombre,
      `
      <p class="muted"><a href="#/pacientes">← Pacientes</a></p>
      <p class="lead">C.I. ${escapeHtml(cedNorm || cedulaRaw || "—")} · ${escapeHtml(String(edad))}</p>
      ${
        docs.length === 0
          ? emptyState("Sin informes para este paciente.", "Redactar", "/")
          : `<div class="clinic-table-wrap">
              <table class="clinic-table patient-docs-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${docs
                    .map(
                      (d) => `
                    <tr class="clinic-table-row" data-nav="/informes/${d.id}" tabindex="0" role="link">
                      <td><strong>${escapeHtml(DocumentTypeLabels[d.type] || d.type)}</strong></td>
                      <td class="clinic-table-date">${escapeHtml(formatDocumentDateTime(d.createdAt))}</td>
                      <td class="clinic-table-action">Ver →</td>
                    </tr>`,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`
      }
      `,
    );

    el.querySelectorAll(".clinic-table-row[data-nav]").forEach((row) => {
      const open = () => {
        const path = row.getAttribute("data-nav");
        if (path) navigate(path);
      };
      row.addEventListener("click", open);
      row.addEventListener("keydown", (ev) => {
        const e = ev as KeyboardEvent;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });

    bindNavButtons(el);
    return el;
  },
});
