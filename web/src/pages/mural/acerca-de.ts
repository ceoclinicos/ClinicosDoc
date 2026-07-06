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
      <p class="lead">Una herramienta hecha con cercanía, para quienes más lo necesitan en este momento.</p>

      <div class="card-panel stack acerca-prose">
        <h2>Por qué existe</h2>
        <p>
          Nos interesa que las personas afectadas por lo ocurrido en <strong>La Guaira</strong> y zonas cercanas
          tengan un <strong>registro de salud lo más eficiente y útil posible</strong> — no un trámite más,
          sino algo que de verdad sirva cuando se necesita atención, seguimiento o coordinación.
        </p>
        <p>
          Al mismo tiempo, este sitio funciona como <strong>portal de difusión para ayuda humanitaria</strong>
          (muro Ayúdame) y como <strong>herramienta logística para el personal de salud</strong> que está
          en terreno: buscar por cédula, dejar constancia de atenciones y, para médicos registrados,
          redactar informes con apoyo de IA.
        </p>

        <h2>Lo que buscamos</h2>
        <p>
          Creamos Clínicos Doc como utilidad concreta para el personal de salud y como un paso hacia un
          <strong>nuevo nivel de registro en salud</strong> en el país: más claro, más conectado, mejor
          para la atención y el seguimiento de la información cuando más importa.
        </p>
        <p class="muted">Zonas prioritarias del muro: ${ZONAS_AFECTADAS.join(" · ")}</p>

        <h2>Cómo puede apoyar</h2>
        <p>
          Si cree que esta herramienta debe <strong>seguir desarrollándose y mantenerse en línea</strong>,
          puede demostrarlo con un aporte económico. Eso nos ayuda a cubrir servidores, servicios de API,
          dominio y otros gastos mientras seguimos mejorando el sitio y las funciones para pacientes y médicos.
        </p>
        <p>No es obligatorio usar la plataforma para donar, ni donar para usarla. Cualquier monto suma.</p>

        <div class="apoyo-box">
          <h3>Pago móvil</h3>
          <dl class="apoyo-datos">
            <div><dt>Teléfono</dt><dd>0424-8052328</dd></div>
            <div><dt>Cédula</dt><dd>23.536.843</dd></div>
            <div><dt>Banco</dt><dd>Banco de Venezuela</dd></div>
          </dl>
          <h3>USDT</h3>
          <p class="muted apoyo-usdt">Dirección de wallet — próximamente en esta página.</p>
        </div>

        <h2>En pocas palabras</h2>
        <ul class="acerca-list">
          <li><strong>Pacientes:</strong> registro, muro de ayuda, consulta de atenciones (cédula + PIN de 4 dígitos).</li>
          <li><strong>Profesionales:</strong> registro de atenciones por cédula (cédula, PIN y código MPPS).</li>
        </ul>
      </div>

      <p class="muted acerca-footer">Proyecto en construcción continua · <a href="https://clinicosdoc.com">clinicosdoc.com</a></p>
      `,
    ),
});
