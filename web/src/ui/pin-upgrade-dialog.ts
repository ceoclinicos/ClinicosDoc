import { changePin } from "../services/pin-change";

/**
 * Diálogo para pasar de PIN de 4 a 6 dígitos.
 * @returns true si se actualizó; false si omitió.
 */
export function openPinUpgradeDialog(oldPin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "sheet-dialog";
    dialog.innerHTML = `
      <form method="dialog" class="sheet-body" id="pin-upgrade-form">
        <h2>Actualiza tu PIN</h2>
        <p class="muted">Por seguridad, el PIN ahora debe tener 6 dígitos. Elige uno nuevo.</p>
        <label>Nuevo PIN (6 dígitos)
          <input name="pin" type="password" inputmode="numeric" pattern="\\d{6}" maxlength="6" required autocomplete="new-password" />
        </label>
        <label>Confirmar PIN
          <input name="pin2" type="password" inputmode="numeric" pattern="\\d{6}" maxlength="6" required autocomplete="new-password" />
        </label>
        <p class="muted" id="pin-upgrade-err" style="color:#b91c1c" hidden></p>
        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary" id="pin-upgrade-save">Actualizar</button>
          <button type="button" class="btn btn-ghost" id="pin-upgrade-skip">Más tarde</button>
        </div>
      </form>
    `;
    document.body.appendChild(dialog);
    dialog.showModal();

    const errEl = dialog.querySelector("#pin-upgrade-err") as HTMLElement;
    const form = dialog.querySelector("#pin-upgrade-form") as HTMLFormElement;
    const skip = dialog.querySelector("#pin-upgrade-skip") as HTMLButtonElement;
    const save = dialog.querySelector("#pin-upgrade-save") as HTMLButtonElement;

    const close = (ok: boolean) => {
      dialog.close();
      dialog.remove();
      resolve(ok);
    };

    skip.addEventListener("click", () => close(false));
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close(false);
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const pin = String(fd.get("pin") || "");
      const pin2 = String(fd.get("pin2") || "");
      errEl.hidden = true;
      if (!/^\d{6}$/.test(pin)) {
        errEl.textContent = "El PIN debe tener exactamente 6 dígitos";
        errEl.hidden = false;
        return;
      }
      if (pin !== pin2) {
        errEl.textContent = "Los PIN no coinciden";
        errEl.hidden = false;
        return;
      }
      if (pin === oldPin) {
        errEl.textContent = "Elige un PIN distinto al actual";
        errEl.hidden = false;
        return;
      }
      save.disabled = true;
      try {
        await changePin(oldPin, pin);
        close(true);
      } catch (err) {
        errEl.textContent = err instanceof Error ? err.message : "No se pudo actualizar";
        errEl.hidden = false;
        save.disabled = false;
      }
    });
  });
}
