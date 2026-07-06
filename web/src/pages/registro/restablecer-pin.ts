import { registerRoute, navigate } from "../../app/router";
import { confirmPinReset } from "../../services/pin-reset";
import { page } from "../helpers";

registerRoute({
  path: "/restablecer-pin",
  title: "Nuevo PIN",
  render: () => {
    const token = new URLSearchParams(window.location.hash.split("?")[1] || "").get("token") || "";

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
          msg.innerHTML = `<p class="status-badge status-error">${err instanceof Error ? err.message : "Error"}</p>`;
        }
      });
    }

    return el;
  },
});
