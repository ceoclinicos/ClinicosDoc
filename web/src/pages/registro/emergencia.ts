import { registerRoute } from "../../app/router";
import { getFichaByPublicId, type FichaEmergencia } from "../../services/emergency-ficha";
import { page } from "../helpers";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderFichaPublica(f: FichaEmergencia): string {
  const contacts = f.contactos.length
    ? `<ul class="list">${f.contactos
        .map(
          (c) =>
            `<li class="list-item"><strong>${escapeHtml(c.nombre)}</strong><span>${escapeHtml(c.parentesco)} · <a href="tel:${escapeHtml(c.telefono)}">${escapeHtml(c.telefono)}</a></span></li>`,
        )
        .join("")}</ul>`
    : `<p class="muted">Sin contactos registrados.</p>`;

  return `
    <div class="emergency-badge">EMERGENCIA</div>
    <h2 class="emergency-name">${escapeHtml(f.nombre)}</h2>
    <p class="muted">C.I. ${escapeHtml(f.patientCedula)}</p>
    <div class="card-panel emergency-grid">
      <div><span class="muted">Tipo de sangre</span><strong class="blood-type">${escapeHtml(f.tipoSangre)}</strong></div>
      <div><span class="muted">Alergias</span><p>${escapeHtml(f.alergias)}</p></div>
      <div><span class="muted">Condiciones / Comorbilidades</span><p>${escapeHtml(f.condiciones)}</p></div>
      <div><span class="muted">Medicamentos</span><p>${escapeHtml(f.medicamentos)}</p></div>
    </div>
    <h3 class="home-section-title">Contactos de emergencia</h3>
    ${contacts}
    <p class="muted" style="margin-top:1rem">Clínicos Doc · Ficha pública de emergencia</p>
  `;
}

registerRoute({
  path: "/emergencia/:id",
  title: "Ficha de emergencia",
  render: () => {
    const id = window.location.hash.replace(/^#\/emergencia\//, "").split("?")[0];
    const el = page(
      "Ficha Médica de Emergencia",
      `<div id="emergencia-box"><p class="muted">Cargando…</p></div>`,
    );
    const box = el.querySelector("#emergencia-box") as HTMLElement;
    getFichaByPublicId(id)
      .then((f) => {
        if (!f) {
          box.innerHTML = `<p class="status-badge status-error">Ficha no encontrada o inactiva.</p>`;
          return;
        }
        box.innerHTML = renderFichaPublica(f);
      })
      .catch((err) => {
        box.innerHTML = `<p class="status-badge status-error">${err instanceof Error ? err.message : "Error"}</p>`;
      });
    return el;
  },
});

/** Atajo para paciente logueado: misma UI que /paciente ancla a QR */
registerRoute({
  path: "/emergencia-mia",
  title: "Mi ficha emergencia",
  render: () => {
    // Redirige al portal paciente donde está el editor
    window.location.hash = "/paciente";
    return page("Mi ficha", `<p class="muted">Redirigiendo…</p>`);
  },
});
