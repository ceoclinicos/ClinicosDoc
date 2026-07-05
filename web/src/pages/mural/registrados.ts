import { registerRoute } from "../../app/router";
import { countRegistrados, formatFecha, listPacientesRegistrados } from "../../registro/store";
import { page } from "../helpers";

registerRoute({
  path: "/registrados",
  title: "Registrados",
  nav: true,
  navLabel: "Registrados",
  render: () => {
    const el = page("Registrados", `
      <p class="lead">Personas y profesionales en el sistema (sin datos sensibles).</p>
      <div id="stats" class="grid-2"><p class="muted">Cargando…</p></div>
      <h2 style="margin-top:1.5rem;font-size:1.1rem">Pacientes recientes</h2>
      <div id="lista-pacientes"></div>
    `);

    const stats = el.querySelector("#stats") as HTMLElement;
    const lista = el.querySelector("#lista-pacientes") as HTMLElement;

    countRegistrados()
      .then((c) => {
        stats.innerHTML = `
          <div class="tile"><strong>${c.pacientes}</strong><br><span class="muted">Pacientes</span></div>
          <div class="tile"><strong>${c.profesionales}</strong><br><span class="muted">Profesionales</span></div>
          <div class="tile tile-full"><strong>${c.solicitudes}</strong> solicitudes en el muro</div>
        `;
      })
      .catch(() => {
        stats.innerHTML = `<p class="status-badge status-error">No se pudieron cargar estadísticas</p>`;
      });

    listPacientesRegistrados()
      .then((pacs) => {
        if (!pacs.length) {
          lista.innerHTML = `<p class="muted">Sin pacientes registrados aún.</p>`;
          return;
        }
        lista.innerHTML = `
          <ul class="list">
            ${pacs
              .slice(0, 50)
              .map(
                (p) => `
              <li class="list-item stack-item">
                <strong>${p.nombre}</strong>
                <span class="muted">C.I. ${p.cedula} · ${p.edad} años · ${p.sexo || "—"}</span>
                <span class="muted">${formatFecha(p.createdAt)}</span>
              </li>`,
              )
              .join("")}
          </ul>
        `;
      })
      .catch(() => {
        lista.innerHTML = `<p class="muted">Error al cargar lista.</p>`;
      });

    return el;
  },
});
