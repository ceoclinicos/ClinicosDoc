import { registerRoute } from "../../app/router";
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
      <div class="card-panel stack acerca-prose">
        <p>
          Nos interesa que las personas afectadas por lo ocurrido en La Guaira tengan un registro de
          salud lo más eficiente y útil posible, y que este sitio sirva también como portal de
          difusión humanitaria y herramienta logística para el personal de salud.
        </p>
        <p>
          Creamos Clínicos Doc como utilidad para médicos y brigadas, con la idea de un nuevo nivel
          de registro en salud que mejore la atención y el seguimiento en la nación.
        </p>
        <p>
          Quien crea que esta herramienta debe seguir adelante puede apoyarla económicamente y
          ayudarnos a cubrir servidores, servicios de API y otros gastos del desarrollo.
        </p>
        <div class="apoyo-box">
          <p class="apoyo-titulo"><strong>Pago móvil</strong></p>
          <p class="apoyo-line">0424-8052328 · C.I. 23.536.843 · Banco de Venezuela</p>
          <p class="apoyo-titulo"><strong>USDT</strong></p>
          <p class="apoyo-line apoyo-crypto">0x98359db0de5bcc01d39740fed8937d34ad48edf8</p>
          <p class="apoyo-titulo"><strong>BTC</strong></p>
          <p class="apoyo-line apoyo-crypto">113dVrBQYbLXCCz9EmW3Dc3Hrcf6gzunXn</p>
          <p class="apoyo-titulo"><strong>Binance ID</strong></p>
          <p class="apoyo-line">1256214109</p>
        </div>
      </div>
      <p class="muted acerca-footer"><a href="https://clinicosdoc.com">clinicosdoc.com</a></p>
      `,
    ),
});
