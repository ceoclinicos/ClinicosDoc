import { registerRoute } from "../../app/router";
import { requestPinReset } from "../../services/pin-reset";
import { showErrorDialog } from "../../ui/error-dialog";
import { page } from "../helpers";

registerRoute({
  path: "/olvide-pin",
  title: "Olvidé mi PIN",
  render: () => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const tipoPref = params.get("tipo") || "paciente";

    const el = page(
      "Recuperar acceso",
      `
      <p class="lead">Ingrese su cédula. Si tiene correo registrado, le enviaremos un enlace.</p>
      <form class="form" id="form-olvide-pin">
        <label>Tipo de cuenta
          <select name="tipo">
            <option value="paciente" ${tipoPref === "paciente" ? "selected" : ""}>Paciente</option>
            <option value="profesional" ${tipoPref === "profesional" || tipoPref === "medico" ? "selected" : ""}>Médico (web)</option>
            <option value="app" ${tipoPref === "app" ? "selected" : ""}>Médico (app Android)</option>
          </select>
        </label>
        <label>Cédula<input name="cedula" required placeholder="Ej. 23536843" inputmode="numeric" /></label>
        <button type="submit" class="btn btn-primary">Enviar enlace</button>
      </form>
      <p class="muted">
        <a href="#/paciente">Portal paciente</a> ·
        <a href="#/profesional">Portal médico</a>
      </p>
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
        const text = await requestPinReset(String(fd.get("cedula")), String(fd.get("tipo") || "paciente"));
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
