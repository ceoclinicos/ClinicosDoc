import { registerRoute } from "../app/router";
import { loadJson, saveJson } from "../services/local-store";
import type { Patient } from "../shared/models";
import { bindNavButtons, emptyState, page } from "./helpers";

const KEY = "patients";

function loadPatients(): Patient[] {
  return loadJson<Patient[]>(KEY, []);
}

registerRoute({
  path: "/pacientes",
  title: "Pacientes",
  nav: true,
  navLabel: "Paciente",
  render: () => {
    const patients = loadPatients();
    const list =
      patients.length === 0
        ? emptyState("Aún no tienes pacientes registrados.", "Agregar paciente", "/pacientes/nuevo")
        : `<ul class="list">${patients
            .map(
              (p) =>
                `<li class="list-item"><strong>${p.nombre}</strong><span>C.I. ${p.cedula} · ${p.edad} años</span></li>`,
            )
            .join("")}</ul>`;

    const el = page(
      "Pacientes",
      list,
      `<button type="button" class="btn btn-primary" data-nav="/pacientes/nuevo">Agregar</button>`,
    );
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
