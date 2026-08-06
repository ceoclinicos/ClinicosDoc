import { registerRoute } from "../../app/router";
import { getClinicSession, setClinicSession } from "../../clinic/session";
import { listClinicMembers, regenerateInviteCode, removeClinicMember } from "../../clinic/store";
import { bindNavButtons, page } from "../helpers";

registerRoute({
  path: "/clinica/equipo",
  title: "Equipo",
  clinicOnly: true,
  nav: true,
  navLabel: "Equipo",
  render: () => {
    const session = getClinicSession()!;
    const el = page(
      "Equipo médico",
      `
      <p class="lead">Los médicos se unen con este código desde Configuración → Centros de salud (app) o Configuración web.</p>
      <div class="card-panel">
        <p class="muted">Código de invitación</p>
        <p style="font-size:1.75rem;letter-spacing:0.15em;font-weight:700" id="invite-code">${escapeHtml(session.inviteCode)}</p>
        <button type="button" class="btn btn-secondary" id="btn-regen">Generar nuevo código</button>
      </div>
      <h2 class="home-section-title">Médicos vinculados</h2>
      <div id="members-status" class="muted">Cargando…</div>
      <ul class="list" id="members-list"></ul>
      `,
    );

    const status = el.querySelector("#members-status") as HTMLElement;
    const list = el.querySelector("#members-list") as HTMLElement;
    const codeEl = el.querySelector("#invite-code") as HTMLElement;

    async function refreshMembers(): Promise<void> {
      try {
        const members = await listClinicMembers(session.clinicId);
        if (!members.length) {
          status.textContent = "Nadie se ha unido aún. Comparte el código con tus médicos.";
          list.innerHTML = "";
          return;
        }
        status.textContent = `${members.length} médico(s)`;
        list.innerHTML = members
          .map(
            (m) => `
          <li class="list-item">
            <div>
              <strong>${escapeHtml(m.doctorNombre)}</strong>
              <p class="muted">C.I. ${escapeHtml(m.doctorCedula)} · ${m.role}</p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" data-remove="${escapeHtml(m.doctorCedula)}" data-cloud="${escapeHtml(m.cloudUserId || "")}">Quitar</button>
          </li>`,
          )
          .join("");
        list.querySelectorAll("[data-remove]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const ced = btn.getAttribute("data-remove") || "";
            const cloud = btn.getAttribute("data-cloud") || undefined;
            if (!ced || !confirm(`¿Desvincular a C.I. ${ced} de este centro?`)) return;
            try {
              await removeClinicMember(session.clinicId, ced, cloud || undefined);
              await refreshMembers();
            } catch (err) {
              alert(err instanceof Error ? err.message : "No se pudo quitar");
            }
          });
        });
      } catch (err) {
        status.textContent = err instanceof Error ? err.message : "Error al cargar equipo";
      }
    }

    el.querySelector("#btn-regen")?.addEventListener("click", async () => {
      if (!confirm("¿Generar un código nuevo? El anterior dejará de funcionar.")) return;
      try {
        const code = await regenerateInviteCode(session.clinicId);
        setClinicSession({ ...session, inviteCode: code });
        codeEl.textContent = code;
        alert("Código actualizado");
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo regenerar");
      }
    });

    void refreshMembers();
    bindNavButtons(el);
    return el;
  },
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
