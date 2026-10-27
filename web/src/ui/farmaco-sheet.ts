import { formatFarmacoCatalogLabel, searchFarmacoCatalog } from "../shared/farmaco-catalog";
import { RECETA_PRESENTACIONES } from "../shared/receta";
import type { RecipePresetFarmaco } from "../shared/recipe-presets";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type Step = "buscar" | "nombre" | "presentacion" | "dosis" | "indicaciones";

/**
 * Panel inferior por pasos: buscar → presentación → dosis → indicaciones.
 */
export function openFarmacoSheet(
  initial?: RecipePresetFarmaco | null,
): Promise<RecipePresetFarmaco | null> {
  return new Promise((resolve) => {
    let step: Step = initial?.principioActivo?.trim() ? "presentacion" : "buscar";
    let search = "";
    let principio = initial?.principioActivo || "";
    let presentacion = initial?.presentacion || RECETA_PRESENTACIONES[0];
    let concentracion = initial?.concentracion || "";
    let disponase = initial?.disponase || "";
    let indicaciones = initial?.indicaciones || "";

    const dlg = document.createElement("dialog");
    dlg.className = "sheet-dialog farmaco-sheet";
    document.body.appendChild(dlg);

    const cleanup = (result: RecipePresetFarmaco | null) => {
      dlg.close();
      dlg.remove();
      resolve(result);
    };

    const titleFor = (): { title: string; sub: string } => {
      switch (step) {
        case "buscar":
          return { title: "Buscar fármaco", sub: "1 de 4 · Elija de la lista o agregue uno nuevo" };
        case "nombre":
          return { title: "Nombre del fármaco", sub: "1 de 4 · Escriba el principio activo" };
        case "presentacion":
          return { title: "Presentación", sub: "2 de 4 · Tabletas, ampollas, jarabe…" };
        case "dosis":
          return { title: "Dosis / concentración", sub: "3 de 4 · Miligramos o cantidad" };
        case "indicaciones":
          return { title: "Indicaciones", sub: "4 de 4 · Cómo tomarlo" };
      }
    };

    const render = () => {
      const { title, sub } = titleFor();
      let body = "";

      if (step === "buscar") {
        const results = searchFarmacoCatalog(search, 200);
        body = `
          <label>Buscar
            <input type="search" id="fs-search" value="${escapeHtml(search)}" placeholder="Ej. amoxicilina, ibuprofeno…" autocomplete="off" />
          </label>
          <button type="button" class="btn btn-secondary btn-block" id="fs-otros">No está en la lista…</button>
          <div class="farmaco-sheet-list" id="fs-list">
            ${
              results.length
                ? results
                    .map(
                      (item, j) => `
              <button type="button" class="farmaco-suggest-item" data-pick="${j}">
                <strong>${escapeHtml(item.principioActivo)}</strong>
                <span class="muted">${escapeHtml(
                  [item.concentracion, item.presentacion].filter(Boolean).join(" · "),
                )}</span>
              </button>`,
                    )
                    .join("")
                : `<p class="farmaco-suggest-empty muted">Sin coincidencias. Use «No está en la lista…».</p>`
            }
          </div>
          <button type="button" class="btn btn-ghost btn-block" id="fs-cancel">Cancelar</button>`;
      } else if (step === "nombre") {
        body = `
          <label>Principio activo
            <input id="fs-principio" value="${escapeHtml(principio)}" placeholder="Ej. Ibuprofeno" />
          </label>
          <div class="dialog-actions">
            <button type="button" class="btn btn-ghost" id="fs-back">Atrás</button>
            <button type="button" class="btn btn-primary" id="fs-next">Siguiente</button>
          </div>`;
      } else if (step === "presentacion") {
        const opts = RECETA_PRESENTACIONES.map(
          (p) =>
            `<option value="${escapeHtml(p)}" ${p === presentacion ? "selected" : ""}>${escapeHtml(p)}</option>`,
        ).join("");
        body = `
          <p><strong>${escapeHtml(principio)}</strong></p>
          <label>Forma farmacéutica
            <select id="fs-presentacion">${opts}</select>
          </label>
          <div class="chip-row" id="fs-chips">
            ${RECETA_PRESENTACIONES.slice(0, 8)
              .map(
                (p) =>
                  `<button type="button" class="chip ${p === presentacion ? "chip-active" : ""}" data-chip="${escapeHtml(p)}">${escapeHtml(p)}</button>`,
              )
              .join("")}
          </div>
          <div class="dialog-actions">
            <button type="button" class="btn btn-ghost" id="fs-back">Atrás</button>
            <button type="button" class="btn btn-primary" id="fs-next">Siguiente</button>
          </div>`;
      } else if (step === "dosis") {
        body = `
          <p class="muted">${escapeHtml(principio)} · ${escapeHtml(presentacion)}</p>
          <label>Dosis / concentración
            <input id="fs-conc" value="${escapeHtml(concentracion)}" placeholder="Ej. 400 mg, 5 ml, 1 g…" />
          </label>
          <label>Cantidad a dispensar <span class="muted">(opcional)</span>
            <input id="fs-disp" value="${escapeHtml(disponase)}" placeholder="Ej. 14 tabletas, 1 frasco" />
          </label>
          <div class="dialog-actions">
            <button type="button" class="btn btn-ghost" id="fs-back">Atrás</button>
            <button type="button" class="btn btn-primary" id="fs-next">Siguiente</button>
          </div>`;
      } else {
        const summary = [principio, concentracion].filter(Boolean).join(" ") + ` (${presentacion})`;
        body = `
          <p class="muted">${escapeHtml(summary)}</p>
          <label>Indicaciones
            <textarea id="fs-ind" rows="4" placeholder="Tomar 1 tableta vía oral cada 8 horas…">${escapeHtml(indicaciones)}</textarea>
          </label>
          <div class="dialog-actions">
            <button type="button" class="btn btn-ghost" id="fs-back">Atrás</button>
            <button type="button" class="btn btn-primary" id="fs-save">Agregar</button>
          </div>`;
      }

      dlg.innerHTML = `
        <div class="sheet-body farmaco-sheet-body">
          <div class="farmaco-sheet-head">
            <div>
              <h2>${escapeHtml(title)}</h2>
              <p class="muted" style="margin:0.25rem 0 0">${escapeHtml(sub)}</p>
            </div>
          </div>
          ${body}
        </div>`;

      const bindBack = (to: Step) => {
        dlg.querySelector("#fs-back")?.addEventListener("click", () => {
          step = to;
          render();
        });
      };

      if (step === "buscar") {
        const input = dlg.querySelector("#fs-search") as HTMLInputElement | null;
        input?.focus();
        input?.addEventListener("input", () => {
          search = input.value;
          const results = searchFarmacoCatalog(search, 200);
          const list = dlg.querySelector("#fs-list");
          if (!list) return;
          list.innerHTML = results.length
            ? results
                .map(
                  (item, j) => `
              <button type="button" class="farmaco-suggest-item" data-pick="${j}">
                <strong>${escapeHtml(item.principioActivo)}</strong>
                <span class="muted">${escapeHtml(
                  [item.concentracion, item.presentacion].filter(Boolean).join(" · "),
                )}</span>
              </button>`,
                )
                .join("")
            : `<p class="farmaco-suggest-empty muted">Sin coincidencias. Use «No está en la lista…».</p>`;
          list.querySelectorAll("[data-pick]").forEach((btn) => {
            btn.addEventListener("click", () => {
              const j = Number(btn.getAttribute("data-pick"));
              const item = searchFarmacoCatalog(search, 200)[j];
              if (!item) return;
              principio = item.principioActivo;
              concentracion = item.concentracion;
              presentacion = item.presentacion || RECETA_PRESENTACIONES[0];
              step = "presentacion";
              render();
            });
          });
        });
        dlg.querySelectorAll("[data-pick]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const j = Number(btn.getAttribute("data-pick"));
            const item = searchFarmacoCatalog(search, 200)[j];
            if (!item) return;
            principio = item.principioActivo;
            concentracion = item.concentracion;
            presentacion = item.presentacion || RECETA_PRESENTACIONES[0];
            step = "presentacion";
            render();
          });
        });
        dlg.querySelector("#fs-otros")?.addEventListener("click", () => {
          principio = search.trim();
          concentracion = "";
          presentacion = RECETA_PRESENTACIONES[0];
          step = "nombre";
          render();
        });
        dlg.querySelector("#fs-cancel")?.addEventListener("click", () => cleanup(null));
      } else if (step === "nombre") {
        bindBack("buscar");
        dlg.querySelector("#fs-next")?.addEventListener("click", () => {
          const v = (dlg.querySelector("#fs-principio") as HTMLInputElement).value.trim();
          if (!v) return;
          principio = v;
          step = "presentacion";
          render();
        });
      } else if (step === "presentacion") {
        bindBack("buscar");
        dlg.querySelectorAll("[data-chip]").forEach((btn) => {
          btn.addEventListener("click", () => {
            presentacion = btn.getAttribute("data-chip") || presentacion;
            const sel = dlg.querySelector("#fs-presentacion") as HTMLSelectElement;
            if (sel) sel.value = presentacion;
            render();
          });
        });
        dlg.querySelector("#fs-next")?.addEventListener("click", () => {
          presentacion =
            (dlg.querySelector("#fs-presentacion") as HTMLSelectElement).value ||
            RECETA_PRESENTACIONES[0];
          step = "dosis";
          render();
        });
      } else if (step === "dosis") {
        bindBack("presentacion");
        dlg.querySelector("#fs-next")?.addEventListener("click", () => {
          concentracion = (dlg.querySelector("#fs-conc") as HTMLInputElement).value.trim();
          disponase = (dlg.querySelector("#fs-disp") as HTMLInputElement).value.trim();
          step = "indicaciones";
          render();
        });
      } else {
        bindBack("dosis");
        dlg.querySelector("#fs-save")?.addEventListener("click", () => {
          indicaciones = (dlg.querySelector("#fs-ind") as HTMLTextAreaElement).value.trim();
          if (!principio.trim()) return;
          cleanup({
            principioActivo: principio.trim(),
            presentacion: presentacion.trim() || RECETA_PRESENTACIONES[0],
            concentracion: concentracion.trim(),
            disponase: disponase.trim(),
            indicaciones,
          });
        });
      }
    };

    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      cleanup(null);
    });
    render();
    dlg.showModal();
  });
}

/** Etiqueta corta para la lista. */
export function farmacoSummaryLine(f: RecipePresetFarmaco): string {
  return formatFarmacoCatalogLabel({
    principioActivo: f.principioActivo,
    concentracion: f.concentracion,
    presentacion: f.presentacion,
  });
}
