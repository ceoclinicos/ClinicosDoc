import { registerRoute } from "../../app/router";
import { getClinicSession, setClinicSession } from "../../clinic/session";
import type { ClinicDoctorInvitation, ClinicMember } from "../../clinic/models";
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
        <p class="muted">Solo la cédula. El nombre se toma de la cuenta del médico si ya está registrado.</p>
        <form class="form" id="invite-doctor-form">
          <label>Cédula del médico<input name="cedula" required placeholder="Ej. V-12345678" /></label>
          <button type="submit" class="btn btn-primary">Enviar invitación</button>
        </form>
        <div id="invite-status" class="muted" style="margin-top:0.5rem"></div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap">
        <h2 class="home-section-title" style="margin:0">Invitaciones pendientes</h2>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-pending">Actualizar</button>
      </div>
      <div id="pending-status" class="muted">Cargando…</div>
      <div class="clinic-table-wrap" id="pending-wrap" hidden>
        <table class="clinic-table">
          <thead>
            <tr>
              <th>Médico</th>
              <th>Cédula</th>
              <th>Enviada</th>
              <th>Vence</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="pending-body"></tbody>
        </table>
      </div>

      <h2 class="home-section-title" style="margin-top:2rem">Médicos vinculados</h2>
      <div id="members-status" class="muted">Cargando…</div>
      <div class="clinic-table-wrap" id="members-wrap" hidden>
        <table class="clinic-table">
          <thead>
            <tr>
              <th>Médico</th>
              <th>Cédula</th>
              <th>Rol</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="members-body"></tbody>
        </table>
      </div>

      <details class="card-panel" style="margin-top:1.5rem">
        <summary>Opción secundaria: código de invitación</summary>
        <p class="muted" style="margin-top:0.75rem">El médico puede unirse pegando este código (sin esperar invitación por cédula).</p>
        <p style="font-size:1.75rem;letter-spacing:0.15em;font-weight:700" id="invite-code">${escapeHtml(session.inviteCode)}</p>
        <button type="button" class="btn btn-secondary" id="btn-regen">Generar nuevo código</button>
      </details>
      `,
    );

    const membersStatus = el.querySelector("#members-status") as HTMLElement;
    const membersWrap = el.querySelector("#members-wrap") as HTMLElement;
    const membersBody = el.querySelector("#members-body") as HTMLElement;
    const pendingStatus = el.querySelector("#pending-status") as HTMLElement;
    const pendingWrap = el.querySelector("#pending-wrap") as HTMLElement;
    const pendingBody = el.querySelector("#pending-body") as HTMLElement;
    const inviteStatus = el.querySelector("#invite-status") as HTMLElement;
    const codeEl = el.querySelector("#invite-code") as HTMLElement;

    function renderPendingRows(pending: ClinicDoctorInvitation[]): void {
      if (!pending.length) {
        pendingWrap.hidden = true;
        pendingStatus.textContent = "Ninguna invitación pendiente.";
        pendingBody.innerHTML = "";
        return;
      }
      pendingWrap.hidden = false;
      pendingStatus.textContent = `${pending.length} invitación(es) pendiente(s)`;
      pendingBody.innerHTML = pending
        .map(
          (i) => `
        <tr>
          <td><strong>${escapeHtml(i.doctorNombre)}</strong></td>
          <td>${escapeHtml(i.doctorCedula)}</td>
          <td>${formatDate(i.invitedAt)}</td>
          <td>${i.expiresAt ? formatDate(i.expiresAt) : "—"}</td>
          <td class="clinic-table-action">
            <button type="button" class="btn btn-ghost btn-sm" data-cancel="${escapeHtml(i.doctorCedula)}">Cancelar</button>
          </td>
        </tr>`,
        )
        .join("");
      pendingBody.querySelectorAll("[data-cancel]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const ced = btn.getAttribute("data-cancel") || "";
          if (!ced || !confirm(`¿Cancelar invitación a C.I. ${ced}?`)) return;
          (btn as HTMLButtonElement).disabled = true;
          try {
            await cancelClinicInvitation(session.clinicId, ced);
            await refreshPending();
          } catch (err) {
            alert(err instanceof Error ? err.message : "No se pudo cancelar");
          } finally {
            (btn as HTMLButtonElement).disabled = false;
          }
        });
      });
    }

    function renderMemberRows(members: ClinicMember[]): void {
      if (!members.length) {
        membersWrap.hidden = true;
        membersStatus.textContent = "Nadie en el equipo aún. Agregue médicos por cédula.";
        membersBody.innerHTML = "";
        return;
      }
      membersWrap.hidden = false;
      membersStatus.textContent = `${members.length} médico(s) vinculado(s)`;
      membersBody.innerHTML = members
        .map(
          (m) => `
        <tr>
          <td><strong>${escapeHtml(m.doctorNombre)}</strong></td>
          <td>${escapeHtml(m.doctorCedula)}</td>
          <td>${escapeHtml(m.role)}</td>
          <td class="clinic-table-action">
            <button type="button" class="btn btn-ghost btn-sm" data-remove="${escapeHtml(m.doctorCedula)}" data-cloud="${escapeHtml(m.cloudUserId || "")}">Quitar</button>
          </td>
        </tr>`,
        )
        .join("");
      membersBody.querySelectorAll("[data-remove]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const ced = btn.getAttribute("data-remove") || "";
          const cloud = btn.getAttribute("data-cloud") || undefined;
          if (!ced || !confirm(`¿Desvincular a C.I. ${ced} de este centro?`)) return;
          (btn as HTMLButtonElement).disabled = true;
          try {
            await removeClinicMember(session.clinicId, ced, cloud || undefined);
            await refreshMembers();
          } catch (err) {
            alert(err instanceof Error ? err.message : "No se pudo quitar");
          } finally {
            (btn as HTMLButtonElement).disabled = false;
          }
        });
      });
    }

    async function refreshPending(): Promise<void> {
      pendingStatus.textContent = "Cargando invitaciones…";
      try {
        const pending = await listPendingInvitationsForClinic(session.clinicId);
        renderPendingRows(pending);
      } catch (err) {
        pendingWrap.hidden = true;
        pendingStatus.textContent =
          err instanceof Error ? err.message : "Error al cargar invitaciones";
      }
    }

    async function refreshMembers(): Promise<void> {
      membersStatus.textContent = "Cargando equipo…";
      try {
        const members = await listClinicMembers(session.clinicId);
        renderMemberRows(members);
      } catch (err) {
        membersWrap.hidden = true;
        membersStatus.textContent = err instanceof Error ? err.message : "Error al cargar equipo";
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

    el.querySelector("#btn-refresh-pending")?.addEventListener("click", () => {
      void refreshPending();
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

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}
