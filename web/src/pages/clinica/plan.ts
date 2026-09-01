import { registerRoute } from "../../app/router";
import { getClinicSession } from "../../clinic/session";
import {
  activateClinicSubscription,
  fetchClinicSubscriptionStatus,
  type ClinicSubscriptionStatus,
  type ClinicTierId,
} from "../../services/clinic-subscription";
import { bindNavButtons, page } from "../helpers";

registerRoute({
  path: "/clinica/plan",
  title: "Plan",
  clinicOnly: true,
  nav: true,
  navLabel: "Plan",
  render: () => {
    const session = getClinicSession()!;
    const el = page(
      "Plan del centro",
      `
      <div id="plan-status" class="muted">Cargando…</div>
      <div id="plan-body" hidden></div>
      `,
    );

    const statusEl = el.querySelector("#plan-status") as HTMLElement;
    const bodyEl = el.querySelector("#plan-body") as HTMLElement;

    function renderPlan(status: ClinicSubscriptionStatus): void {
      bodyEl.hidden = false;
      const paidTiers = status.tiers.filter((t) => t.id !== "free");
      bodyEl.innerHTML = `
        <div class="card-panel">
          <p><strong>Equipo:</strong> ${status.teamSize} / ${status.maxDoctors} médicos</p>
          <p><strong>Sincronización de informes:</strong> ${status.syncActive ? "Activa" : "Inactiva (solo lectura)"}</p>
          <p><strong>Dispositivos:</strong> ${status.devices.registered} / ${status.devices.max}</p>
          ${
            status.period.endAt
              ? `<p><strong>Vence:</strong> ${formatDate(status.period.endAt)}</p>`
              : ""
          }
          ${
            status.canUseAi
              ? `<p><strong>IA del centro:</strong> ${status.period.remaining} / ${status.period.quota} restantes</p>`
              : `<p class="muted">La IA del centro requiere suscripción de pago activa.</p>`
          }
          ${status.message ? `<p class="warn">${escapeHtml(status.message)}</p>` : ""}
        </div>
        <div class="card-panel">
          <h2 class="home-section-title" style="margin-top:0">Planes</h2>
          <ul class="plan-tier-list">
            <li>Gratis — hasta 5 médicos</li>
            ${paidTiers.map((t) => `<li>${escapeHtml(t.label)}</li>`).join("")}
          </ul>
          <p class="muted">Cada médico paga su propia IA. El centro solo paga la organización.</p>
          <div class="plan-actions">
            ${paidTiers
              .map(
                (t) => `
              <button type="button" class="btn btn-secondary btn-sm" data-tier="${t.id}">
                Activar ${escapeHtml(t.label.split("—")[0].trim())}
              </button>`,
              )
              .join("")}
          </div>
          <p class="muted" style="margin-top:0.75rem">Activación manual temporal hasta integrar pago en línea.</p>
        </div>
      `;

      bodyEl.querySelectorAll("[data-tier]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const tier = btn.getAttribute("data-tier") as ClinicTierId;
          if (!tier || !confirm(`¿Activar ${tier} por 30 días?`)) return;
          (btn as HTMLButtonElement).disabled = true;
          try {
            const next = await activateClinicSubscription(tier);
            renderPlan(next);
            statusEl.textContent = "Plan actualizado.";
          } catch (err) {
            alert(err instanceof Error ? err.message : "No se pudo activar");
          } finally {
            (btn as HTMLButtonElement).disabled = false;
          }
        });
      });
    }

    void (async () => {
      try {
        const status = await fetchClinicSubscriptionStatus();
        statusEl.textContent = `Plan actual: ${labelForTier(status.tier)}`;
        renderPlan(status);
      } catch (err) {
        statusEl.textContent = err instanceof Error ? err.message : "Error al cargar el plan";
      }
    })();

    bindNavButtons(el);
    return el;
  },
});

function labelForTier(tier: string): string {
  const map: Record<string, string> = {
    free: "Gratis (≤5 médicos)",
    tier_50: "Hasta 50 médicos",
    tier_100: "Hasta 100 médicos",
    tier_unlimited: "Más de 100 médicos",
  };
  return map[tier] || tier;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
