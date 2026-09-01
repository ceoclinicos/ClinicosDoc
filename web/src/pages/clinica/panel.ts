import { navigate, registerRoute } from "../../app/router";
import { getClinicSession } from "../../clinic/session";
import { listClinicDocumentFeedPage } from "../../clinic/store";
import type { ClinicDocumentFeedRow } from "../../clinic/models";
import { fetchClinicSubscriptionStatus } from "../../services/clinic-subscription";
import { matchesCedula } from "../../services/cedula";
import { bindNavButtons, emptyState, page } from "../helpers";
import type { QueryDocumentSnapshot } from "firebase/firestore";

const PAGE_SIZE = 25;

registerRoute({
  path: "/clinica/panel",
  title: "Inicio",
  clinicOnly: true,
  nav: true,
  navLabel: "Inicio",
  render: () => {
    const session = getClinicSession();
    const el = page(
      session?.nombre ?? "Centro de salud",
      `
      <div id="clinic-sync-banner" class="warn-banner" hidden></div>
      <p class="lead">Informes creados con los moldes de este centro. Los más recientes aparecen arriba.</p>
      <label class="field">
        <span class="field-label">Buscar en lo cargado</span>
        <input type="search" id="clinic-doc-q" placeholder="Paciente, cédula, diagnóstico o médico" autocomplete="off" />
      </label>
      <div id="clinic-docs-status" class="muted">Cargando…</div>
      <div class="clinic-table-wrap" id="clinic-docs-wrap" hidden>
        <table class="clinic-table" id="clinic-docs-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Paciente</th>
              <th>Cédula</th>
              <th>Tipo</th>
              <th>Diagnóstico</th>
              <th>Médico</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="clinic-docs-body"></tbody>
        </table>
        <div class="clinic-pager" id="clinic-docs-pager" hidden>
          <span class="muted" id="clinic-docs-page-label"></span>
          <button type="button" class="btn btn-secondary" id="clinic-docs-more">Cargar más</button>
        </div>
      </div>
      `,
    );

    const status = el.querySelector("#clinic-docs-status") as HTMLElement;
    const wrap = el.querySelector("#clinic-docs-wrap") as HTMLElement;
    const body = el.querySelector("#clinic-docs-body") as HTMLElement;
    const search = el.querySelector("#clinic-doc-q") as HTMLInputElement;
    const pager = el.querySelector("#clinic-docs-pager") as HTMLElement;
    const pageLabel = el.querySelector("#clinic-docs-page-label") as HTMLElement;
    const btnMore = el.querySelector("#clinic-docs-more") as HTMLButtonElement;
    const syncBanner = el.querySelector("#clinic-sync-banner") as HTMLElement;

    void fetchClinicSubscriptionStatus()
      .then((st) => {
        if (!st.syncActive && st.message) {
          syncBanner.hidden = false;
          syncBanner.innerHTML = `${escapeHtml(st.message)} <a href="#/clinica/plan">Ver plan</a>`;
        }
      })
      .catch(() => undefined);

    let loadedRows: ClinicDocumentFeedRow[] = [];
    let cursor: QueryDocumentSnapshot | null = null;
    let hasMore = false;
    let loadingMore = false;

    function renderRows(rows: ClinicDocumentFeedRow[]): void {
      wrap.hidden = false;
      if (!rows.length) {
        body.innerHTML = `
          <tr>
            <td colspan="7" class="muted">Sin coincidencias</td>
          </tr>`;
        return;
      }
      body.innerHTML = rows
        .map(
          (r) => `
          <tr class="clinic-table-row" data-cedula="${encodeURIComponent(r.patientCedula)}" tabindex="0" role="link">
            <td class="clinic-table-date">${escapeHtml(formatDate(r.createdAt))}</td>
            <td><strong>${escapeHtml(r.patientNombre)}</strong></td>
            <td>${escapeHtml(r.patientCedula)}</td>
            <td>${escapeHtml(r.documentTypeLabel)}</td>
            <td class="clinic-table-dx" title="${escapeAttr(r.diagnostico)}">${escapeHtml(r.diagnostico)}</td>
            <td>${escapeHtml(r.doctorNombre)}</td>
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

    function updatePager(): void {
      const q = search.value.trim();
      pager.hidden = !hasMore && !q;
      btnMore.hidden = !hasMore || Boolean(q);
      pageLabel.textContent = q
        ? `Mostrando coincidencias en ${loadedRows.length} cargado(s)`
        : `${loadedRows.length} informe(s) cargado(s)${hasMore ? " · hay más" : ""}`;
    }

    function applyFilter(): void {
      const q = search.value.trim().toLowerCase();
      if (!q) {
        status.textContent = `${loadedRows.length} informe(s)`;
        renderRows(loadedRows);
        updatePager();
        return;
      }
      const filtered = loadedRows.filter(
        (r) =>
          matchesCedula(r.patientCedula, q) ||
          r.patientNombre.toLowerCase().includes(q) ||
          r.diagnostico.toLowerCase().includes(q) ||
          r.doctorNombre.toLowerCase().includes(q) ||
          r.documentTypeLabel.toLowerCase().includes(q),
      );
      status.textContent = `${filtered.length} de ${loadedRows.length} cargados`;
      renderRows(filtered);
      updatePager();
    }

    async function loadPage(reset: boolean): Promise<void> {
      if (loadingMore) return;
      loadingMore = true;
      btnMore.disabled = true;
      try {
        const page = await listClinicDocumentFeedPage(session!.clinicId, {
          pageSize: PAGE_SIZE,
          cursor: reset ? null : cursor,
        });
        if (reset) loadedRows = page.rows;
        else loadedRows = [...loadedRows, ...page.rows];
        cursor = page.cursor;
        hasMore = page.hasMore;
        if (!loadedRows.length && reset) {
          search.hidden = true;
          wrap.hidden = true;
          pager.hidden = true;
          status.innerHTML = emptyState(
            "Aún no hay informes. Cuando un médico vinculado cree un documento con el molde de este centro, aparecerá aquí.",
            "Invitar médicos",
            "/clinica/equipo",
          );
          bindNavButtons(status);
          return;
        }
        applyFilter();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "No se pudieron cargar los informes";
        status.textContent =
          /index|createdAt/i.test(msg)
            ? "Falta índice de Firestore para createdAt. Créalo desde el enlace del error en consola, o contacta soporte."
            : msg;
      } finally {
        loadingMore = false;
        btnMore.disabled = false;
      }
    }

    search.addEventListener("input", applyFilter);
    btnMore.addEventListener("click", () => void loadPage(false));

    void loadPage(true);

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
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
