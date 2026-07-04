import { registerRoute } from "../../app/router";
import { page } from "../helpers";

registerRoute({
  path: "/plantillas/encabezados",
  title: "Encabezados",
  render: () =>
    page(
      "Encabezados",
      `<p class="lead">Logo, clínica o médico. Pendiente de portar desde Android.</p>`,
    ),
});

registerRoute({
  path: "/plantillas/documentos",
  title: "Plantillas de documentos",
  render: () =>
    page(
      "Informes y historias",
      `<p class="lead">Plantillas de informe, historia clínica y reposo. Pendiente de portar.</p>`,
    ),
});
