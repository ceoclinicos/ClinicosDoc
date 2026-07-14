import { navigate, registerRoute } from "../../app/router";
import {
  createAtencion,
  formatFecha,
  getPaciente,
  listAtenciones,
  loginProfesional,
  registerProfesional,
  upsertPacienteMinimo,
} from "../../registro/store";
import {
  clearAtencionCedula,
  clearProfessionalSession,
  getAtencionCedula,
  getProfessionalSession,
  setAtencionCedula,
  setProfessionalSession,
} from "../../registro/session";
import type { AtencionRegistro, PacienteRegistro } from "../../registro/models";
import { validarMpps } from "../../services/mpps-validation";
import { ESPECIALIDADES_MEDICAS_VE } from "../../registro/especialidades";
import { bindNavButtons, page } from "../helpers";

function especialidadOptions(): string {
  return ESPECIALIDADES_MEDICAS_VE.map((e) => `<option value="${e}">${e}</option>`).join("");
}

function tabs(active: "login" | "registro"): string {
  return `
    <div class="tab-row">
      <button type="button" class="tab ${active === "login" ? "active" : ""}" data-tab="login">Ingresar</button>
      <button type="button" class="tab ${active === "registro" ? "active" : ""}" data-tab="registro">Registrarme</button>
    </div>
  `;
}

function loginForm(): string {
  return `
    ${tabs("login")}
    <form class="form" id="prof-login">
      <label>Cédula<input name="cedula" required autocomplete="username" /></label>
      <label>PIN (contraseña, 4 dígitos)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required autocomplete="current-password" /></label>
      <label>Código MPPS<input name="mpps" required autocomplete="off" /></label>
      <p class="muted"><a href="#/olvide-pin?tipo=profesional">Olvidé mi PIN (contraseña)</a></p>
      <button type="submit" class="btn btn-primary">Ingresar</button>
    </form>
  `;
}

function registerForm(): string {
  return `
    ${tabs("registro")}
    <form class="form" id="prof-registro">
      <label>Nombre completo<input name="nombre" required /></label>
      <label>Cédula<input name="cedula" required /></label>
      <label>Correo electrónico<input name="correo" type="email" required placeholder="para recuperar PIN (contraseña)" /></label>
      <label>
        <span>Tipo</span>
        <select name="tipo">
          <option value="general">Médico general</option>
          <option value="especialista">Especialista</option>
        </select>
      </label>
      <label id="esp-wrap" hidden>
        Especialidad
        <select name="especialidad">
          <option value="">Seleccione…</option>
          ${especialidadOptions()}
        </select>
      </label>
      <label id="esp-otra-wrap" hidden>Otra especialidad<input name="especialidad_otra" placeholder="Escriba su especialidad" /></label>
      <label>Código MPPS<input name="mpps" required placeholder="Ej. 154472" /></label>
      <p class="muted">Se valida en vivo contra SACS (cédula + MPPS deben coincidir).</p>
      <label>PIN (contraseña, 4 dígitos)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required /></label>
      <button type="submit" class="btn btn-primary">Registrar profesional</button>
    </form>
  `;
}

function atencionesHtml(items: AtencionRegistro[]): string {
  if (!items.length) {
    return `<p class="status-badge status-new">Sin atenciones previas en el registro</p>`;
  }
  return `
    <p class="status-badge status-ok">${items.length} atención(es) previa(s)</p>
    <ul class="list">
      ${items
        .map(
          (a) => `
        <li class="list-item stack-item">
          <strong>${formatFecha(a.createdAt)}</strong>
          <span class="muted">${a.professionalNombre} · ${a.especialidad}</span>
          <span>${a.motivo}</span>
          ${a.notas ? `<p class="preview">${a.notas}</p>` : ""}
        </li>`,
        )
        .join("")}
    </ul>
  `;
}

function patientCard(p: PacienteRegistro, atenciones: AtencionRegistro[]): string {
  return `
    <div class="card-panel">
      <h2>${p.nombre}</h2>
      <p class="muted">C.I. ${p.cedula} · ${p.edad} años</p>
      ${atencionesHtml(atenciones)}
      <button type="button" class="btn btn-primary btn-block" id="btn-nueva-atencion">Registrar atención</button>
    </div>
  `;
}

function bindProfesionalPage(el: HTMLElement): void {
  const session = getProfessionalSession();
  if (!session) {
    let mode: "login" | "registro" = "login";
    const body = el.querySelector(".page-body") as HTMLElement;

    const renderAuth = (): void => {
      body.innerHTML = mode === "login" ? loginForm() : registerForm();
      body.querySelectorAll("[data-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          mode = btn.getAttribute("data-tab") as "login" | "registro";
          renderAuth();
        });
      });

      const tipo = body.querySelector<HTMLSelectElement>('select[name="tipo"]');
      const espWrap = body.querySelector("#esp-wrap") as HTMLElement | null;
      const espOtraWrap = body.querySelector("#esp-otra-wrap") as HTMLElement | null;
      const espSelect = body.querySelector<HTMLSelectElement>('select[name="especialidad"]');
      if (tipo && espWrap && espOtraWrap) {
        const syncEsp = (): void => {
          const esGeneral = tipo.value === "general";
          espWrap.hidden = esGeneral;
          if (esGeneral) {
            espOtraWrap.hidden = true;
            if (espSelect) espSelect.value = "";
          } else {
            espOtraWrap.hidden = espSelect?.value !== "Otra";
          }
        };
        tipo.addEventListener("change", syncEsp);
        espSelect?.addEventListener("change", syncEsp);
        syncEsp();
      }

      body.querySelector("#prof-login")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        try {
          const s = await loginProfesional(
            String(fd.get("cedula")),
            String(fd.get("pin")),
            String(fd.get("mpps")),
          );
          setProfessionalSession(s);
          navigate("/profesional");
        } catch (err) {
          alert(err instanceof Error ? err.message : "Error al ingresar");
        }
      });

      body.querySelector("#prof-registro")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const fd = new FormData(form);
        const esGeneral = fd.get("tipo") === "general";
        const btn = form.querySelector('[type="submit"]') as HTMLButtonElement | null;
        if (btn) btn.disabled = true;
        try {
          const cedula = String(fd.get("cedula"));
          const mpps = String(fd.get("mpps"));
          let especialidad = String(fd.get("especialidad") ?? "").trim();
          if (!esGeneral) {
            if (!especialidad) throw new Error("Seleccione su especialidad");
            if (especialidad === "Otra") {
              especialidad = String(fd.get("especialidad_otra") ?? "").trim();
              if (!especialidad) throw new Error("Escriba su especialidad");
            }
          }
          const check = await validarMpps(cedula, mpps);
          let nombre = String(fd.get("nombre")).trim();
          if (!nombre && check.medico.nombreCompleto) {
            nombre = check.medico.nombreCompleto;
            const nombreInput = form.querySelector<HTMLInputElement>('input[name="nombre"]');
            if (nombreInput) nombreInput.value = nombre;
          }
          await registerProfesional({
            cedula,
            nombre,
            especialidad,
            esMedicoGeneral: esGeneral,
            mpps: check.medico.mpps || mpps,
            correo: String(fd.get("correo")),
            pin: String(fd.get("pin")),
          });
          const s = await loginProfesional(cedula, String(fd.get("pin")), check.medico.mpps || mpps);
          setProfessionalSession(s);
          navigate("/profesional");
        } catch (err) {
          alert(err instanceof Error ? err.message : "Error al registrar");
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    };
    renderAuth();
    return;
  }

  el.querySelector("#btn-logout")?.addEventListener("click", () => {
    clearProfessionalSession();
    navigate("/profesional");
  });

  el.querySelector("#btn-buscar")?.addEventListener("click", async () => {
    const input = el.querySelector<HTMLInputElement>("#cedula-buscar");
    const result = el.querySelector("#resultado") as HTMLElement;
    const cedula = input?.value.trim() ?? "";
    if (!cedula) return;

    result.innerHTML = `<p class="muted">Buscando…</p>`;
    try {
      const paciente = await getPaciente(cedula);
      if (!paciente) {
        result.innerHTML = `
          <p class="status-badge status-new">No hay registro — primera vez en el sistema</p>
          <form class="form" id="crear-paciente">
            <p class="muted">Cree una ficha mínima para registrar la atención:</p>
            <label>Nombre<input name="nombre" required /></label>
            <label>Edad<input name="edad" type="number" min="0" max="120" required /></label>
            <label>Fecha de nacimiento<input name="fechaNacimiento" type="date" required /></label>
            <input type="hidden" name="cedula" value="${cedula}" />
            <button type="submit" class="btn btn-secondary">Crear ficha y continuar</button>
          </form>
        `;
        result.querySelector("#crear-paciente")?.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const fd = new FormData(ev.target as HTMLFormElement);
          const p = await upsertPacienteMinimo({
            cedula: String(fd.get("cedula")),
            nombre: String(fd.get("nombre")),
            edad: Number(fd.get("edad")),
            fechaNacimiento: String(fd.get("fechaNacimiento")),
          });
          const atenciones = await listAtenciones(p.cedula);
          result.innerHTML = patientCard(p, atenciones);
          result.querySelector("#btn-nueva-atencion")?.addEventListener("click", () => {
            setAtencionCedula(p.cedula);
            navigate("/profesional/atencion");
          });
        });
        return;
      }
      const atenciones = await listAtenciones(paciente.cedula);
      result.innerHTML = patientCard(paciente, atenciones);
      result.querySelector("#btn-nueva-atencion")?.addEventListener("click", () => {
        setAtencionCedula(paciente.cedula);
        navigate("/profesional/atencion");
      });
    } catch (err) {
      result.innerHTML = `<p class="status-badge status-error">${err instanceof Error ? err.message : "Error"}</p>`;
    }
  });
}

registerRoute({
  path: "/profesional",
  title: "Profesional",
  nav: false,
  render: () => {
    const session = getProfessionalSession();
    const el = page(
      session ? `Hola, ${session.nombre.split(" ")[0]}` : "Profesional de salud",
      session
        ? `
        <p class="lead">Busque al paciente por cédula para ver historial o registrar atención.</p>
        <div class="search-row">
          <label class="search-label">Cédula del paciente
            <input id="cedula-buscar" placeholder="Ej. V-12345678" autocomplete="off" />
          </label>
          <button type="button" class="btn btn-primary" id="btn-buscar">Buscar</button>
        </div>
        <div id="resultado"></div>
      `
        : `<p class="lead">Regístrese para buscar pacientes y dejar constancia de atenciones.</p>${loginForm()}`,
      session ? `<button type="button" class="btn btn-ghost btn-sm" id="btn-logout">Salir</button>` : "",
    );
    bindProfesionalPage(el);
    return el;
  },
});

registerRoute({
  path: "/profesional/atencion",
  title: "Nueva atención",
  render: () => {
    const prof = getProfessionalSession();
    const cedula = getAtencionCedula();
    if (!prof || !cedula) {
      const el = page("Atención", `<p>Debe buscar un paciente primero.</p>`);
      bindNavButtons(el);
      return el;
    }

    const el = page(
      "Registrar atención",
      `
      <p class="muted">Paciente C.I. ${cedula}</p>
      <form class="form" id="form-atencion">
        <label>Motivo de consulta<input name="motivo" required placeholder="Ej. Herida en pierna" /></label>
        <label>Notas clínicas<textarea name="notas" rows="4" placeholder="Hallazgos, tratamiento, observaciones…"></textarea></label>
        <label>Diagnóstico (opcional)<input name="diagnostico" /></label>
        <label>Lugar de atención (opcional)<input name="lugar" placeholder="Ej. Punto médico La Guaira" /></label>
        <button type="submit" class="btn btn-primary">Guardar atención</button>
        <button type="button" class="btn btn-ghost" data-nav="/profesional">Cancelar</button>
      </form>
      `,
    );

    el.querySelector("#form-atencion")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      try {
        const paciente = await getPaciente(cedula);
        await createAtencion(prof, {
          patientCedula: cedula,
          patientNombre: paciente?.nombre ?? "Paciente",
          motivo: String(fd.get("motivo")),
          notas: String(fd.get("notas") ?? ""),
          diagnostico: String(fd.get("diagnostico") ?? ""),
          lugarAtencion: String(fd.get("lugar") ?? ""),
        });
        clearAtencionCedula();
        alert("Atención registrada");
        navigate("/profesional");
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });

    bindNavButtons(el);
    return el;
  },
});
