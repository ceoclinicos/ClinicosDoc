import { registerRoute, isMedicoLoggedIn, navigate } from "../app/router";
import { getPatientSession, getProfessionalSession } from "../registro/session";
import { loadDocuments, loadDrafts } from "../services/clinical-store";
import { DocumentTypeLabels } from "../shared/models";
import { bindNavButtons, page } from "./helpers";

function saludoHora(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function medicoHome(): HTMLElement {
  const prof = getProfessionalSession();
  const primerNombre = prof?.nombre?.trim().split(/\s+/)[0] || "Doctor";
  const recent = loadDocuments().slice(0, 3);
  const draftsCount = loadDrafts().length;

  const actividad =
    recent.length === 0
      ? `
      <div class="home-activity-empty">
        <p class="muted"><strong>Sin informes aún</strong></p>
        <p class="muted">Crea tu primer informe clínico</p>
      </div>`
      : `<ul class="list home-activity-list">${recent
          .map(
            (d) => `
          <li class="list-item list-item-action" data-nav="/informes/${d.id}">
            <strong>${DocumentTypeLabels[d.type]}</strong>
            <span class="muted">${d.patientNombre} · ${new Date(d.createdAt).toLocaleDateString("es")}</span>
          </li>`,
          )
          .join("")}</ul>`;

  const el = document.createElement("section");
  el.className = "page home-medico";
  el.innerHTML = `
    <header class="home-medico-top">
      <div>
        <p class="home-brand">Clínicos Doc</p>
        <h1 class="home-saludo">${saludoHora()}, ${primerNombre}</h1>
        <p class="lead home-tagline">Gestiona tus historias clínicas con elegancia</p>
      </div>
      <button type="button" class="icon-gear" data-nav="/configuracion" aria-label="Configuración" title="Configuración">⚙</button>
    </header>

    <button type="button" class="home-redactar-hero" id="btn-open-redactar">
      <div class="home-redactar-text">
        <span class="hero-title">Redactar</span>
        <span class="hero-sub">Historia clínica, informe, reposo u órdenes médicas</span>
      </div>
      <span class="home-redactar-cta">Redactar →</span>
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
      <h2 class="home-section-title" style="margin-top:0">Actividad reciente</h2>
      ${actividad}
    </div>

    <p class="muted home-panel-link"><a href="#/profesional">Panel de atenciones (registro por cédula)</a></p>

    <dialog class="sheet-dialog" id="doc-type-sheet">
      <form method="dialog" class="sheet-body">
        <h2>Redactar documento</h2>
        <p class="muted">Selecciona el tipo de documento clínico</p>
        <button type="button" class="tile tile-full" data-type="historiaClinica">Historia clínica</button>
        <button type="button" class="tile tile-full" data-type="informe">Informe</button>
        <button type="button" class="tile tile-full" data-type="reposo">Reposo</button>
        <button type="button" class="tile tile-full" data-type="ordenesMedicas">Órdenes médicas</button>
        <button type="submit" class="btn btn-ghost" value="cancel">Cancelar</button>
      </form>
    </dialog>
  `;

  const sheet = el.querySelector("#doc-type-sheet") as HTMLDialogElement;
  el.querySelector("#btn-open-redactar")?.addEventListener("click", () => sheet.showModal());
  el.querySelectorAll("[data-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-type");
      sheet.close();
      if (type) navigate(`/redactar?tipo=${type}`);
    });
  });

  bindNavButtons(el);
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
      <span class="hero-sub">Ficha de emergencia (QR) · Ayudemos</span>
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
