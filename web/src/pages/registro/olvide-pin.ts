import { registerRoute } from "../../app/router";
import { requestPinReset } from "../../services/pin-reset";
import { composeCedula } from "../../services/cedula";
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
        <div id="id-field-wrap"></div>
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
    const idWrap = el.querySelector("#id-field-wrap") as HTMLElement;
    const lead = el.querySelector("#olvide-lead") as HTMLElement;

    function syncTipoUi(): void {
      const isClinic = tipoSelect.value === "clinica";
      if (isClinic) {
        lead.textContent =
          "Ingrese el RIF del centro. Si tiene correo administrativo, le enviaremos un enlace para restablecer el PIN.";
        idWrap.innerHTML =
          '<label>RIF o código del centro<input name="cedula" id="id-input" required placeholder="Ej. J123456789" /></label>';
      } else {
        lead.textContent =
          "Ingrese su cédula. Si tiene correo registrado, le enviaremos un enlace para restablecer su PIN.";
        idWrap.innerHTML = `
          <label>Cédula
            <span class="cedula-field">
              <select name="cedulaLetter" aria-label="Tipo de cédula (V o E)">
                <option value="V" selected>V</option>
                <option value="E">E</option>
              </select>
              <input name="cedula" id="id-input" required inputmode="numeric" pattern="[0-9]{6,9}" minlength="6" maxlength="9" placeholder="Solo números" />
            </span>
          </label>`;
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
        const tipo = String(fd.get("tipo") || "paciente");
        const id =
          tipo === "clinica"
            ? String(fd.get("cedula") || "")
            : composeCedula(String(fd.get("cedulaLetter") || "V"), String(fd.get("cedula") || ""));
        const text = await requestPinReset(id, tipo);
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
