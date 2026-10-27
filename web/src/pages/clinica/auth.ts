import { navigate, registerRoute } from "../../app/router";
import { clearProfessionalSession, clearPatientSession } from "../../registro/session";
import { loginClinic, registerClinic } from "../../clinic/store";
import { getClinicSession, setClinicSession, clearClinicSession } from "../../clinic/session";
import { bindNavButtons, page } from "../helpers";
import { passwordFieldHtml, readPasswordFromForm } from "../../ui/password-picker";

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
      <label>Nombre de la cuenta<input name="accountName" required autocomplete="username" pattern="[A-Za-z0-9._-]{4,32}" maxlength="32" placeholder="Ej. ceosalud" /></label>
      ${passwordFieldHtml({ allowLegacy: true })}
      <p class="muted">El nombre de la cuenta va pegado, sin espacios. <a href="#/olvide-pin?tipo=clinica">Olvidé mi PIN</a></p>
      <button type="submit" class="btn btn-primary">Ingresar al centro</button>
    </form>
  `;
}

function registerForm(): string {
  return `
    ${tabs("registro")}
    <form class="form" id="clinic-registro">
      <label>Nombre del centro / clínica<input name="nombre" required placeholder="Ej. Day Hospital" /></label>
      <label>Nombre de la cuenta<input name="accountName" required autocomplete="username" pattern="[A-Za-z0-9._-]{4,32}" maxlength="32" placeholder="Ej. ceosalud" /></label>
      <label>RIF (solo letras y números)<input name="rif" required pattern="[A-Za-z0-9]{5,12}" maxlength="12" placeholder="Ej. J123456789" style="text-transform:uppercase" /></label>
      <label>Correo administrativo<input name="correo" type="email" required /></label>
      <label>Dirección (opcional)<input name="direccion" placeholder="Ciudad, sede…" /></label>
      ${passwordFieldHtml()}
      <p class="muted">La contraseña es una letra que elija + 6 dígitos (ej. A123456).</p>
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

    function sanitizeAccountName(value: string): string {
      return value.replace(/\s+/g, "");
    }

    function sanitizeRif(value: string): string {
      return value.replace(/[^a-zA-Z0-9]+/g, "").toUpperCase();
    }

    function bindAccountNameInputs(): void {
      body.querySelectorAll<HTMLInputElement>('input[name="accountName"]').forEach((input) => {
        input.addEventListener("input", () => {
          const next = sanitizeAccountName(input.value);
          if (next !== input.value) input.value = next;
        });
      });
      body.querySelectorAll<HTMLInputElement>('input[name="rif"]').forEach((input) => {
        input.addEventListener("input", () => {
          const next = sanitizeRif(input.value);
          if (next !== input.value) input.value = next;
        });
      });
    }

    function bindTabs(): void {
      body.querySelectorAll("[data-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const tab = btn.getAttribute("data-tab");
          body.innerHTML = tab === "registro" ? registerForm() : loginForm();
          bindAccountNameInputs();
          bindForms();
          bindTabs();
        });
      });
    }

    function bindForms(): void {
      body.querySelector("#clinic-login")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const accountNameInput = form.elements.namedItem("accountName") as HTMLInputElement | null;
        if (accountNameInput) accountNameInput.value = sanitizeAccountName(accountNameInput.value);
        const rifInput = form.elements.namedItem("rif") as HTMLInputElement | null;
        if (rifInput) rifInput.value = sanitizeRif(rifInput.value);
        const fd = new FormData(form);
        const btn = (e.target as HTMLFormElement).querySelector("button[type=submit]") as HTMLButtonElement;
        btn.disabled = true;
        try {
          clearProfessionalSession(false);
          clearPatientSession(false);
          const s = await loginClinic(String(fd.get("accountName")), readPasswordFromForm(fd));
          setClinicSession(s);
          navigate("/clinica/panel");
        } catch (err) {
          alert(err instanceof Error ? err.message : "No se pudo ingresar");
          btn.disabled = false;
        }
      });

      body.querySelector("#clinic-registro")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const accountNameInput = form.elements.namedItem("accountName") as HTMLInputElement | null;
        if (accountNameInput) accountNameInput.value = sanitizeAccountName(accountNameInput.value);
        const rifInput = form.elements.namedItem("rif") as HTMLInputElement | null;
        if (rifInput) rifInput.value = sanitizeRif(rifInput.value);
        const fd = new FormData(form);
        const btn = (e.target as HTMLFormElement).querySelector("button[type=submit]") as HTMLButtonElement;
        btn.disabled = true;
        try {
          clearProfessionalSession(false);
          clearPatientSession(false);
          const s = await registerClinic({
            nombre: String(fd.get("nombre")),
            accountName: String(fd.get("accountName")),
            rif: String(fd.get("rif")),
            correo: String(fd.get("correo")),
            direccion: String(fd.get("direccion") || ""),
            pin: readPasswordFromForm(fd),
          });
          setClinicSession(s);
          navigate("/clinica/panel");
        } catch (err) {
          alert(err instanceof Error ? err.message : "No se pudo registrar");
          btn.disabled = false;
        }
      });
    }

    bindAccountNameInputs();
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
