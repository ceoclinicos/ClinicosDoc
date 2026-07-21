import { RECETA_PRESENTACIONES } from "../shared/receta";

export interface FarmacoDialogResult {
  principioActivo: string;
  presentacion: string;
  concentracion: string;
}

/** Modal para agregar fármaco (paridad con diálogo Android). */
export function openFarmacoDialog(): Promise<FarmacoDialogResult | null> {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "farmaco-dialog";
    const options = RECETA_PRESENTACIONES.map(
      (p) => `<option value="${p.replace(/"/g, "&quot;")}">${p}</option>`,
    ).join("");
    dlg.innerHTML = `
      <form method="dialog" class="form" id="farmaco-form" style="min-width:min(92vw,380px)">
        <h2>Agregar fármaco</h2>
        <label>Principio activo
          <input name="principio" required autofocus placeholder="Ej. Amoxicilina" />
        </label>
        <label>Presentación
          <select name="presentacion" required>${options}</select>
        </label>
        <label>Concentración <span class="muted">(opcional)</span>
          <input name="concentracion" placeholder="Ej. 875 mg / 125 mg" />
        </label>
        <div class="dialog-actions">
          <button type="submit" class="btn btn-primary">Agregar</button>
          <button type="button" class="btn btn-ghost" id="farmaco-cancel">Cancelar</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);

    const cleanup = (result: FarmacoDialogResult | null) => {
      dlg.close();
      dlg.remove();
      resolve(result);
    };

    dlg.querySelector("#farmaco-cancel")?.addEventListener("click", () => cleanup(null));
    dlg.querySelector("#farmaco-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const principio = String(fd.get("principio") ?? "").trim();
      if (!principio) return;
      cleanup({
        principioActivo: principio,
        presentacion: String(fd.get("presentacion") ?? "Tabletas").trim(),
        concentracion: String(fd.get("concentracion") ?? "").trim(),
      });
    });
    dlg.addEventListener("cancel", () => cleanup(null));
    dlg.showModal();
  });
}
