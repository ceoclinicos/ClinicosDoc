import { navigate, registerRoute } from "../../app/router";
import { getClinicSession } from "../../clinic/session";
import { listClinicPatientRows } from "../../clinic/store";
import type { ClinicPatientRow } from "../../clinic/models";
import { matchesCedula } from "../../services/cedula";
import { bindNavButtons, emptyState, page } from "../helpers";

registerRoute({
  path: "/clinica/panel",
  title: "Pacientes del centro",
  clinicOnly: true,
  nav: true,
  navLabel: "Pacientes",
  render: () => {
    const session = getClinicSession();
    const el = page(
      session?.nombre ?? "Centro de salud",
      `
      <p class="lead">Pacientes con informes creados por médicos vinculados a este centro.</p>
      <label class="field">
        <span class="field-label">Buscar</span>
        <input type="search" id="clinic-patient-q" placeholder="Nombre o cédula" autocomplete="off" />
      </label>
      <div id="clinic-patients-status" class="muted">Cargando…</div>
      <div class="clinic-table-wrap" id="clinic-patients-wrap" hidden>
        <table class="clinic-table" id="clinic-patients-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Cédula</th>
              <th>Informes</th>
              <th>Último informe</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="clinic-patients-body"></tbody>
        </table>
      </div>
      `,
    );

    const status = el.querySelector("#clinic-patients-status") as HTMLElement;
    const wrap = el.querySelector("#clinic-patients-wrap") as HTMLElement;
    const body = el.querySelector("#clinic-patients-body") as HTMLElement;
    const search = el.querySelector("#clinic-patient-q") as HTMLInputElement;
    let allRows: ClinicPatientRow[] = [];

    function renderRows(rows: ClinicPatientRow[]): void {
      wrap.hidden = false;
      if (!rows.length) {
        body.innerHTML = `
          <tr>
            <td colspan="5" class="muted">Sin coincidencias</td>
          </tr>`;
        return;
      }
      body.innerHTML = rows
        .map(
          (r) => `
          <tr class="clinic-table-row" data-cedula="${encodeURIComponent(r.patientCedula)}" tabindex="0" role="link">
            <td><strong>${escapeHtml(r.patientNombre)}</strong></td>
            <td>${escapeHtml(r.patientCedula)}</td>
            <td>${r.documentCount}</td>
            <td>${formatDate(r.lastDocumentAt)}</td>
            <td class="clinic-table-action">Ver →</td>
          </tr>`,
        )
        .join("");
      body.querySelectorAll("[data-cedula]").forEach((node) => {
        const open = () => {
          const ced = decodeURIComponent(node.getAttribute("data-cedula") || "");
          if (ced) navigate(`/clinica/paciente/${encodeURIComponent(ced)}`);
        };
        node.addEventListener("click", open);
        node.addEventListener("keydown", (ev) => {
          const e = ev as KeyboardEvent;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        });
      });
    }

    function applyFilter(): void {
      const q = search.value.trim();
      if (!q) {
        status.textContent = `${allRows.length} paciente(s)`;
        renderRows(allRows);
        return;
      }
      const filtered = allRows.filter(
        (r) =>
          matchesCedula(r.patientCedula, q) ||
          r.patientNombre.toLowerCase().includes(q.toLowerCase()),
      );
      status.textContent = `${filtered.length} de ${allRows.length}`;
      renderRows(filtered);
    }

    search.addEventListener("input", applyFilter);

    void (async () => {
      try {
        allRows = await listClinicPatientRows(session!.clinicId);
        if (!allRows.length) {
          search.hidden = true;
          wrap.hidden = true;
          status.innerHTML = emptyState(
            "Aún no hay pacientes. Cuando un médico vinculado cree un informe con el molde de este centro, aparecerá aquí.",
            "Invitar médicos",
            "/clinica/equipo",
          );
          bindNavButtons(status);
          return;
        }
        applyFilter();
      } catch (err) {
        status.textContent = err instanceof Error ? err.message : "No se pudieron cargar pacientes";
      }
    })();

    bindNavButtons(el);
    return el;
  },
});

function formatDate(iso: string): string {
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return "—";
  return new Date(d).toLocaleString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
