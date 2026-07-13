import { registerRoute, navigate } from "../../app/router";
import { confirmPinReset } from "../../services/pin-reset";
import { showErrorDialog } from "../../ui/error-dialog";
import { page } from "../helpers";

registerRoute({
  path: "/restablecer-pin",
  title: "Nuevo PIN",
  render: () => {
    const hash = window.location.hash || "";
    const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
    const token = new URLSearchParams(query).get("token")?.trim() || "";

    const el = page(
      "Crear PIN nuevo",
      token
        ? `
      <p class="lead">Elija un PIN de 4 dígitos para su cuenta.</p>
      <form class="form" id="form-nuevo-pin">
        <label>PIN nuevo (4 dígitos)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required /></label>
        <label>Confirmar PIN<input name="pin2" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required /></label>
        <button type="submit" class="btn btn-primary">Guardar PIN</button>
      </form>
      <div id="reset-msg"></div>
      `
        : `
      <p class="status-badge status-error">Enlace inválido. Solicite uno nuevo desde <a href="#/olvide-pin">Olvidé mi PIN</a>.</p>
      `,
    );

    if (token) {
      el.querySelector("#form-nuevo-pin")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        const pin = String(fd.get("pin"));
        const pin2 = String(fd.get("pin2"));
        const msg = el.querySelector("#reset-msg") as HTMLElement;
        if (pin !== pin2) {
          msg.innerHTML = `<p class="status-badge status-error">Los PIN no coinciden</p>`;
          return;
        }
        try {
          const text = await confirmPinReset(token, pin);
          msg.innerHTML = `<p class="status-badge status-ok">${text}</p>`;
          setTimeout(() => navigate("/paciente"), 2000);
        } catch (err) {
          const text = err instanceof Error ? err.message : "Error";
          msg.innerHTML = `<p class="status-badge status-error">${text}</p>
            <p><button type="button" class="btn btn-ghost btn-sm" id="btn-ver-error-reset">Ver detalle del error</button></p>`;
          msg.querySelector("#btn-ver-error-reset")?.addEventListener("click", () => {
            showErrorDialog(text, err);
          });
          showErrorDialog("No se pudo restablecer el PIN", err);
        }
      });
    }

    return el;
  },
});
