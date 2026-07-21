import { registerRoute, navigate } from "../app/router";
import {
  bindBirthDateSelects,
  birthDateFieldsHtml,
  parseBirthFromForm,
  sexOptionsHtml,
} from "../services/birth-date";
import { findPatientByCedula, matchesCedula, normalizeCedula } from "../services/cedula";
import { getFichaByCedula, renderFichaHtml } from "../services/emergency-ficha";
import { loadJson, saveJson } from "../services/local-store";
import { canSync, findGlobalByCedula, pushPatient, syncQuiet } from "../services/cloud-sync";
import { getPaciente } from "../registro/store";
import type { Patient } from "../shared/models";
import { bindNavButtons, emptyState, page } from "./helpers";

const KEY = "patients";

function loadPatients(): Patient[] {
  return loadJson<Patient[]>(KEY, []);
}

function formatNac(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString("es-VE");
  } catch {
    return iso.slice(0, 10);
  }
}

function upsertLocalPatient(patient: Patient): Patient {
  const all = loadPatients();
  const idx = all.findIndex(
    (p) => p.id === patient.id || normalizeCedula(p.cedula) === normalizeCedula(patient.cedula),
  );
  let saved = patient;
  if (idx >= 0) {
    saved = { ...patient, id: all[idx].id };
    all[idx] = saved;
  } else {
    all.unshift(patient);
  }
  saveJson(KEY, all);
  if (canSync()) syncQuiet(() => pushPatient(saved));
  return saved;
}

async function findPortalPatient(cedula: string): Promise<Patient | null> {
  try {
    const reg = await getPaciente(cedula);
    if (!reg) return null;
    return {
      id: `portal_${normalizeCedula(reg.cedula)}`,
      nombre: reg.nombre,
      cedula: reg.cedula,
      edad: Number(reg.edad) || 0,
      sexo: reg.sexo || "",
      fechaNacimiento: reg.fechaNacimiento || "",
      createdAt: reg.createdAt || new Date().toISOString(),
      whatsapp: reg.telefono || undefined,
    };
  } catch {
    return null;
  }
}

function renderPatientList(patients: Patient[], highlightCedula?: string): string {
  if (patients.length === 0) {
    return `<p class="muted" id="search-feedback">No hay pacientes que coincidan con esa cédula.</p>`;
  }
  const highlight = highlightCedula?.trim();
  return `<ul class="list" id="patient-list">${patients
    .map((p) => {
      const isMatch =
        highlight && findPatientByCedula([p], highlight)?.cedula === p.cedula;
      return `<li class="list-item list-item-action${isMatch ? " list-item-highlight" : ""}" data-cedula="${escapeAttr(p.cedula)}" role="button" tabindex="0">
        <strong>${escapeHtml(p.nombre)}</strong>
        <span>C.I. ${escapeHtml(p.cedula)} · ${p.edad} años · ${escapeHtml(p.sexo || "—")} · Nac. ${escapeHtml(formatNac(p.fechaNacimiento))}</span>
        <span class="muted">Tocar para ficha de emergencia</span>
      </li>`;
    })
    .join("")}</ul>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

registerRoute({
  path: "/pacientes",
  title: "Pacientes",
  nav: true,
  navLabel: "Paciente",
  medicoOnly: true,
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
      <p class="muted" id="search-hint">Busca en tu lista y en pacientes registrados en el portal. Deja vacío para ver todos.</p>
      <div id="patient-results">
        ${
          patients.length === 0
            ? emptyState("Aún no tienes pacientes registrados.", "Agregar paciente", "/pacientes/nuevo")
            : renderPatientList(patients)
        }
      </div>
      <dialog id="ficha-dialog">
        <div class="form" style="min-width:min(92vw,420px)">
          <h2>Ficha de emergencia</h2>
          <div id="ficha-body"><p class="muted">Cargando…</p></div>
          <div class="dialog-actions">
            <button type="button" class="btn btn-primary" id="ficha-close">Cerrar</button>
          </div>
        </div>
      </dialog>
      `,
      `<button type="button" class="btn btn-primary" data-nav="/pacientes/nuevo">Agregar</button>`,
    );

    const input = el.querySelector("#cedula-search") as HTMLInputElement;
    const results = el.querySelector("#patient-results") as HTMLElement;
    const hint = el.querySelector("#search-hint") as HTMLElement;
    const dialog = el.querySelector("#ficha-dialog") as HTMLDialogElement;
    const fichaBody = el.querySelector("#ficha-body") as HTMLElement;

    async function openFicha(cedula: string): Promise<void> {
      fichaBody.innerHTML = `<p class="muted">Cargando ficha…</p>`;
      dialog.showModal();
      try {
        const ficha = await getFichaByCedula(cedula);
        if (!ficha) {
          fichaBody.innerHTML = `<p class="muted">Este paciente aún no tiene ficha de emergencia.</p>`;
          return;
        }
        fichaBody.innerHTML = renderFichaHtml(ficha);
      } catch {
        fichaBody.innerHTML = `<p class="status-badge status-error">No se pudo cargar la ficha.</p>`;
      }
    }

    function bindPatientCards(root: HTMLElement): void {
      root.querySelectorAll("[data-cedula]").forEach((node) => {
        const open = () => {
          const cedula = (node as HTMLElement).getAttribute("data-cedula");
          if (cedula) void openFicha(cedula);
        };
        node.addEventListener("click", open);
        node.addEventListener("keydown", (e) => {
          if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") {
            e.preventDefault();
            open();
          }
        });
      });
    }

    async function runSearch(): Promise<void> {
      const query = input.value.trim();
      const all = loadPatients();
      if (!query) {
        results.innerHTML =
          all.length === 0
            ? emptyState("Aún no tienes pacientes registrados.", "Agregar paciente", "/pacientes/nuevo")
            : renderPatientList(all);
        hint.textContent =
          "Busca en tu lista y en pacientes registrados en el portal. Deja vacío para ver todos.";
        bindNavButtons(results);
        bindPatientCards(results);
        return;
      }

      hint.textContent = "Buscando…";
      const exact = findPatientByCedula(all, query);
      let filtered = exact ? [exact] : all.filter((p) => matchesCedula(p.cedula, query));

      if (filtered.length === 0) {
        const portal = await findPortalPatient(query);
        if (portal) {
          const saved = upsertLocalPatient(portal);
          filtered = [saved];
          hint.textContent = `Encontrado en portal: ${saved.nombre} (añadido a tu lista)`;
        } else {
          hint.textContent = "No se encontró ningún paciente con esa cédula.";
        }
      } else if (exact) {
        hint.textContent = `Paciente encontrado: ${exact.nombre}`;
      } else {
        hint.textContent = `${filtered.length} coincidencia(s) parcial(es)`;
      }

      results.innerHTML = renderPatientList(filtered, query);
      bindNavButtons(results);
      bindPatientCards(results);
    }

    el.querySelector("#cedula-search-btn")?.addEventListener("click", () => void runSearch());
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void runSearch();
      }
    });
    el.querySelector("#ficha-close")?.addEventListener("click", () => dialog.close());

    bindNavButtons(el);
    bindPatientCards(results);
    return el;
  },
});

registerRoute({
  path: "/pacientes/nuevo",
  title: "Nuevo paciente",
  medicoOnly: true,
  render: () => {
    let step: "cedula" | "formulario" = "cedula";
    let foundPatients: Patient[] = [];
    let searchMessage = "";
    let prefilledCedula = "";

    const el = page("Nuevo paciente", `<div id="nuevo-root"></div>`);
    const root = el.querySelector("#nuevo-root") as HTMLElement;

    function renderStep(): void {
      if (step === "cedula") {
        root.innerHTML = `
          <p class="muted">Primero busca por cédula en la base de datos (tu lista, global y portal).</p>
          <div class="search-row">
            <label class="search-label">Cédula *
              <input type="text" id="nuevo-cedula" value="${escapeAttr(prefilledCedula)}" placeholder="Ej. V-12345678" />
            </label>
            <button type="button" class="btn btn-primary" id="nuevo-buscar">Buscar en base de datos</button>
          </div>
          <p class="muted" id="nuevo-msg">${escapeHtml(searchMessage)}</p>
          <div id="nuevo-found"></div>
          <button type="button" class="btn btn-ghost" data-nav="/pacientes">Volver</button>`;

        const foundBox = root.querySelector("#nuevo-found") as HTMLElement;
        if (foundPatients.length) {
          foundBox.innerHTML = foundPatients
            .map(
              (p) => `
            <div class="card-panel" style="margin-top:12px">
              <strong>${escapeHtml(p.nombre)}</strong>
              <p class="muted">C.I. ${escapeHtml(p.cedula)} · ${p.edad} años · ${escapeHtml(p.sexo || "—")}</p>
              <button type="button" class="btn btn-primary btn-sm btn-use-patient" data-id="${escapeAttr(p.id)}">Usar este paciente</button>
            </div>`,
            )
            .join("");
          foundBox.querySelectorAll(".btn-use-patient").forEach((btn) => {
            btn.addEventListener("click", () => {
              const id = (btn as HTMLElement).dataset.id;
              const p = foundPatients.find((x) => x.id === id);
              if (!p) return;
              const saved = upsertLocalPatient({ ...p, id: crypto.randomUUID() });
              navigate("/pacientes");
              void saved;
            });
          });
        }

        root.querySelector("#nuevo-buscar")?.addEventListener("click", () => void runSearch());
        root.querySelector("#nuevo-cedula")?.addEventListener("keydown", (e) => {
          if ((e as KeyboardEvent).key === "Enter") void runSearch();
        });
      } else {
        root.innerHTML = `
          <p class="muted">Completa los datos del paciente nuevo.</p>
          <form class="form" id="patient-form">
            <label>Nombre<input name="nombre" required /></label>
            <label>Cédula<input name="cedula" required value="${escapeAttr(prefilledCedula)}" /></label>
            <label>Sexo
              <select name="sexo" required>${sexOptionsHtml()}</select>
            </label>
            ${birthDateFieldsHtml("nac")}
            <p class="muted" id="edad-hint">La edad se calcula automáticamente con la fecha de nacimiento.</p>
            <button type="submit" class="btn btn-primary">Guardar</button>
            <button type="button" class="btn btn-ghost" id="nuevo-back">Volver a búsqueda</button>
          </form>`;
        bindBirthDateSelects(root, "nac");
        root.querySelector("#nuevo-back")?.addEventListener("click", () => {
          step = "cedula";
          renderStep();
          bindNavButtons(el);
        });
        root.querySelector("#patient-form")?.addEventListener("submit", (e) => {
          e.preventDefault();
          const fd = new FormData(e.target as HTMLFormElement);
          try {
            const sexo = String(fd.get("sexo") ?? "").trim();
            if (sexo !== "Masculino" && sexo !== "Femenino") {
              throw new Error("Seleccione el sexo");
            }
            const birth = parseBirthFromForm(fd, "nac");
            const patient: Patient = {
              id: crypto.randomUUID(),
              nombre: String(fd.get("nombre")).trim(),
              cedula: String(fd.get("cedula")).trim(),
              edad: birth.age,
              sexo,
              fechaNacimiento: birth.iso,
              createdAt: new Date().toISOString(),
            };
            upsertLocalPatient(patient);
            window.location.hash = "/pacientes";
          } catch (err) {
            alert(err instanceof Error ? err.message : "Datos incompletos");
          }
        });
      }
      bindNavButtons(el);
    }

    async function runSearch(): Promise<void> {
      const input = root.querySelector("#nuevo-cedula") as HTMLInputElement;
      prefilledCedula = input?.value.trim() ?? "";
      if (!prefilledCedula) {
        searchMessage = "Ingresa una cédula válida";
        foundPatients = [];
        renderStep();
        return;
      }
      const msg = root.querySelector("#nuevo-msg");
      if (msg) msg.textContent = "Buscando…";
      const local = findPatientByCedula(loadPatients(), prefilledCedula);
      let remote: Patient[] = [];
      let portal: Patient | null = null;
      try {
        remote = await findGlobalByCedula(prefilledCedula);
      } catch {
        /* offline */
      }
      try {
        portal = await findPortalPatient(prefilledCedula);
      } catch {
        /* offline */
      }
      const merged: Patient[] = [];
      if (local) merged.push(local);
      merged.push(...remote);
      if (portal) merged.push(portal);
      foundPatients = merged.filter(
        (p, i, arr) =>
          arr.findIndex(
            (x) =>
              normalizeCedula(x.cedula) === normalizeCedula(p.cedula) &&
              x.nombre.toLowerCase() === p.nombre.toLowerCase(),
          ) === i,
      );
      if (foundPatients.length) {
        searchMessage = "Paciente encontrado. Puedes usarlo o registrar uno nuevo con otros datos.";
      } else {
        searchMessage = "No existe. Completa los datos para registrarlo.";
        step = "formulario";
      }
      renderStep();
    }

    renderStep();
    return el;
  },
});
