/** Sello médico del doctor: una imagen global, separada de los encabezados (paridad SelloScreen app). */
import { registerRoute } from "../../app/router";
import {
  clearSello,
  loadSello,
  saveSello,
  selloDataUrl,
  SELLO_MIN_SIDE,
} from "../../services/sello-store";
import { bindNavButtons, page } from "../helpers";

registerRoute({
  path: "/plantillas/sello",
  title: "Sello médico",
  medicoOnly: true,
  render: () => {
    const el = page(
      "Sello médico",
      `
      <p class="lead">Una sola imagen para todos tus informes e historias. En cada documento decides con un check si aparece.</p>
      <div class="card-panel stack" id="sello-box">
        <div id="sello-preview" class="sello-preview" hidden></div>
        <p class="muted" id="sello-empty">Aún no has subido un sello.</p>
        <label class="btn btn-secondary sello-file-btn" for="sello-input" id="sello-input-label">Subir foto del sello</label>
        <input type="file" id="sello-input" accept="image/*" hidden />
        <button type="button" class="btn btn-ghost" id="sello-remove" hidden>Quitar sello</button>
        <p class="muted">Cuadrado, se imprime centrado al final del documento (≈ 1/5 del ancho de la hoja). Mínimo ${SELLO_MIN_SIDE} px.</p>
      </div>
      <button type="button" class="btn btn-ghost" data-nav="/plantillas">Volver</button>
      `,
    );

    const preview = el.querySelector("#sello-preview") as HTMLElement;
    const emptyMsg = el.querySelector("#sello-empty") as HTMLElement;
    const input = el.querySelector("#sello-input") as HTMLInputElement;
    const inputLabel = el.querySelector("#sello-input-label") as HTMLElement;
    const btnRemove = el.querySelector("#sello-remove") as HTMLButtonElement;

    function refresh(): void {
      const sello = loadSello();
      const src = selloDataUrl(sello?.base64);
      if (src) {
        preview.innerHTML = `<img src="${src}" alt="Sello médico" />`;
        preview.hidden = false;
        emptyMsg.hidden = true;
        inputLabel.textContent = "Cambiar sello";
        btnRemove.hidden = false;
      } else {
        preview.innerHTML = "";
        preview.hidden = true;
        emptyMsg.hidden = false;
        inputLabel.textContent = "Subir foto del sello";
        btnRemove.hidden = true;
      }
    }

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      try {
        await saveSello(file);
        refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo procesar la imagen");
      }
    });

    btnRemove.addEventListener("click", () => {
      if (!confirm("¿Quitar el sello médico? Los documentos ya guardados conservan su copia.")) return;
      clearSello();
      refresh();
    });

    refresh();
    bindNavButtons(el);
    return el;
  },
});
