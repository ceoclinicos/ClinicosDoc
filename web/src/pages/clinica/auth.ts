import { navigate, registerRoute } from "../../app/router";
import { clearProfessionalSession, clearPatientSession } from "../../registro/session";
import { loginClinic, registerClinic } from "../../clinic/store";
import { getClinicSession, setClinicSession, clearClinicSession } from "../../clinic/session";
import { bindNavButtons, page } from "../helpers";

function tabs(active: "login" | "registro"): string {
  return `
    <div class="tab-row">
      <button type="button" class="tab ${active === "login" ? "active" : ""}" data-tab="login">Ingresar</button>
      <button type="button" class="tab ${active === "registro" ? "active" : ""}" data-tab="registro">Registrar centro</button>
    </div>
  `;
}

function loginForm(): string {
  return `
    ${tabs("login")}
    <form class="form" id="clinic-login">
      <label>RIF o código del centro<input name="rif" required autocomplete="username" placeholder="Ej. J123456789" /></label>
      <label>PIN (4 dígitos)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required autocomplete="current-password" /></label>
      <p class="muted"><a href="#/olvide-pin?tipo=clinica">Olvidé mi PIN</a></p>
      <button type="submit" class="btn btn-primary">Ingresar al centro</button>
    </form>
  `;
}

function registerForm(): string {
  return `
    ${tabs("registro")}
    <form class="form" id="clinic-registro">
      <label>Nombre del centro / clínica<input name="nombre" required placeholder="Ej. Day Hospital" /></label>
      <label>RIF o código único<input name="rif" required placeholder="Ej. J123456789" /></label>
      <label>Correo administrativo<input name="correo" type="email" required /></label>
      <label>Dirección (opcional)<input name="direccion" placeholder="Ciudad, sede…" /></label>
      <label>PIN (4 dígitos)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required /></label>
      <button type="submit" class="btn btn-primary">Crear cuenta de centro</button>
    </form>
  `;
}

registerRoute({
  path: "/clinica",
  title: "Modo empresa",
  render: () => {
    const session = getClinicSession();
    if (session) {
      navigate("/clinica/panel");
      return page("Centro de salud", `<p class="muted">Abriendo panel…</p>`);
    }

    const el = page(
      "Modo empresa / centro de salud",
      `
      <p class="lead">Panel del centro: pacientes atendidos por médicos vinculados, plantillas institucionales y encabezados.</p>
      <div id="clinic-auth-body">${loginForm()}</div>
      <p class="muted" style="margin-top:1rem"><a href="#/">← Volver al inicio</a></p>
      `,
    );

    const body = el.querySelector("#clinic-auth-body") as HTMLElement;

    function bindTabs(): void {
      body.querySelectorAll("[data-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const tab = btn.getAttribute("data-tab");
          body.innerHTML = tab === "registro" ? registerForm() : loginForm();
          bindForms();
          bindTabs();
        });
      });
    }

    function bindForms(): void {
      body.querySelector("#clinic-login")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        const btn = (e.target as HTMLFormElement).querySelector("button[type=submit]") as HTMLButtonElement;
        btn.disabled = true;
        try {
          clearProfessionalSession();
          clearPatientSession();
          const s = await loginClinic(String(fd.get("rif")), String(fd.get("pin")));
          setClinicSession(s);
          navigate("/clinica/panel");
        } catch (err) {
          alert(err instanceof Error ? err.message : "No se pudo ingresar");
          btn.disabled = false;
        }
      });

      body.querySelector("#clinic-registro")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        const btn = (e.target as HTMLFormElement).querySelector("button[type=submit]") as HTMLButtonElement;
        btn.disabled = true;
        try {
          clearProfessionalSession();
          clearPatientSession();
          const s = await registerClinic({
            nombre: String(fd.get("nombre")),
            rif: String(fd.get("rif")),
            correo: String(fd.get("correo")),
            direccion: String(fd.get("direccion") || ""),
            pin: String(fd.get("pin")),
          });
          setClinicSession(s);
          navigate("/clinica/panel");
        } catch (err) {
          alert(err instanceof Error ? err.message : "No se pudo registrar");
          btn.disabled = false;
        }
      });
    }

    bindForms();
    bindTabs();
    bindNavButtons(el);
    return el;
  },
});

registerRoute({
  path: "/clinica/salir",
  title: "Salir",
  clinicOnly: true,
  render: () => {
    clearClinicSession();
    navigate("/");
    return page("Salir", `<p class="muted">Cerrando sesión…</p>`);
  },
});
