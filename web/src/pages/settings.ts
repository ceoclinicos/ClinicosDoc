import { registerRoute, navigate } from "../app/router";
import { getProfessionalSession, logoutAllSessions } from "../registro/session";
import { loadDoctorProfile, saveDoctorProfile } from "../services/doctor-local";
import { resetRedactarTutorial, isTutorialButtonEnabled } from "../services/onboarding";
import { openRedactarTutorial } from "../ui/redactar-tutorial";
import { joinClinicByInvite, listMembershipsForDoctor, listPendingInvitationsForDoctor, acceptDoctorInvitation, rejectDoctorInvitation, leaveClinicAsDoctor } from "../clinic/store";
import { subscribeSyncStatus, flushPendingCloudSync } from "../services/sync-feedback";
import { resetTemplatesToDefaults } from "../services/clinical-store";
import { resetExamCatalogToDefaults } from "../services/exam-catalog";
import { clearSello } from "../services/sello-store";
import { bindNavButtons, page } from "./helpers";
import {
  activateSubscription,
  fetchSubscriptionStatus,
  formatEntitlementBanner,
} from "../services/subscription";

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
        <div id="sync-pending-banner" class="sync-pending-banner" hidden></div>
        <div class="card-panel">
          <p class="muted">Sesión</p>
          <p><strong>${session?.nombre ?? doctor?.nombre ?? "—"}</strong></p>
          <p class="muted">${session?.especialidad || doctor?.especialidad || "Médico"} · MPPS ${session?.mpps || doctor?.mpps || "—"}</p>
        </div>

        <h2 class="home-section-title">Plan y prueba IA</h2>
        <div class="card-panel" id="plan-panel">
          <p class="muted" id="plan-status">Cargando plan…</p>
          <button type="button" class="btn btn-primary" id="btn-subscribe" hidden>Suscribirse (30 días)</button>
        </div>

        <h2 class="home-section-title">Centros de salud</h2>
        <div class="card-panel">
          <p class="muted">Invitaciones pendientes</p>
          <div id="invites-status" class="muted">Cargando…</div>
          <ul class="list" id="invites-list"></ul>
        </div>
        <div class="card-panel">
          <p class="muted">Unirme con código (opcional)</p>
          <form class="form" id="join-clinic-form">
            <label>Código<input name="code" required placeholder="Ej. AB12CD" style="text-transform:uppercase" /></label>
            <button type="submit" class="btn btn-secondary">Unirme con código</button>
          </form>
          <div id="memberships-status" class="muted" style="margin-top:0.75rem">Cargando vínculos…</div>
          <ul class="list" id="memberships-list"></ul>
        </div>

        <h2 class="home-section-title">Ayuda</h2>
        <button type="button" class="tile tile-full" id="btn-tutorial" hidden>Tutorial de redacción</button>

        <h2 class="home-section-title">Plantillas y documentos</h2>
        <button type="button" class="tile tile-full" data-nav="/plantillas">Todas las plantillas</button>
        <button type="button" class="tile tile-full" data-nav="/plantillas/documentos">Informes e historias</button>
        <button type="button" class="tile tile-full" data-nav="/plantillas/recetas">Órdenes y recetas</button>
        <button type="button" class="tile tile-full" data-nav="/plantillas/encabezados">Encabezados PDF</button>
        <button type="button" class="tile tile-full" data-nav="/plantillas/examen-fisico">Catálogo examen físico</button>
        <button type="button" class="tile tile-full" id="btn-reset-config">Restablecer configuración</button>

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
    const invitesStatus = el.querySelector("#invites-status") as HTMLElement;
    const invitesList = el.querySelector("#invites-list") as HTMLElement;

    async function refreshInvites(): Promise<void> {
      const cedula = session?.cedula || doctor?.cedula;
      if (!cedula) {
        invitesStatus.textContent = "Sin cédula en sesión.";
        return;
      }
      try {
        const pending = await listPendingInvitationsForDoctor(cedula, session?.cloudUserId);
        if (!pending.length) {
          invitesStatus.textContent = "No tiene invitaciones pendientes.";
          invitesList.innerHTML = "";
          return;
        }
        invitesStatus.textContent = `${pending.length} invitación(es)`;
        invitesList.innerHTML = pending
          .map(
            (i) => `
          <li class="list-item">
            <div>
              <strong>${escapeHtml(i.clinicName)}</strong>
              <p class="muted">Invitado como ${escapeHtml(i.doctorNombre)}</p>
            </div>
            <div style="display:flex;gap:0.5rem">
              <button type="button" class="btn btn-primary btn-sm" data-accept="${escapeHtml(i.clinicId)}">Aceptar</button>
              <button type="button" class="btn btn-ghost btn-sm" data-reject="${escapeHtml(i.clinicId)}">Rechazar</button>
            </div>
          </li>`,
          )
          .join("");
        invitesList.querySelectorAll("[data-accept]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const clinicId = btn.getAttribute("data-accept") || "";
            const nombre = session?.nombre || doctor?.nombre;
            if (!clinicId || !cedula || !nombre) return;
            try {
              const joined = await acceptDoctorInvitation({
                clinicId,
                doctorCedula: cedula,
                doctorNombre: nombre,
                cloudUserId: session?.cloudUserId,
              });
              alert(`Te uniste a ${joined.clinicName}`);
              await refreshInvites();
              await refreshMemberships();
            } catch (err) {
              alert(err instanceof Error ? err.message : "No se pudo aceptar");
            }
          });
        });
        invitesList.querySelectorAll("[data-reject]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const clinicId = btn.getAttribute("data-reject") || "";
            if (!clinicId || !confirm("¿Rechazar esta invitación?")) return;
            try {
              await rejectDoctorInvitation({ clinicId, doctorCedula: cedula });
              await refreshInvites();
            } catch (err) {
              alert(err instanceof Error ? err.message : "No se pudo rechazar");
            }
          });
        });
      } catch (err) {
        invitesStatus.textContent =
          err instanceof Error ? err.message : "No se pudieron cargar invitaciones";
      }
    }

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
            <div>
              <strong>${escapeHtml(m.clinicName)}</strong>
              <span class="muted">${escapeHtml(m.role)}</span>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" data-leave="${escapeHtml(m.clinicId)}" data-leave-name="${escapeHtml(m.clinicName)}">Desvincular</button>
          </li>`,
          )
          .join("");
        memList.querySelectorAll("[data-leave]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const clinicId = btn.getAttribute("data-leave") || "";
            const clinicName = btn.getAttribute("data-leave-name") || "este centro";
            if (!clinicId || !cedula) return;
            if (!confirm(`¿Desvincularse de «${clinicName}»?`)) return;
            (btn as HTMLButtonElement).disabled = true;
            try {
              await leaveClinicAsDoctor({
                clinicId,
                doctorCedula: cedula,
                clinicName,
              });
              alert(`Desvinculado de ${clinicName}`);
              await refreshMemberships();
            } catch (err) {
              alert(err instanceof Error ? err.message : "No se pudo desvincular");
              (btn as HTMLButtonElement).disabled = false;
            }
          });
        });
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

    const tutorialSettingsBtn = el.querySelector("#btn-tutorial") as HTMLButtonElement | null;
    if (tutorialSettingsBtn) {
      tutorialSettingsBtn.hidden = !isTutorialButtonEnabled();
      window.addEventListener("tutorialbtnchange", ((e: CustomEvent<{ enabled: boolean }>) => {
        tutorialSettingsBtn.hidden = !e.detail.enabled;
      }) as EventListener);
    }

    el.querySelector("#btn-tutorial")?.addEventListener("click", () => {
      resetRedactarTutorial();
      openRedactarTutorial();
    });

    void flushPendingCloudSync({ quiet: true });

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

    el.querySelector("#btn-reset-config")?.addEventListener("click", () => {
      if (
        !confirm(
          "Volverán a los valores de fábrica: plantillas de documento, catálogo de examen " +
            "físico, sello médico y ejemplo de enfermedad actual.\n\n" +
            "NO se borran: encabezados, informes, historias, pacientes, citas ni borradores.\n\n" +
            "¿Continuar?",
        )
      ) {
        return;
      }
      resetTemplatesToDefaults();
      resetExamCatalogToDefaults();
      clearSello();
      alert("Configuración restablecida.");
    });

    el.querySelector("#btn-logout")?.addEventListener("click", () => {
      logoutAllSessions();
      navigate("/");
    });

    const syncBanner = el.querySelector("#sync-pending-banner") as HTMLElement;
    syncBanner.style.cursor = "pointer";
    syncBanner.title = "Toca para reintentar ahora";
    syncBanner.addEventListener("click", () => {
      void flushPendingCloudSync({ force: true });
    });
    subscribeSyncStatus((pending) => {
      if (!pending.length) {
        syncBanner.hidden = true;
        syncBanner.textContent = "";
        return;
      }
      syncBanner.hidden = false;
      const labels = pending.slice(0, 3).map((p) => p.label).join(", ");
      const extra = pending.length > 3 ? ` y ${pending.length - 3} más` : "";
      syncBanner.textContent = `${pending.length} pendiente(s): ${labels}${extra}. Toca para reintentar.`;
    });

    void (async () => {
      const statusEl = el.querySelector("#plan-status") as HTMLElement;
      const btnSub = el.querySelector("#btn-subscribe") as HTMLButtonElement;
      try {
        const status = await fetchSubscriptionStatus();
        statusEl.textContent = formatEntitlementBanner(status);
        const needsPay =
          !status.canUseAi ||
          status.plan === "expired" ||
          status.plan === "blocked_trial";
        btnSub.hidden = !needsPay && status.plan !== "trial";
        if (status.plan === "trial") {
          btnSub.hidden = false;
          btnSub.textContent = "Suscribirse ahora";
        }
        if (status.plan === "subscribed" || status.plan === "courtesy") {
          btnSub.hidden = true;
        }
      } catch (err) {
        statusEl.textContent =
          err instanceof Error ? err.message : "No se pudo cargar el plan";
      }
      btnSub.addEventListener("click", async () => {
        btnSub.disabled = true;
        try {
          const status = await activateSubscription();
          statusEl.textContent = formatEntitlementBanner(status);
          btnSub.hidden = true;
          alert("Suscripción activada por 30 días.");
        } catch (err) {
          alert(err instanceof Error ? err.message : "No se pudo suscribir");
          btnSub.disabled = false;
        }
      });
    })();

    void refreshInvites();
    void refreshMemberships();
    bindNavButtons(el);
    return el;
  },
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
