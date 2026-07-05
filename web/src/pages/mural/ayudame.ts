import { registerRoute } from "../../app/router";
import { ZONAS_AFECTADAS } from "../../registro/models";
import { createSolicitud, formatFecha, listSolicitudes } from "../../registro/store";
import { getPatientSession } from "../../registro/session";
import type { SolicitudAyuda } from "../../registro/models";
import { shareLinks, shareSite, shareSolicitud } from "../../services/share";
import { bindNavButtons, page } from "../helpers";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function zonaOptions(selected = ""): string {
  return ZONAS_AFECTADAS.map(
    (z) => `<option value="${z}" ${selected === z ? "selected" : ""}>${z}</option>`,
  ).join("");
}

function solicitudCard(s: SolicitudAyuda): string {
  return `
    <article class="mural-card" id="solicitud-${s.id}">
      <header class="mural-card-header">
        <strong>${escapeHtml(s.patientNombre)}</strong>
        <span class="mural-zona">📍 ${escapeHtml(s.zona)}</span>
      </header>
      <p class="mural-body">${escapeHtml(s.necesidad)}</p>
      <footer class="mural-footer">
        <time class="muted">${formatFecha(s.createdAt)}</time>
        ${shareLinks(s)}
      </footer>
    </article>
  `;
}

function bindShareButtons(root: HTMLElement): void {
  root.querySelectorAll("[data-share-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-share-id");
      const card = root.querySelector(`#solicitud-${id}`);
      if (!id || !card) return;
      const nombre = card.querySelector("strong")?.textContent ?? "";
      const zona = card.querySelector(".mural-zona")?.textContent?.replace("📍 ", "") ?? "";
      const necesidad = card.querySelector(".mural-body")?.textContent ?? "";
      shareSolicitud({ id, patientNombre: nombre, zona, necesidad });
    });
  });
}

function renderFeed(root: HTMLElement, filtroZona: string): void {
  const feed = root.querySelector("#mural-feed") as HTMLElement;
  feed.innerHTML = `<p class="muted">Cargando solicitudes…</p>`;
  listSolicitudes()
    .then((items) => {
      const filtered = filtroZona ? items.filter((i) => i.zona === filtroZona) : items;
      if (!filtered.length) {
        feed.innerHTML = `<p class="empty-state">Aún no hay solicitudes${filtroZona ? ` en ${filtroZona}` : ""}.</p>`;
        return;
      }
      feed.innerHTML = filtered.map(solicitudCard).join("");
      bindShareButtons(feed);
    })
    .catch((err) => {
      feed.innerHTML = `<p class="status-badge status-error">${escapeHtml(err instanceof Error ? err.message : "Error")}</p>`;
    });
}

registerRoute({
  path: "/ayudame",
  title: "Ayúdame",
  nav: true,
  navLabel: "Ayúdame",
  render: () => {
    const session = getPatientSession();
    const el = page(
      "Muro de ayuda",
      `
      <p class="lead">Zonas afectadas: Caracas, litoral de La Guaira, Catia La Mar, Tanaguarena, Morón, Tucacas y alrededores.</p>
      <div class="mural-toolbar">
        <label class="search-label">Filtrar zona
          <select id="filtro-zona">
            <option value="">Todas</option>
            ${zonaOptions()}
          </select>
        </label>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-share-site">Compartir muro</button>
      </div>
      ${
        session
          ? `
        <form class="form mural-compose" id="form-solicitud">
          <p class="muted">Publicando como <strong>${escapeHtml(session.nombre)}</strong> · <a href="#/paciente">Mi cuenta</a></p>
          <label>Zona donde se encuentra
            <select name="zona" required>${zonaOptions()}</select>
          </label>
          <label>Necesidad / situación
            <textarea name="necesidad" rows="4" required placeholder="Describa qué necesita o qué padece…"></textarea>
          </label>
          <button type="submit" class="btn btn-primary">Publicar solicitud</button>
        </form>
      `
          : `
        <div class="card-panel">
          <p>Para publicar una solicitud debe <strong>registrarse e iniciar sesión</strong> como paciente.</p>
          <button type="button" class="btn btn-primary" data-nav="/paciente">Registrarme / Ingresar</button>
        </div>
      `
      }
      <div id="mural-feed" class="mural-feed"></div>
      <p class="muted mural-links">
        <a href="#/profesional">Soy profesional de salud</a> ·
        <a href="#/acerca-de">Acerca de</a>
      </p>
      `,
    );

    const filtro = el.querySelector("#filtro-zona") as HTMLSelectElement;
    renderFeed(el, filtro?.value ?? "");
    filtro?.addEventListener("change", () => renderFeed(el, filtro.value));

    el.querySelector("#btn-share-site")?.addEventListener("click", () => shareSite());

    el.querySelector("#form-solicitud")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!session) return;
      const fd = new FormData(e.target as HTMLFormElement);
      try {
        await createSolicitud({
          patientCedula: session.cedula,
          patientNombre: session.nombre,
          zona: String(fd.get("zona")),
          necesidad: String(fd.get("necesidad")),
        });
        (e.target as HTMLFormElement).reset();
        renderFeed(el, filtro?.value ?? "");
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo publicar");
      }
    });

    bindNavButtons(el);
    return el;
  },
});

registerRoute({
  path: "/solicitud/:id",
  title: "Solicitud",
  render: () => {
    const id = window.location.hash.replace(/^#\/solicitud\//, "").split("?")[0];
    const el = page("Solicitud de ayuda", `<div id="sol-one"></div><p><a href="#/ayudame">← Volver al muro</a></p>`);
    listSolicitudes().then((items) => {
      const s = items.find((i) => i.id === id);
      const box = el.querySelector("#sol-one") as HTMLElement;
      if (!s) {
        box.innerHTML = `<p class="muted">Solicitud no encontrada.</p>`;
        return;
      }
      box.innerHTML = solicitudCard(s);
      bindShareButtons(box);
    });
    return el;
  },
});
