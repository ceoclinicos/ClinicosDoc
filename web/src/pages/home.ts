import { registerRoute } from "../app/router";
import { bindNavButtons, page } from "./helpers";

registerRoute({
  path: "/",
  title: "Home",
  nav: true,
  navLabel: "Home",
  render: () => {
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
        <span class="hero-sub">Ver mis atenciones registradas</span>
      </button>
      <details class="consultorio-details">
        <summary>Herramientas de consultorio (Clínicos Doc)</summary>
        <div class="grid-2" style="margin-top:0.75rem">
          <button type="button" class="tile" data-nav="/redactar">Redactar informe</button>
          <button type="button" class="tile" data-nav="/pacientes">Pacientes</button>
          <button type="button" class="tile" data-nav="/informes">Informes</button>
          <button type="button" class="tile" data-nav="/plantillas">Plantillas</button>
        </div>
      </details>
      `,
    );
    bindNavButtons(el);
    return el;
  },
});
