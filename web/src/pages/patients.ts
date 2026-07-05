import { registerRoute } from "../app/router";
import { findPatientByCedula, matchesCedula } from "../services/cedula";
import { loadJson, saveJson } from "../services/local-store";
import type { Patient } from "../shared/models";
import { bindNavButtons, emptyState, page } from "./helpers";

const KEY = "patients";

function loadPatients(): Patient[] {
  return loadJson<Patient[]>(KEY, []);
}

function renderPatientList(patients: Patient[], highlightCedula?: string): string {
  if (patients.length === 0) {
    return `<p class="muted" id="search-feedback">No hay pacientes que coincidan con esa cédula.</p>`;
  }
  const highlight = highlightCedula?.trim();
  return `<ul class="list" id="patient-list">${patients
    .map((p) => {
      const isMatch =
        highlight &&
        findPatientByCedula([p], highlight)?.cedula === p.cedula;
      return `<li class="list-item${isMatch ? " list-item-highlight" : ""}"><strong>${p.nombre}</strong><span>C.I. ${p.cedula} · ${p.edad} años · ${p.sexo || "—"}</span></li>`;
    })
    .join("")}</ul>`;
}

registerRoute({
  path: "/pacientes",
  title: "Pacientes",
  nav: true,
  navLabel: "Paciente",
  render: () => {
    const patients = loadPatients();
    const el = page(
      "Pacientes",
      `
      <div class="search-row">
        <label class="search-label">
          Buscar por cédula
          <input type="text" id="cedula-search" placeholder="Ej. 12.345.678" inputmode="numeric" />
        </label>
        <button type="button" class="btn btn-primary" id="cedula-search-btn">Buscar</button>
      </div>
      <p class="muted" id="search-hint">Escribe la cédula y pulsa Buscar, o deja vacío para ver todos.</p>
      <div id="patient-results">
        ${
          patients.length === 0
            ? emptyState("Aún no tienes pacientes registrados.", "Agregar paciente", "/pacientes/nuevo")
            : renderPatientList(patients)
        }
      </div>
      `,
      `<button type="button" class="btn btn-primary" data-nav="/pacientes/nuevo">Agregar</button>`,
    );

    const input = el.querySelector("#cedula-search") as HTMLInputElement;
    const results = el.querySelector("#patient-results") as HTMLElement;
    const hint = el.querySelector("#search-hint") as HTMLElement;

    function runSearch() {
      const query = input.value.trim();
      const all = loadPatients();
      if (!query) {
        results.innerHTML =
          all.length === 0
            ? emptyState("Aún no tienes pacientes registrados.", "Agregar paciente", "/pacientes/nuevo")
            : renderPatientList(all);
        hint.textContent = "Escribe la cédula y pulsa Buscar, o deja vacío para ver todos.";
        bindNavButtons(results);
        return;
      }
      const exact = findPatientByCedula(all, query);
      const filtered = exact ? [exact] : all.filter((p) => matchesCedula(p.cedula, query));
      results.innerHTML = renderPatientList(filtered, query);
      hint.textContent = exact
        ? `Paciente encontrado: ${exact.nombre}`
        : filtered.length > 0
          ? `${filtered.length} coincidencia(s) parcial(es)`
          : "No se encontró ningún paciente con esa cédula.";
      bindNavButtons(results);
    }

    el.querySelector("#cedula-search-btn")?.addEventListener("click", runSearch);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        runSearch();
      }
    });

    bindNavButtons(el);
    return el;
  },
});

registerRoute({
  path: "/pacientes/nuevo",
  title: "Nuevo paciente",
  render: () => {
    const el = page(
      "Nuevo paciente",
      `
      <form class="form" id="patient-form">
        <label>Nombre<input name="nombre" required /></label>
        <label>Cédula<input name="cedula" required /></label>
        <label>Edad<input name="edad" type="number" min="0" required /></label>
        <label>Sexo<input name="sexo" placeholder="Masculino / Femenino" /></label>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </form>
      `,
    );
    el.querySelector("#patient-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const patient: Patient = {
        id: crypto.randomUUID(),
        nombre: String(fd.get("nombre")),
        cedula: String(fd.get("cedula")),
        edad: Number(fd.get("edad")),
        sexo: String(fd.get("sexo") ?? ""),
        fechaNacimiento: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      const all = loadPatients();
      saveJson(KEY, [patient, ...all]);
      window.location.hash = "/pacientes";
    });
    return el;
  },
});
