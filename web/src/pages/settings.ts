import { registerRoute, navigate } from "../app/router";
import { getProfessionalSession, logoutAllSessions } from "../registro/session";
import { loadDoctorProfile, saveDoctorProfile } from "../services/doctor-local";
import { bindNavButtons, page } from "./helpers";

registerRoute({
  path: "/configuracion",
  title: "Configuración",
  medicoOnly: true,
  render: () => {
    const session = getProfessionalSession();
    const doctor = loadDoctorProfile();
    const el = page(
      "Configuración",
      `
      <div class="stack">
        <div class="card-panel">
          <p class="muted">Sesión</p>
          <p><strong>${session?.nombre ?? doctor?.nombre ?? "—"}</strong></p>
          <p class="muted">${session?.especialidad || doctor?.especialidad || "Médico"} · MPPS ${session?.mpps || doctor?.mpps || "—"}</p>
        </div>

        <h2 class="home-section-title">Plantillas y documentos</h2>
        <button type="button" class="tile tile-full" data-nav="/plantillas">Todas las plantillas</button>
        <button type="button" class="tile tile-full" data-nav="/plantillas/documentos">Informes e historias</button>
        <button type="button" class="tile tile-full" data-nav="/plantillas/recetas">Órdenes y recetas</button>
        <button type="button" class="tile tile-full" data-nav="/plantillas/encabezados">Encabezados PDF</button>
        <button type="button" class="tile tile-full" data-nav="/plantillas/examen-fisico">Catálogo examen físico</button>

        <h2 class="home-section-title">Datos del médico (consultorio)</h2>
        <form class="form card-panel" id="doctor-form">
          <label>Nombre<input name="nombre" required value="${doctor?.nombre ?? session?.nombre ?? ""}" /></label>
          <label>Cédula<input name="cedula" value="${doctor?.cedula ?? session?.cedula ?? ""}" /></label>
          <label>Especialidad<input name="especialidad" required value="${doctor?.especialidad ?? session?.especialidad ?? "Médico general"}" /></label>
          <label>MPPS<input name="mpps" value="${doctor?.mpps ?? session?.mpps ?? ""}" /></label>
          <button type="submit" class="btn btn-primary">Guardar perfil</button>
        </form>

        <button type="button" class="btn btn-ghost" id="btn-logout">Cerrar sesión</button>
      </div>
      `,
    );

    el.querySelector("#doctor-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      saveDoctorProfile({
        nombre: String(fd.get("nombre")),
        cedula: String(fd.get("cedula")),
        especialidad: String(fd.get("especialidad")),
        mpps: String(fd.get("mpps")),
      });
      alert("Perfil guardado");
    });

    el.querySelector("#btn-logout")?.addEventListener("click", () => {
      logoutAllSessions();
      navigate("/");
    });

    bindNavButtons(el);
    return el;
  },
});
