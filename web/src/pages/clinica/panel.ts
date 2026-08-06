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
      <ul class="list" id="clinic-patients-list"></ul>
      `,
    );

    const status = el.querySelector("#clinic-patients-status") as HTMLElement;
    const list = el.querySelector("#clinic-patients-list") as HTMLElement;
    const search = el.querySelector("#clinic-patient-q") as HTMLInputElement;
    let allRows: ClinicPatientRow[] = [];

    function renderRows(rows: ClinicPatientRow[]): void {
      if (!rows.length) {
        list.innerHTML = `<li class="list-item muted">Sin coincidencias</li>`;
        return;
      }
      list.innerHTML = rows
        .map(
          (r) => `
          <li class="list-item list-item-action" data-cedula="${encodeURIComponent(r.patientCedula)}">
            <div>
              <strong>${escapeHtml(r.patientNombre)}</strong>
              <p class="muted">C.I. ${escapeHtml(r.patientCedula)} · ${r.documentCount} informe(s)</p>
              <p class="muted">Último: ${new Date(r.lastDocumentAt).toLocaleString("es")}</p>
            </div>
            <span class="muted">Ver →</span>
          </li>`,
        )
        .join("");
      list.querySelectorAll("[data-cedula]").forEach((node) => {
        node.addEventListener("click", () => {
          const ced = decodeURIComponent(node.getAttribute("data-cedula") || "");
          if (ced) navigate(`/clinica/paciente/${encodeURIComponent(ced)}`);
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
