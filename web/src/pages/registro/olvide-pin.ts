import { registerRoute } from "../../app/router";
import { requestPinReset } from "../../services/pin-reset";
import { showErrorDialog } from "../../ui/error-dialog";
import { page } from "../helpers";

registerRoute({
  path: "/olvide-pin",
  title: "Olvidé mi PIN",
  render: () => {
    const el = page(
      "Olvidé mi PIN",
      `
      <p class="lead">Ingrese su cédula. Si está registrado, enviaremos un enlace a su correo.</p>
      <form class="form" id="form-olvide-pin">
        <label>Cédula<input name="cedula" required placeholder="Ej. 23536843" inputmode="numeric" /></label>
        <button type="submit" class="btn btn-primary">Enviar enlace</button>
      </form>
      <p class="muted"><a href="#/paciente">← Volver al portal paciente</a></p>
      <div id="olvide-msg"></div>
      `,
    );

    el.querySelector("#form-olvide-pin")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const btn = (e.target as HTMLFormElement).querySelector('[type="submit"]') as HTMLButtonElement;
      const msg = el.querySelector("#olvide-msg") as HTMLElement;
      btn.disabled = true;
      msg.innerHTML = `<p class="muted">Enviando…</p>`;
      try {
        const text = await requestPinReset(String(fd.get("cedula")));
        msg.innerHTML = `<p class="status-badge status-ok">${text}</p>`;
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        const text = err instanceof Error ? err.message : "Error";
        msg.innerHTML = `<p class="status-badge status-error">${text}</p>
          <p><button type="button" class="btn btn-ghost btn-sm" id="btn-ver-error">Ver detalle del error</button></p>`;
        msg.querySelector("#btn-ver-error")?.addEventListener("click", () => {
          showErrorDialog(text, err);
        });
        showErrorDialog("No se pudo enviar el correo", err);
      } finally {
        btn.disabled = false;
      }
    });

    return el;
  },
});
