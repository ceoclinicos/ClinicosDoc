import { registerRoute } from "../../app/router";
import { getClinicSession, setClinicSession } from "../../clinic/session";
import {
  cancelClinicInvitation,
  inviteDoctorByCedula,
  listClinicMembers,
  listPendingInvitationsForClinic,
  regenerateInviteCode,
  removeClinicMember,
} from "../../clinic/store";
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
      <div class="card-panel">
        <h2 class="home-section-title" style="margin-top:0">Agregar médico</h2>
        <p class="muted">Busque por cédula. El médico debe aceptar la invitación en la app o en Configuración web.</p>
        <form class="form" id="invite-doctor-form">
          <label>Cédula del médico<input name="cedula" required placeholder="Ej. V-12345678" /></label>
          <label>Nombre (si aún no está registrado)<input name="nombre" placeholder="Opcional si ya tiene cuenta" /></label>
          <button type="submit" class="btn btn-primary">Enviar invitación</button>
        </form>
        <div id="invite-status" class="muted" style="margin-top:0.5rem"></div>
      </div>

      <h2 class="home-section-title">Invitaciones pendientes</h2>
      <div id="pending-status" class="muted">Cargando…</div>
      <ul class="list" id="pending-list"></ul>

      <h2 class="home-section-title">Médicos vinculados</h2>
      <div id="members-status" class="muted">Cargando…</div>
      <ul class="list" id="members-list"></ul>

      <details class="card-panel" style="margin-top:1.5rem">
        <summary>Opción secundaria: código de invitación</summary>
        <p class="muted" style="margin-top:0.75rem">El médico puede unirse pegando este código (sin esperar invitación por cédula).</p>
        <p style="font-size:1.75rem;letter-spacing:0.15em;font-weight:700" id="invite-code">${escapeHtml(session.inviteCode)}</p>
        <button type="button" class="btn btn-secondary" id="btn-regen">Generar nuevo código</button>
      </details>
      `,
    );

    const status = el.querySelector("#members-status") as HTMLElement;
    const list = el.querySelector("#members-list") as HTMLElement;
    const pendingStatus = el.querySelector("#pending-status") as HTMLElement;
    const pendingList = el.querySelector("#pending-list") as HTMLElement;
    const inviteStatus = el.querySelector("#invite-status") as HTMLElement;
    const codeEl = el.querySelector("#invite-code") as HTMLElement;

    async function refreshPending(): Promise<void> {
      try {
        const pending = await listPendingInvitationsForClinic(session.clinicId);
        if (!pending.length) {
          pendingStatus.textContent = "Ninguna invitación pendiente.";
          pendingList.innerHTML = "";
          return;
        }
        pendingStatus.textContent = `${pending.length} pendiente(s)`;
        pendingList.innerHTML = pending
          .map(
            (i) => `
          <li class="list-item">
            <div>
              <strong>${escapeHtml(i.doctorNombre)}</strong>
              <p class="muted">C.I. ${escapeHtml(i.doctorCedula)}</p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" data-cancel="${escapeHtml(i.doctorCedula)}">Cancelar</button>
          </li>`,
          )
          .join("");
        pendingList.querySelectorAll("[data-cancel]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const ced = btn.getAttribute("data-cancel") || "";
            if (!ced || !confirm(`¿Cancelar invitación a C.I. ${ced}?`)) return;
            try {
              await cancelClinicInvitation(session.clinicId, ced);
              await refreshPending();
            } catch (err) {
              alert(err instanceof Error ? err.message : "No se pudo cancelar");
            }
          });
        });
      } catch (err) {
        pendingStatus.textContent =
          err instanceof Error ? err.message : "Error al cargar invitaciones";
      }
    }

    async function refreshMembers(): Promise<void> {
      try {
        const members = await listClinicMembers(session.clinicId);
        if (!members.length) {
          status.textContent = "Nadie en el equipo aún. Agregue médicos por cédula.";
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

    el.querySelector("#invite-doctor-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const btn = (e.target as HTMLFormElement).querySelector(
        "button[type=submit]",
      ) as HTMLButtonElement;
      btn.disabled = true;
      inviteStatus.textContent = "Enviando…";
      try {
        const inv = await inviteDoctorByCedula({
          clinicId: session.clinicId,
          doctorCedula: String(fd.get("cedula")),
          doctorNombreHint: String(fd.get("nombre") || "").trim() || undefined,
        });
        inviteStatus.textContent = `Invitación enviada a ${inv.doctorNombre}`;
        (e.target as HTMLFormElement).reset();
        await refreshPending();
      } catch (err) {
        inviteStatus.textContent = err instanceof Error ? err.message : "No se pudo invitar";
      } finally {
        btn.disabled = false;
      }
    });

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

    void refreshPending();
    void refreshMembers();
    bindNavButtons(el);
    return el;
  },
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
