import { registerRoute } from "../app/router";
import { bindNavButtons, page } from "./helpers";

registerRoute({
  path: "/",
  title: "Home",
  nav: true,
  navLabel: "Home",
  render: () => {
    const el = page(
      "Buenos días, Doctor",
      `
      <p class="lead">Gestiona historias clínicas e informes con dictado e IA — versión web ligera.</p>
      <button type="button" class="hero-card" data-nav="/redactar">
        <span class="hero-title">Redactar</span>
        <span class="hero-sub">Historia clínica, informe o reposo</span>
      </button>
      <div class="grid-2">
        <button type="button" class="tile" data-nav="/pacientes">Nuevo paciente</button>
        <button type="button" class="tile" data-nav="/informes">Ver informes</button>
        <button type="button" class="tile" data-nav="/borradores">Borradores</button>
        <button type="button" class="tile" data-nav="/plantillas">Plantillas</button>
      </div>
      `,
    );
    bindNavButtons(el);
    return el;
  },
});
