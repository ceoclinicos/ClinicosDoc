import { registerRoute } from "../../app/router";
import { ZONAS_AFECTADAS } from "../../registro/models";
import { page } from "../helpers";

registerRoute({
  path: "/acerca-de",
  title: "Acerca de",
  nav: true,
  navLabel: "Acerca de",
  render: () =>
    page(
      "Acerca de Clínicos Doc",
      `
      <p class="lead">Plataforma ligera para coordinar ayuda médica y humanitaria en zonas afectadas de Venezuela.</p>
      <div class="card-panel stack">
        <h2>¿Qué es el muro Ayúdame?</h2>
        <p>Las personas registradas pueden publicar su <strong>zona</strong> y <strong>necesidad</strong>, visible como un muro público para que médicos, brigadas y vecinos puedan responder.</p>
        <h2>Zonas prioritarias</h2>
        <p>${ZONAS_AFECTADAS.join(" · ")}</p>
        <h2>Profesionales de salud</h2>
        <p>Pueden registrarse, buscar pacientes por cédula y registrar atenciones. Las herramientas de consultorio (informes con IA) requieren inicio de sesión médica.</p>
        <h2>Datos del paciente</h2>
        <p>Cédula, nombre, edad, fecha de nacimiento, sexo, teléfono y correo. Para consultar sus atenciones solo necesita su cédula.</p>
      </div>
      <p class="muted">Proyecto comunitario · <a href="https://clinicosdoc.com">clinicosdoc.com</a></p>
      `,
    ),
});
