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
      <p class="lead" id="olvide-lead">Ingrese su cédula. Si tiene correo registrado, le enviaremos un enlace para restablecer su PIN.</p>
      <form class="form" id="form-olvide-pin">
        <label>Tipo de cuenta
          <select name="tipo" id="tipo-cuenta">
            <option value="paciente" ${tipoPref === "paciente" ? "selected" : ""}>Paciente</option>
            <option value="profesional" ${tipoPref === "profesional" || tipoPref === "medico" ? "selected" : ""}>Médico (web)</option>
            <option value="app" ${tipoPref === "app" ? "selected" : ""}>Médico (app Android)</option>
            <option value="clinica" ${tipoPref === "clinica" || tipoPref === "centro" ? "selected" : ""}>Centro de salud / clínica</option>
          </select>
        </label>
        <label id="id-label">Cédula<input name="cedula" id="id-input" required placeholder="Ej. 23536843" /></label>
        <button type="submit" class="btn btn-primary">Enviar enlace</button>
      </form>
      <p class="muted">
        <a href="#/paciente">Portal paciente</a> ·
        <a href="#/profesional">Portal médico</a> ·
        <a href="#/clinica">Modo empresa</a>
      </p>
      <div id="olvide-msg"></div>
      `,
    );

    const tipoSelect = el.querySelector("#tipo-cuenta") as HTMLSelectElement;
    const idLabel = el.querySelector("#id-label") as HTMLElement;
    const lead = el.querySelector("#olvide-lead") as HTMLElement;

    function syncTipoUi(): void {
      const isClinic = tipoSelect.value === "clinica";
      if (isClinic) {
        lead.textContent =
          "Ingrese el RIF del centro. Si tiene correo administrativo, le enviaremos un enlace para restablecer el PIN.";
        idLabel.innerHTML =
          'RIF o código del centro<input name="cedula" id="id-input" required placeholder="Ej. J123456789" />';
      } else {
        lead.textContent =
          "Ingrese su cédula. Si tiene correo registrado, le enviaremos un enlace para restablecer su PIN.";
        idLabel.innerHTML =
          'Cédula<input name="cedula" id="id-input" required placeholder="Ej. 23536843" inputmode="numeric" />';
      }
    }

    tipoSelect.addEventListener("change", syncTipoUi);
    syncTipoUi();

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
        tipoSelect.value = tipoPref === "clinica" ? "clinica" : tipoSelect.value;
        syncTipoUi();
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
