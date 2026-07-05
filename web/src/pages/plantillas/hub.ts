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
        <button type="button" class="tile tile-full" data-nav="/plantillas/examen-fisico">Catálogo examen físico</button>
        <button type="button" class="tile tile-full" data-nav="/plantillas/encabezados">Encabezados</button>
        <button type="button" class="tile tile-full" data-nav="/plantillas/documentos">Informes y historias</button>
        <button type="button" class="tile tile-full tile-muted" disabled>Recetas — próximamente</button>
      </div>
      `,
    );
    bindNavButtons(el);
    return el;
  },
});
