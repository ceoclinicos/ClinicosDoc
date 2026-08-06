import { registerRoute, navigate } from "../app/router";
import { getProfessionalSession, logoutAllSessions } from "../registro/session";
import { loadDoctorProfile, saveDoctorProfile } from "../services/doctor-local";
import { resetRedactarTutorial } from "../services/onboarding";
import { openRedactarTutorial } from "../ui/redactar-tutorial";
import { joinClinicByInvite, listMembershipsForDoctor } from "../clinic/store";
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

        <h2 class="home-section-title">Centros de salud</h2>
        <div class="card-panel">
          <p class="muted">Unirme a un centro con el código de invitación</p>
          <form class="form" id="join-clinic-form">
            <label>Código<input name="code" required placeholder="Ej. AB12CD" style="text-transform:uppercase" /></label>
            <button type="submit" class="btn btn-primary">Unirme</button>
          </form>
          <div id="memberships-status" class="muted" style="margin-top:0.75rem">Cargando vínculos…</div>
          <ul class="list" id="memberships-list"></ul>
        </div>

        <h2 class="home-section-title">Ayuda</h2>
        <button type="button" class="tile tile-full" id="btn-tutorial">Tutorial de redacción</button>

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

    const memStatus = el.querySelector("#memberships-status") as HTMLElement;
    const memList = el.querySelector("#memberships-list") as HTMLElement;

    async function refreshMemberships(): Promise<void> {
      const cedula = session?.cedula || doctor?.cedula;
      if (!cedula) {
        memStatus.textContent = "Sin cédula en sesión.";
        return;
      }
      try {
        const list = await listMembershipsForDoctor(cedula, session?.cloudUserId);
        if (!list.length) {
          memStatus.textContent = "No está vinculado a ningún centro.";
          memList.innerHTML = "";
          return;
        }
        memStatus.textContent = `${list.length} centro(s)`;
        memList.innerHTML = list
          .map(
            (m) => `
          <li class="list-item">
            <strong>${escapeHtml(m.clinicName)}</strong>
            <span class="muted">${m.role}</span>
          </li>`,
          )
          .join("");
      } catch (err) {
        memStatus.textContent = err instanceof Error ? err.message : "No se pudieron cargar centros";
      }
    }

    el.querySelector("#join-clinic-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const cedula = session?.cedula || doctor?.cedula;
      const nombre = session?.nombre || doctor?.nombre;
      if (!cedula || !nombre) {
        alert("Complete su perfil (nombre y cédula) antes de unirse.");
        return;
      }
      const btn = (e.target as HTMLFormElement).querySelector("button[type=submit]") as HTMLButtonElement;
      btn.disabled = true;
      try {
        const joined = await joinClinicByInvite({
          inviteCode: String(fd.get("code")),
          doctorCedula: cedula,
          doctorNombre: nombre,
          cloudUserId: session?.cloudUserId,
        });
        alert(`Te uniste a ${joined.clinicName}`);
        (e.target as HTMLFormElement).reset();
        await refreshMemberships();
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo unir");
      } finally {
        btn.disabled = false;
      }
    });

    el.querySelector("#btn-tutorial")?.addEventListener("click", () => {
      resetRedactarTutorial();
      openRedactarTutorial();
    });

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

    void refreshMemberships();
    bindNavButtons(el);
    return el;
  },
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
