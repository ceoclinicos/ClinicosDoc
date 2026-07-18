import { registerRoute } from "../../app/router";
import { bindNavButtons, page } from "../helpers";

registerRoute({
  path: "/plantillas",
  title: "Plantillas",
  medicoOnly: true,
  render: () => {
    const el = page(
      "Plantillas",
      `
      <div class="stack">
        <button type="button" class="tile tile-full" data-nav="/plantillas/examen-fisico">
          <strong>Catálogo examen físico</strong>
          <span class="muted">Sistemas y texto base para la IA</span>
        </button>
        <button type="button" class="tile tile-full" data-nav="/plantillas/encabezados">
          <strong>Encabezados</strong>
          <span class="muted">Hasta 4: logo, clínica o médico</span>
        </button>
        <button type="button" class="tile tile-full" data-nav="/plantillas/documentos">
          <strong>Informes y historias</strong>
          <span class="muted">Historia, informe y reposo</span>
        </button>
        <button type="button" class="tile tile-full" data-nav="/plantillas/recetas">
          <strong>Recetas</strong>
          <span class="muted">Órdenes médicas y recipe</span>
        </button>
      </div>
      `,
    );
    bindNavButtons(el);
    return el;
  },
});
