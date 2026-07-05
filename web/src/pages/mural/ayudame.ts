import { registerRoute } from "../../app/router";
import { ZONAS_AFECTADAS } from "../../registro/models";
import {
  consultarPaciente,
  createSolicitud,
  formatFecha,
  listSolicitudes,
  registerPaciente,
} from "../../registro/store";
import { getPatientSession, setPatientSession } from "../../registro/session";
import type { SolicitudAyuda } from "../../registro/models";
import { shareLinks, shareSite, shareSolicitud } from "../../services/share";
import {
  formatCoords,
  getCurrentPosition,
  googleMapsUrl,
  openStreetMapEmbedUrl,
  openStreetMapUrl,
} from "../../services/geolocation";
import { bindNavButtons, page } from "../helpers";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function zonaOptions(selected = ""): string {
  return ZONAS_AFECTADAS.map(
    (z) => `<option value="${z}" ${selected === z ? "selected" : ""}>${z}</option>`,
  ).join("");
}

function geoBlock(s: SolicitudAyuda): string {
  if (s.lat == null || s.lng == null) return "";
  const lat = s.lat;
  const lng = s.lng;
  return `
    <div class="geo-block">
      <button type="button" class="btn btn-ghost btn-sm btn-geo-view" data-geo-id="${s.id}">📍 Ver ubicación GPS</button>
      <div class="geo-panel" id="geo-panel-${s.id}" hidden>
        <p class="geo-coords"><strong>Coordenadas:</strong> ${formatCoords(lat, lng)}</p>
        <div class="geo-map-links">
          <a class="share-btn" href="${openStreetMapUrl(lat, lng)}" target="_blank" rel="noopener">OpenStreetMap</a>
          <a class="share-btn" href="${googleMapsUrl(lat, lng)}" target="_blank" rel="noopener">Google Maps</a>
        </div>
        <iframe
          class="geo-map-embed"
          title="Mapa de ubicación"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          src="${openStreetMapEmbedUrl(lat, lng)}"
        ></iframe>
      </div>
    </div>
  `;
}

function solicitudCard(s: SolicitudAyuda): string {
  return `
    <article class="mural-card" id="solicitud-${s.id}">
      <header class="mural-card-header">
        <strong>${escapeHtml(s.patientNombre)}</strong>
        <span class="mural-zona">📍 ${escapeHtml(s.zona)}</span>
      </header>
      <p class="mural-body">${escapeHtml(s.necesidad)}</p>
      ${geoBlock(s)}
      <footer class="mural-footer">
        <time class="muted">${formatFecha(s.createdAt)}</time>
        ${shareLinks(s)}
      </footer>
    </article>
  `;
}

function bindGeoViewButtons(root: HTMLElement): void {
  root.querySelectorAll(".btn-geo-view").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-geo-id");
      if (!id) return;
      const panel = root.querySelector(`#geo-panel-${id}`) as HTMLElement | null;
      if (!panel) return;
      const open = panel.hidden;
      root.querySelectorAll(".geo-panel").forEach((p) => ((p as HTMLElement).hidden = true));
      panel.hidden = !open;
      btn.textContent = open ? "Ocultar ubicación" : "📍 Ver ubicación GPS";
    });
  });
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
      bindGeoViewButtons(feed);
    })
    .catch((err) => {
      feed.innerHTML = `<p class="status-badge status-error">${escapeHtml(err instanceof Error ? err.message : "Error")}</p>`;
    });
}

function registroRapidoForm(): string {
  return `
    <form class="form" id="form-registro-rapido">
      <div class="grid-2">
        <label>Nombre completo<input name="nombre" required /></label>
        <label>Cédula<input name="cedula" required placeholder="V-12345678" /></label>
        <label>Edad<input name="edad" type="number" min="0" max="120" required /></label>
        <label>Fecha de nacimiento<input name="fechaNacimiento" type="date" required /></label>
        <label>Sexo
          <select name="sexo" class="input-select" required>
            <option value="">Seleccione…</option>
            <option value="Femenino">Femenino</option>
            <option value="Masculino">Masculino</option>
          </select>
        </label>
        <label>Teléfono<input name="telefono" type="tel" required placeholder="0412…" /></label>
        <label class="grid-full">Correo<input name="correo" type="email" required /></label>
      </div>
      <p class="muted">Sus datos se guardan en la base de datos al registrarse.</p>
      <div class="compose-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancelar-registro">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar y continuar</button>
      </div>
    </form>
  `;
}

function ingresoCedulaForm(): string {
  return `
    <form class="form" id="form-ingreso-cedula">
      <label>Cédula<input name="cedula" required placeholder="V-12345678" /></label>
      <p class="muted">Si ya se registró antes, ingrese solo su cédula.</p>
      <div class="compose-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancelar-ingreso">Cancelar</button>
        <button type="submit" class="btn btn-primary">Ingresar</button>
      </div>
    </form>
  `;
}

function composeLoggedIn(nombre: string): string {
  return `
    <form class="form mural-compose" id="form-solicitud">
      <div class="compose-header">
        <h2 class="compose-title">Publicar solicitud</h2>
        <p class="muted">Como <strong>${escapeHtml(nombre)}</strong> · <a href="#/paciente">Mi cuenta</a></p>
      </div>
      <label>Zona donde se encuentra
        <select name="zona" class="input-select" required>${zonaOptions()}</select>
      </label>
      <label>Necesidad / situación
        <textarea name="necesidad" rows="4" required placeholder="Describa qué necesita o qué padece…"></textarea>
      </label>
      <div class="geo-row">
        <button type="button" class="btn btn-ghost btn-sm" id="btn-geo">📍 Usar mi ubicación actual</button>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-geo-clear" hidden>Quitar ubicación</button>
        <input type="hidden" name="lat" id="geo-lat" />
        <input type="hidden" name="lng" id="geo-lng" />
        <p class="muted geo-status" id="geo-status">Opcional: adjunte coordenadas GPS para ubicarle con más precisión.</p>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Publicar solicitud</button>
    </form>
  `;
}

function composeGuest(): string {
  return `
    <div class="mural-compose mural-compose-guest" id="compose-guest">
      <div class="compose-header">
        <h2 class="compose-title">Solicitar ayuda</h2>
        <p class="muted">Regístrese para publicar en el muro. El feed es público para todos.</p>
      </div>
      <div class="compose-locked">
        <label>Zona donde se encuentra
          <select class="input-select" disabled aria-disabled="true">
            <option>Seleccione su zona…</option>
            ${zonaOptions()}
          </select>
        </label>
        <label>Necesidad / situación
          <textarea rows="4" disabled placeholder="Describa qué necesita o qué padece…" aria-disabled="true"></textarea>
        </label>
      </div>
      <div class="compose-actions" id="compose-guest-actions">
        <button type="button" class="btn btn-primary" id="btn-registro-rapido">Registro rápido</button>
        <button type="button" class="btn btn-ghost" id="btn-ya-registrado">Ya estoy registrado</button>
      </div>
      <div id="compose-guest-panel" class="compose-guest-panel" hidden></div>
    </div>
  `;
}

function clearGeoFields(root: HTMLElement): void {
  const lat = root.querySelector("#geo-lat") as HTMLInputElement | null;
  const lng = root.querySelector("#geo-lng") as HTMLInputElement | null;
  const status = root.querySelector("#geo-status") as HTMLElement | null;
  const clearBtn = root.querySelector("#btn-geo-clear") as HTMLButtonElement | null;
  if (lat) lat.value = "";
  if (lng) lng.value = "";
  if (status) status.textContent = "Opcional: adjunte coordenadas GPS para ubicarle con más precisión.";
  if (clearBtn) clearBtn.hidden = true;
}

function bindGeoCapture(root: HTMLElement): void {
  const btn = root.querySelector("#btn-geo") as HTMLButtonElement | null;
  const clearBtn = root.querySelector("#btn-geo-clear") as HTMLButtonElement | null;
  const lat = root.querySelector("#geo-lat") as HTMLInputElement | null;
  const lng = root.querySelector("#geo-lng") as HTMLInputElement | null;
  const status = root.querySelector("#geo-status") as HTMLElement | null;
  if (!btn || !lat || !lng || !status) return;

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    status.textContent = "Obteniendo ubicación…";
    try {
      const pos = await getCurrentPosition();
      lat.value = String(pos.lat);
      lng.value = String(pos.lng);
      const acc = pos.accuracy ? ` (±${Math.round(pos.accuracy)} m)` : "";
      status.textContent = `Ubicación capturada: ${formatCoords(pos.lat, pos.lng)}${acc}`;
      if (clearBtn) clearBtn.hidden = false;
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : "No se pudo obtener ubicación";
    } finally {
      btn.disabled = false;
    }
  });

  clearBtn?.addEventListener("click", () => clearGeoFields(root));
}

function renderComposeArea(root: HTMLElement, getFiltro: () => string): void {
  const slot = root.querySelector("#mural-compose-slot") as HTMLElement;
  const session = getPatientSession();
  slot.innerHTML = session ? composeLoggedIn(session.nombre) : composeGuest();

  if (session) {
    bindGeoCapture(slot);
    slot.querySelector("#form-solicitud")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const s = getPatientSession();
      if (!s) return;
      const fd = new FormData(e.target as HTMLFormElement);
      const latRaw = String(fd.get("lat"));
      const lngRaw = String(fd.get("lng"));
      const lat = latRaw ? Number(latRaw) : undefined;
      const lng = lngRaw ? Number(lngRaw) : undefined;
      try {
        await createSolicitud({
          patientCedula: s.cedula,
          patientNombre: s.nombre,
          zona: String(fd.get("zona")),
          necesidad: String(fd.get("necesidad")),
          lat: lat != null && !Number.isNaN(lat) ? lat : undefined,
          lng: lng != null && !Number.isNaN(lng) ? lng : undefined,
        });
        (e.target as HTMLFormElement).reset();
        clearGeoFields(slot);
        renderFeed(root, getFiltro());
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo publicar");
      }
    });
    return;
  }

  const panel = slot.querySelector("#compose-guest-panel") as HTMLElement;
  const actions = slot.querySelector("#compose-guest-actions") as HTMLElement;

  slot.querySelector("#btn-registro-rapido")?.addEventListener("click", () => {
    panel.hidden = false;
    panel.innerHTML = registroRapidoForm();
    actions.hidden = true;
    bindRegistroRapido(root, panel, actions, getFiltro);
  });

  slot.querySelector("#btn-ya-registrado")?.addEventListener("click", () => {
    panel.hidden = false;
    panel.innerHTML = ingresoCedulaForm();
    actions.hidden = true;
    bindIngresoCedula(root, panel, actions, getFiltro);
  });
}

function bindRegistroRapido(
  root: HTMLElement,
  panel: HTMLElement,
  actions: HTMLElement,
  getFiltro: () => string,
): void {
  panel.querySelector("#btn-cancelar-registro")?.addEventListener("click", () => {
    panel.hidden = true;
    panel.innerHTML = "";
    actions.hidden = false;
  });

  panel.querySelector("#form-registro-rapido")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const btn = (e.target as HTMLFormElement).querySelector('[type="submit"]') as HTMLButtonElement;
    btn.disabled = true;
    try {
      const p = await registerPaciente({
        cedula: String(fd.get("cedula")),
        nombre: String(fd.get("nombre")),
        edad: Number(fd.get("edad")),
        fechaNacimiento: String(fd.get("fechaNacimiento")),
        sexo: String(fd.get("sexo")),
        telefono: String(fd.get("telefono")),
        correo: String(fd.get("correo")),
      });
      setPatientSession({ cedula: p.cedula, nombre: p.nombre });
      renderComposeArea(root, getFiltro);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al registrar");
      btn.disabled = false;
    }
  });
}

function bindIngresoCedula(
  root: HTMLElement,
  panel: HTMLElement,
  actions: HTMLElement,
  getFiltro: () => string,
): void {
  panel.querySelector("#btn-cancelar-ingreso")?.addEventListener("click", () => {
    panel.hidden = true;
    panel.innerHTML = "";
    actions.hidden = false;
  });

  panel.querySelector("#form-ingreso-cedula")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      const p = await consultarPaciente(String(fd.get("cedula")));
      setPatientSession({ cedula: p.cedula, nombre: p.nombre });
      renderComposeArea(root, getFiltro);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No hay registro con esa cédula");
    }
  });
}

registerRoute({
  path: "/ayudame",
  title: "Ayúdame",
  nav: true,
  navLabel: "Ayúdame",
  render: () => {
    const el = page(
      "Muro de ayuda",
      `
      <p class="lead">Zonas afectadas: Caracas, litoral de La Guaira, Catia La Mar, Tanaguarena, Morón, Tucacas y alrededores.</p>
      <div class="mural-toolbar card-panel mural-filter">
        <div class="filter-field">
          <span class="filter-field-icon" aria-hidden="true">📍</span>
          <label class="filter-label-wrap">
            <span class="filter-label">Filtrar por zona</span>
            <select id="filtro-zona" class="input-select">
              <option value="">Todas las zonas</option>
              ${zonaOptions()}
            </select>
          </label>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-share-site">Compartir muro</button>
      </div>
      <div id="mural-compose-slot"></div>
      <div id="mural-feed" class="mural-feed"></div>
      <p class="muted mural-links">
        <a href="#/profesional">Soy profesional de salud</a> ·
        <a href="#/acerca-de">Acerca de</a>
      </p>
      `,
    );

    const filtro = el.querySelector("#filtro-zona") as HTMLSelectElement;
    const getFiltro = () => filtro?.value ?? "";

    renderComposeArea(el, getFiltro);
    renderFeed(el, getFiltro());
    filtro?.addEventListener("change", () => renderFeed(el, getFiltro()));

    el.querySelector("#btn-share-site")?.addEventListener("click", () => shareSite());

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
      bindGeoViewButtons(box);
    });
    return el;
  },
});
