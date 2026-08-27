import { registerRoute, isMedicoLoggedIn, navigate } from "../app/router";
import {
  ensureMembershipsLoaded,
  getCachedMemberships,
} from "../clinic/membership-cache";
import { showPendingAffiliationNotices } from "../clinic/affiliation-notices";
import { listPendingInvitationsForDoctor } from "../clinic/store";
import { getPatientSession, getProfessionalSession } from "../registro/session";
import { loadDrafts } from "../services/clinical-store";
import {
  hasSeenRedactarTutorial,
  isTutorialButtonEnabled,
  resetRedactarTutorial,
} from "../services/onboarding";
import { flushPendingCloudSync } from "../services/sync-feedback";
import { buildPatientActivityRows } from "../services/patient-activity";
import { saludoHora, tituloProfesional } from "../shared/clinical-datetime";
import { openRedactarTutorial } from "../ui/redactar-tutorial";
import { bindNavButtons, page } from "./helpers";

const HOME_PAGE_SIZE = 10;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function medicoHome(): HTMLElement {
  const prof = getProfessionalSession();
  const saludoNombre = tituloProfesional(prof?.sexo);
  const draftsCount = loadDrafts().length;
  const allRows = buildPatientActivityRows();
  let visible = Math.min(HOME_PAGE_SIZE, allRows.length);

  function rowsHtml(limit: number): string {
    const slice = allRows.slice(0, limit);
    if (!slice.length) {
      return `
      <div class="home-activity-empty">
        <p class="muted"><strong>Sin informes aún</strong></p>
        <p class="muted">Crea tu primer informe clínico</p>
      </div>`;
    }
    return `
      <div class="clinic-table-wrap home-patient-table-wrap">
        <table class="clinic-table home-patient-table">
          <thead>
            <tr>
              <th>Paciente</th>
            </tr>
          </thead>
          <tbody id="home-patient-body">
            ${slice
              .map(
                (r) => {
                  const cedulaMeta = r.patientCedula ? `C.I. ${escapeHtml(r.patientCedula)}` : "";
                  const edadMeta = r.edad !== "—" ? `${escapeHtml(r.edad)} años` : "";
                  const metaLine = [cedulaMeta, edadMeta].filter(Boolean).join(" · ");
                  return `
              <tr class="clinic-table-row home-patient-row" tabindex="0" role="link"
                data-cedula="${escapeHtml(r.patientCedula)}"
                data-id="${escapeHtml(r.patientId)}">
                <td>
                  <strong>${escapeHtml(r.patientNombre)}</strong>
                  ${metaLine ? `<span class="muted home-patient-meta">${metaLine}</span>` : ""}
                  <span class="home-patient-date">${escapeHtml(r.lastAtLabel)}</span>
                  <span class="home-patient-dx" title="${escapeHtml(r.diagnostico)}">${escapeHtml(r.diagnostico)}</span>
                </td>
              </tr>`;
                },
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="clinic-pager" id="home-patient-pager" ${allRows.length > limit ? "" : "hidden"}>
        <span class="muted">${limit} de ${allRows.length}</span>
        <button type="button" class="btn btn-secondary" id="home-patient-more">Cargar más</button>
      </div>`;
  }

  const el = document.createElement("section");
  el.className = "page home-medico";
  el.innerHTML = `
    <header class="home-medico-top">
      <div>
        <p class="home-brand">Clínicos Doc</p>
        <h1 class="home-saludo">${saludoHora()}, ${escapeHtml(saludoNombre)}</h1>
        <p class="lead home-tagline">Gestiona tus historias clínicas con elegancia</p>
      </div>
      <button type="button" class="icon-gear" data-nav="/configuracion" aria-label="Configuración" title="Configuración">⚙</button>
    </header>

    <button type="button" class="home-redactar-hero" id="btn-open-redactar">
      <div class="home-redactar-text">
        <span class="hero-title">Redactar</span>
        <span class="hero-sub">Historia clínica, informe, órdenes y recetas</span>
      </div>
      <span class="home-redactar-cta">Redactar →</span>
    </button>

    <button type="button" class="btn btn-ghost" id="btn-probar-tutorial" hidden style="margin:0.75rem 0 0;width:100%">
      Probar tutorial
    </button>

    <h2 class="home-section-title">Accesos rápidos</h2>
    <div class="grid-2">
      <button type="button" class="tile tile-home" data-nav="/plantillas">
        <strong>Plantillas</strong>
        <span class="muted">HC, informes, encabezados</span>
      </button>
      <button type="button" class="tile tile-home" data-nav="/borradores">
        <strong>Borradores</strong>
        <span class="muted">${draftsCount ? `${draftsCount} guardado(s)` : "Sin borradores"}</span>
      </button>
    </div>

    <div class="card-panel home-activity">
      <h2 class="home-section-title" style="margin-top:0">Pacientes recientes</h2>
      <div id="home-patient-activity">${rowsHtml(visible)}</div>
    </div>

    <p class="muted home-panel-link"><a href="#/profesional">Panel de atenciones (registro por cédula)</a></p>

    <dialog class="sheet-dialog" id="origin-sheet">
      <form method="dialog" class="sheet-body">
        <h2>Origen del molde</h2>
        <p class="muted">¿Con qué plantillas quieres redactar?</p>
        <div id="origin-options" class="stack"></div>
        <p class="muted" id="origin-status" style="margin-top:0.5rem"></p>
        <button type="submit" class="btn btn-ghost" value="cancel">Cancelar</button>
      </form>
    </dialog>

    <dialog class="sheet-dialog" id="doc-type-sheet">
      <form method="dialog" class="sheet-body">
        <h2>Redactar documento</h2>
        <p class="muted">Selecciona el tipo de documento clínico</p>
        <button type="button" class="tile tile-full" data-type="historiaClinica">Historia clínica</button>
        <button type="button" class="tile tile-full" data-type="informe">Informe</button>
        <button type="button" class="tile tile-full" data-type="ordenesMedicas">Órdenes médicas</button>
        <button type="button" class="tile tile-full" data-type="receta">Receta</button>
        <button type="submit" class="btn btn-ghost" value="cancel">Cancelar</button>
      </form>
    </dialog>
  `;

  const originSheet = el.querySelector("#origin-sheet") as HTMLDialogElement;
  const typeSheet = el.querySelector("#doc-type-sheet") as HTMLDialogElement;
  const originOptions = el.querySelector("#origin-options") as HTMLElement;
  const originStatus = el.querySelector("#origin-status") as HTMLElement;
  const activityHost = el.querySelector("#home-patient-activity") as HTMLElement;

  function openPatientHistorial(cedula: string, id: string): void {
    const q = new URLSearchParams();
    if (cedula) q.set("cedula", cedula);
    if (id) q.set("id", id);
    navigate(`/pacientes/historial?${q.toString()}`);
  }

  function bindHomePatientActivity(): void {
    activityHost.querySelectorAll(".home-patient-row").forEach((row) => {
      const open = () => {
        const elRow = row as HTMLElement;
        openPatientHistorial(elRow.dataset.cedula || "", elRow.dataset.id || "");
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
    activityHost.querySelector("#home-patient-more")?.addEventListener("click", () => {
      visible = Math.min(visible + HOME_PAGE_SIZE, allRows.length);
      activityHost.innerHTML = rowsHtml(visible);
      bindHomePatientActivity();
    });
  }
  bindHomePatientActivity();

  function openTypeSheet(): void {
    typeSheet.showModal();
  }

  function renderOriginOptions(
    memberships: Array<{ clinicId: string; clinicName: string }>,
    statusMsg: string,
  ): void {
    originStatus.textContent = statusMsg;
    originOptions.innerHTML =
      `
      <button type="button" class="tile tile-full" data-origen="personal">
        <strong>Mis plantillas personales</strong>
        <span class="muted">Consultorio propio</span>
      </button>` +
      memberships
        .map(
          (m) => `
        <button type="button" class="tile tile-full" data-origen="clinic" data-clinic-id="${m.clinicId}" data-clinic-name="${m.clinicName.replace(/"/g, "&quot;")}">
          <strong>${m.clinicName}</strong>
          <span class="muted">Moldes institucionales</span>
        </button>`,
        )
        .join("");

    originOptions.querySelectorAll("[data-origen]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const origen = btn.getAttribute("data-origen");
        if (origen === "personal") {
          sessionStorage.removeItem("redactarClinicId");
          sessionStorage.removeItem("redactarClinicName");
        } else {
          sessionStorage.setItem("redactarClinicId", btn.getAttribute("data-clinic-id") || "");
          sessionStorage.setItem("redactarClinicName", btn.getAttribute("data-clinic-name") || "");
        }
        originSheet.close();
        openTypeSheet();
      });
    });
  }

  async function openOriginSheet(): Promise<void> {
    const cached = getCachedMemberships();
    originSheet.showModal();
    renderOriginOptions(
      cached,
      cached.length ? "" : "Buscando centros afiliados…",
    );

    const cedula = prof?.cedula || "";
    let memberships = cached;
    try {
      if (cedula) {
        memberships = await ensureMembershipsLoaded(cedula, prof?.cloudUserId, {
          force: !cached.length,
          backgroundRefresh: Boolean(cached.length),
        });
      }
    } catch {
      memberships = getCachedMemberships();
    }

    let statusMsg = "";
    if (!memberships.length) {
      let pendingNames: string[] = [];
      try {
        if (cedula) {
          pendingNames = (await listPendingInvitationsForDoctor(cedula, prof?.cloudUserId)).map(
            (i) => i.clinicName,
          );
        }
      } catch {
        /* ignore */
      }
      statusMsg = pendingNames.length
        ? `Invitación pendiente de: ${pendingNames.join(", ")}. Acéptala en Configuración (aún no eres afiliado).`
        : "No estás afiliado a ninguna clínica. Puedes usar tus plantillas personales.";
    }
    renderOriginOptions(memberships, statusMsg);
  }

  const openTutorial = () => {
    openRedactarTutorial({
      onStartRedactar: () => void openOriginSheet(),
    });
  };

  const tutorialBtn = el.querySelector("#btn-probar-tutorial") as HTMLButtonElement | null;
  const syncTutorialBtn = () => {
    if (tutorialBtn) tutorialBtn.hidden = !isTutorialButtonEnabled();
  };
  syncTutorialBtn();
  window.addEventListener("tutorialbtnchange", syncTutorialBtn);

  el.querySelector("#btn-open-redactar")?.addEventListener("click", () => void openOriginSheet());
  tutorialBtn?.addEventListener("click", () => {
    resetRedactarTutorial();
    openTutorial();
  });
  el.querySelectorAll("[data-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-type");
      typeSheet.close();
      if (type) navigate(`/redactar?tipo=${type}`);
    });
  });

  bindNavButtons(el);

  if (!hasSeenRedactarTutorial()) {
    requestAnimationFrame(openTutorial);
  }

  void flushPendingCloudSync({ quiet: true });

  void (async () => {
    try {
      const cedula = prof?.cedula || "";
      if (!cedula) return;
      // Precarga al abrir home: Redactar usa caché sin esperar
      await ensureMembershipsLoaded(cedula, prof?.cloudUserId, { force: true });
      showPendingAffiliationNotices();
    } catch {
      /* silencioso */
    }
  })();

  return el;
}

function publicHome(): HTMLElement {
  const el = page(
    "Registro médico",
    `
    <p class="lead">Centralice atenciones y consulte si una persona ya fue atendida — por cédula.</p>
    <button type="button" class="hero-card" data-nav="/profesional">
      <span class="hero-title">Soy profesional de salud</span>
      <span class="hero-sub">Buscar paciente · Registrar atención</span>
    </button>
    <button type="button" class="hero-card hero-card-alt" data-nav="/paciente">
      <span class="hero-title">Soy paciente</span>
      <span class="hero-sub">Ficha de emergencia (QR)</span>
    </button>
    <button type="button" class="hero-card" data-nav="/clinica">
      <span class="hero-title">Modo empresa / centro de salud</span>
      <span class="hero-sub">Plantillas del centro · Pacientes · Equipo médico</span>
    </button>
    `,
  );
  bindNavButtons(el);
  return el;
}

registerRoute({
  path: "/",
  title: "Inicio",
  nav: true,
  navLabel: "Inicio",
  render: () => {
    if (isMedicoLoggedIn()) return medicoHome();
    // Paciente logueado: no mostrar inicio público → portal + ficha
    if (getPatientSession() && !getProfessionalSession()) {
      navigate("/paciente");
      return page("Mi ficha", `<p class="muted">Abriendo su ficha de emergencia…</p>`);
    }
    return publicHome();
  },
});
