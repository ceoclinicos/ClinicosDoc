import { registerRoute, navigate } from "../app/router";
import { getProfessionalSession } from "../registro/session";
import {
  defaultHeader,
  saveDocument,
  templateForType,
} from "../services/clinical-store";
import { buildMembreteFromPatient } from "../services/document-pdf";
import { loadJson } from "../services/local-store";
import {
  deleteRecipePreset,
  getRecipePreset,
  loadRecipePresets,
  upsertRecipePreset,
} from "../services/recipe-presets-store";
import type { Patient } from "../shared/models";
import {
  buildRecipePresetContent,
  previewRecipeText,
  type RecipePreset,
  type RecipePresetFarmaco,
} from "../shared/recipe-presets";
import { findPatientByCedula, matchesCedula, normalizeCedula } from "../services/cedula";
import { bindNavButtons, emptyState, page } from "./helpers";
import { farmacoSummaryLine, openFarmacoSheet } from "../ui/farmaco-sheet";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function loadPatients(): Patient[] {
  return loadJson<Patient[]>("patients", []);
}

registerRoute({
  path: "/recipes",
  title: "Recipes",
  nav: true,
  navLabel: "Recipes",
  medicoOnly: true,
  render: () => {
    const presets = loadRecipePresets();
    const el = page(
      "Recipes",
      `
      <p class="lead">Recetas predeterminadas. Créelas una vez y asígnelas a un paciente en un toque.</p>
      <button type="button" class="btn btn-primary" data-nav="/recipes/nueva">+ Nueva recipe</button>
      <div id="recipes-list" style="margin-top:1rem">
        ${
          presets.length
            ? `<ul class="list">${presets
                .map(
                  (r) => `
            <li class="list-item">
              <div>
                <strong>${escapeHtml(r.name)}</strong>
                <span class="muted">${r.farmacos.length} fármaco(s)</span>
              </div>
              <div class="list-item-actions">
                <button type="button" class="btn btn-primary btn-sm" data-use="${escapeHtml(r.id)}">Usar</button>
                <button type="button" class="btn btn-ghost btn-sm" data-edit="${escapeHtml(r.id)}">Editar</button>
                <button type="button" class="btn btn-ghost btn-sm" data-del="${escapeHtml(r.id)}" data-name="${escapeHtml(r.name)}">Eliminar</button>
              </div>
            </li>`,
                )
                .join("")}</ul>`
            : emptyState("Aún no tiene recipes guardadas.", "Crear la primera", "/recipes/nueva")
        }
      </div>
      `,
    );

    el.querySelectorAll("[data-use]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-use") || "";
        if (id) navigate(`/recipes/usar/${encodeURIComponent(id)}`);
      });
    });
    el.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit") || "";
        if (id) navigate(`/recipes/editar/${encodeURIComponent(id)}`);
      });
    });
    el.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del") || "";
        const name = btn.getAttribute("data-name") || "esta recipe";
        if (!id || !confirm(`¿Eliminar «${name}»?`)) return;
        deleteRecipePreset(id);
        navigate("/recipes");
      });
    });

    bindNavButtons(el);
    return el;
  },
});

function renderEditPage(preset: RecipePreset | null): HTMLElement {
  let farmacos: RecipePresetFarmaco[] = preset ? [...preset.farmacos] : [];

  const el = page(
    preset ? "Editar recipe" : "Nueva recipe",
    `
    <p class="muted"><a href="#/recipes">← Recipes</a></p>
    <form class="form" id="recipe-form">
      <label>Nombre de la recipe
        <input name="name" required maxlength="80" placeholder="Ej. Respiratorias, Analgésicos" value="${escapeHtml(preset?.name || "")}" />
      </label>
      <p class="muted">Toque «Agregar fármaco» para buscarlo y completar presentación, dosis e indicaciones.</p>
      <div id="farmacos-box"></div>
      <button type="button" class="btn btn-secondary" id="btn-add-farmaco">+ Agregar fármaco</button>
      <div class="dialog-actions" style="margin-top:1rem">
        <button type="button" class="btn btn-ghost" data-nav="/recipes">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>
    `,
  );

  const box = el.querySelector("#farmacos-box") as HTMLElement;

  function renderFarmacos(): void {
    if (!farmacos.length) {
      box.innerHTML = `<p class="muted">Aún no agregó fármacos.</p>`;
      return;
    }
    box.innerHTML = `<ul class="list">${farmacos
      .map(
        (f, i) => `
      <li class="list-item card-panel" style="flex-direction:column;align-items:stretch;gap:0.35rem">
        <strong>${escapeHtml(farmacoSummaryLine(f))}</strong>
        ${f.disponase.trim() ? `<span class="muted">Dispóngase: ${escapeHtml(f.disponase)}</span>` : ""}
        ${f.indicaciones.trim() ? `<span class="muted">${escapeHtml(f.indicaciones)}</span>` : ""}
        <div class="list-item-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-edit-f="${i}">Editar</button>
          <button type="button" class="btn btn-ghost btn-sm" data-rm="${i}">Quitar</button>
        </div>
      </li>`,
      )
      .join("")}</ul>`;

    box.querySelectorAll("[data-rm]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-rm"));
        farmacos = farmacos.filter((_, j) => j !== idx);
        renderFarmacos();
      });
    });
    box.querySelectorAll("[data-edit-f]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const idx = Number(btn.getAttribute("data-edit-f"));
        const current = farmacos[idx];
        if (!current) return;
        const updated = await openFarmacoSheet(current);
        if (!updated) return;
        farmacos = farmacos.map((f, j) => (j === idx ? updated : f));
        renderFarmacos();
      });
    });
  }

  el.querySelector("#btn-add-farmaco")?.addEventListener("click", async () => {
    const added = await openFarmacoSheet(null);
    if (!added) return;
    farmacos = [...farmacos, added];
    renderFarmacos();
  });

  el.querySelector("#recipe-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      upsertRecipePreset({
        id: preset?.id,
        name: String(fd.get("name") || ""),
        farmacos,
      });
      navigate("/recipes");
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar");
    }
  });

  renderFarmacos();
  bindNavButtons(el);
  return el;
}

registerRoute({
  path: "/recipes/nueva",
  title: "Nueva recipe",
  medicoOnly: true,
  render: () => renderEditPage(null),
});

registerRoute({
  path: "/recipes/editar/:id",
  title: "Editar recipe",
  medicoOnly: true,
  render: () => {
    const id = decodeURIComponent(
      (window.location.hash.replace(/^#\/recipes\/editar\//, "").split("?")[0] || "").trim(),
    );
    const preset = getRecipePreset(id);
    if (!preset) {
      navigate("/recipes");
      return page("Recipe", `<p class="muted">No encontrada.</p>`);
    }
    return renderEditPage(preset);
  },
});

registerRoute({
  path: "/recipes/usar/:id",
  title: "Usar recipe",
  medicoOnly: true,
  render: () => {
    const id = decodeURIComponent(
      (window.location.hash.replace(/^#\/recipes\/usar\//, "").split("?")[0] || "").trim(),
    );
    const preset = getRecipePreset(id);
    if (!preset) {
      navigate("/recipes");
      return page("Recipe", `<p class="muted">No encontrada.</p>`);
    }

    let selected: Patient | null = null;
    const patients = loadPatients();
    const session = getProfessionalSession();

    const el = page(
      preset.name,
      `
      <p class="muted"><a href="#/recipes">← Recipes</a></p>
      <div class="card-panel">
        <h2 class="home-section-title" style="margin-top:0">Vista previa</h2>
        <pre class="recipe-preview">${escapeHtml(previewRecipeText(preset))}</pre>
      </div>
      <div class="card-panel" id="patient-step">
        <h2 class="home-section-title" style="margin-top:0">Paciente</h2>
        <p id="patient-chosen" class="muted">Ninguno seleccionado.</p>
        <label>Buscar por cédula o nombre
          <input type="search" id="patient-q" placeholder="Cédula o nombre" autocomplete="off" />
        </label>
        <ul class="list" id="patient-pick-list"></ul>
        <button type="button" class="btn btn-secondary" data-nav="/pacientes/nuevo">+ Agregar paciente</button>
      </div>
      <button type="button" class="btn btn-primary btn-block" id="btn-emit" disabled>Emitir receta</button>
      `,
    );

    const chosenEl = el.querySelector("#patient-chosen") as HTMLElement;
    const listEl = el.querySelector("#patient-pick-list") as HTMLElement;
    const qEl = el.querySelector("#patient-q") as HTMLInputElement;
    const btnEmit = el.querySelector("#btn-emit") as HTMLButtonElement;

    function setPatient(p: Patient | null): void {
      selected = p;
      if (p) {
        chosenEl.innerHTML = `<strong>${escapeHtml(p.nombre)}</strong> · C.I. ${escapeHtml(p.cedula)}`;
        btnEmit.disabled = false;
      } else {
        chosenEl.textContent = "Ninguno seleccionado.";
        btnEmit.disabled = true;
      }
    }

    function renderPickList(): void {
      const q = qEl.value.trim().toLowerCase();
      const filtered = !q
        ? patients.slice(0, 20)
        : patients.filter(
            (p) =>
              matchesCedula(p.cedula, q) ||
              p.nombre.toLowerCase().includes(q) ||
              normalizeCedula(p.cedula).includes(normalizeCedula(q)),
          ).slice(0, 30);
      if (!filtered.length) {
        listEl.innerHTML = `<li class="muted">Sin coincidencias. Agregue el paciente.</li>`;
        return;
      }
      listEl.innerHTML = filtered
        .map(
          (p) => `
        <li class="list-item list-item-action" data-pid="${escapeHtml(p.id)}">
          <div>
            <strong>${escapeHtml(p.nombre)}</strong>
            <span class="muted">C.I. ${escapeHtml(p.cedula)}</span>
          </div>
        </li>`,
        )
        .join("");
      listEl.querySelectorAll("[data-pid]").forEach((node) => {
        node.addEventListener("click", () => {
          const pid = node.getAttribute("data-pid") || "";
          const p = patients.find((x) => x.id === pid) || null;
          setPatient(p);
        });
      });
    }

    qEl.addEventListener("input", () => {
      const q = qEl.value.trim();
      if (/^\d{6,}/.test(q.replace(/\D/g, "")) || /^[veEV]-?\d/.test(q)) {
        const found = findPatientByCedula(patients, q);
        if (found) setPatient(found);
      }
      renderPickList();
    });

    btnEmit.addEventListener("click", () => {
      if (!selected) return;
      const header = defaultHeader();
      const tpl = templateForType("receta");
      const content = buildRecipePresetContent(preset.farmacos);
      const doc = saveDocument({
        id: crypto.randomUUID(),
        patientId: selected.id,
        patientNombre: selected.nombre,
        patientCedula: selected.cedula,
        type: "receta",
        content,
        rawDictation: `Recipe predeterminada: ${preset.name}`,
        createdAt: new Date().toISOString(),
        templateId: tpl.id,
        templateName: preset.name,
        headerId: header?.id,
        headerSnapshot: header ? { ...header } : undefined,
        membrete: buildMembreteFromPatient(selected),
        doctorNombre: session?.nombre,
      });
      navigate(`/informes/${doc.id}`);
    });

    renderPickList();
    bindNavButtons(el);
    return el;
  },
});
