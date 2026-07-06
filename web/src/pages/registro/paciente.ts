import { registerRoute, navigate } from "../../app/router";
import { formatFecha, listAtenciones, loginPaciente, registerPaciente } from "../../registro/store";
import {
  clearPatientSession,
  getPatientSession,
  setPatientSession,
} from "../../registro/session";
import { page } from "../helpers";

function tabs(active: "consultar" | "registro"): string {
  return `
    <div class="tab-row">
      <button type="button" class="tab ${active === "consultar" ? "active" : ""}" data-tab="consultar">Consultar</button>
      <button type="button" class="tab ${active === "registro" ? "active" : ""}" data-tab="registro">Registrarme</button>
    </div>
  `;
}

function bindPacientePage(el: HTMLElement): void {
  const session = getPatientSession();
  if (!session) {
    let mode: "consultar" | "registro" = "consultar";
    const body = el.querySelector(".page-body") as HTMLElement;

    const renderAuth = (): void => {
      body.innerHTML =
        mode === "consultar"
          ? `
          ${tabs("consultar")}
          <form class="form" id="pac-login">
            <label>Cédula<input name="cedula" required placeholder="Ej. V-12345678" /></label>
            <label>PIN (4 dígitos)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required /></label>
            <p class="muted"><a href="#/olvide-pin">Olvidé mi PIN</a></p>
            <button type="submit" class="btn btn-primary">Ver mis registros</button>
          </form>
        `
          : `
          ${tabs("registro")}
          <form class="form" id="pac-registro">
            <label>Nombre completo<input name="nombre" required /></label>
            <label>Cédula<input name="cedula" required /></label>
            <label>Edad<input name="edad" type="number" min="0" max="120" required /></label>
            <label>Fecha de nacimiento<input name="fechaNacimiento" type="date" required /></label>
            <label>Sexo
              <select name="sexo" required>
                <option value="">Seleccione…</option>
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
              </select>
            </label>
            <label>Teléfono<input name="telefono" type="tel" required placeholder="0412…" /></label>
            <label>Correo<input name="correo" type="email" required /></label>
            <label>PIN (4 dígitos)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required /></label>
            <button type="submit" class="btn btn-primary">Registrarme</button>
          </form>
        `;

      body.querySelectorAll("[data-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          mode = btn.getAttribute("data-tab") as "consultar" | "registro";
          renderAuth();
        });
      });

      body.querySelector("#pac-login")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        try {
          const p = await loginPaciente(String(fd.get("cedula")), String(fd.get("pin")));
          setPatientSession({ cedula: p.cedula, nombre: p.nombre });
          navigate("/paciente");
        } catch (err) {
          alert(err instanceof Error ? err.message : "Error");
        }
      });

      body.querySelector("#pac-registro")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        try {
          const p = await registerPaciente({
            cedula: String(fd.get("cedula")),
            nombre: String(fd.get("nombre")),
            edad: Number(fd.get("edad")),
            fechaNacimiento: String(fd.get("fechaNacimiento")),
            sexo: String(fd.get("sexo")),
            telefono: String(fd.get("telefono")),
            correo: String(fd.get("correo")),
            pin: String(fd.get("pin")),
          });
          setPatientSession({ cedula: p.cedula, nombre: p.nombre });
          navigate("/ayudame");
        } catch (err) {
          alert(err instanceof Error ? err.message : "Error al registrar");
        }
      });
    };
    renderAuth();
    return;
  }

  el.querySelector("#btn-logout")?.addEventListener("click", () => {
    clearPatientSession();
    navigate("/paciente");
  });

  const list = el.querySelector("#lista-atenciones") as HTMLElement;
  list.innerHTML = `<p class="muted">Cargando…</p>`;
  listAtenciones(session.cedula)
    .then((items) => {
      if (!items.length) {
        list.innerHTML = `
          <p class="status-badge status-new">Aún no hay atenciones registradas a su nombre.</p>
          <p class="muted">Cuando un profesional lo atienda y registre la visita, aparecerá aquí.</p>
        `;
        return;
      }
      list.innerHTML = `
        <p class="status-badge status-ok">${items.length} atención(es) registrada(s)</p>
        <ul class="list">
          ${items
            .map(
              (a) => `
            <li class="list-item stack-item">
              <strong>${formatFecha(a.createdAt)}</strong>
              <span class="muted">${a.professionalNombre} · ${a.especialidad}</span>
              <span><strong>Motivo:</strong> ${a.motivo}</span>
              ${a.notas ? `<p class="preview">${a.notas}</p>` : ""}
              ${a.lugarAtencion ? `<span class="muted">📍 ${a.lugarAtencion}</span>` : ""}
            </li>`,
            )
            .join("")}
        </ul>
      `;
    })
    .catch((err) => {
      list.innerHTML = `<p class="status-badge status-error">${err instanceof Error ? err.message : "Error"}</p>`;
    });
}

registerRoute({
  path: "/paciente",
  title: "Paciente",
  nav: false,
  render: () => {
    const session = getPatientSession();
    const el = page(
      session ? `Hola, ${session.nombre.split(" ")[0]}` : "Portal del paciente",
      session
        ? `
        <p class="lead">Sus atenciones médicas registradas en el sistema.</p>
        <p><a href="#/ayudame">← Ir al muro Ayúdame</a></p>
        <div id="lista-atenciones"></div>
      `
        : `
        <p class="lead">Consulte si tiene atenciones registradas o créese una ficha.</p>
        ${tabs("consultar")}
        <form class="form" id="pac-login">
          <label>Cédula<input name="cedula" required placeholder="Ej. V-12345678" /></label>
          <label>PIN (4 dígitos)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required /></label>
          <p class="muted"><a href="#/olvide-pin">Olvidé mi PIN</a></p>
          <button type="submit" class="btn btn-primary">Ver mis registros</button>
        </form>
      `,
      session ? `<button type="button" class="btn btn-ghost btn-sm" id="btn-logout">Salir</button>` : "",
    );
    bindPacientePage(el);
    return el;
  },
});
