import { registerRoute } from "../../app/router";
import { ZONAS_AFECTADAS } from "../../registro/models";
import {
  createSolicitud,
  formatFecha,
  listSolicitudes,
  loginPaciente,
  registerPaciente,
} from "../../registro/store";
import { getPatientSession, setPatientSession } from "../../registro/session";
import type { SolicitudAyuda } from "../../registro/models";
import { shareButton, bindShareActions } from "../../services/share";
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

const SVG_PIN =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

function geoPanel(s: SolicitudAyuda): string {
  if (s.lat == null || s.lng == null) return "";
  const lat = s.lat;
  const lng = s.lng;
  return `
      <div class="geo-panel" id="geo-panel-${s.id}" hidden>
        <p class="geo-coords">${formatCoords(lat, lng)}</p>
        <div class="geo-map-links">
          <a class="icon-btn" href="${openStreetMapUrl(lat, lng)}" target="_blank" rel="noopener" aria-label="OpenStreetMap">${SVG_PIN}</a>
          <a class="icon-btn" href="${googleMapsUrl(lat, lng)}" target="_blank" rel="noopener" aria-label="Google Maps">G</a>
        </div>
        <iframe class="geo-map-embed" title="Mapa" loading="lazy" src="${openStreetMapEmbedUrl(lat, lng)}"></iframe>
      </div>
  `;
}

function solicitudCard(s: SolicitudAyuda): string {
  const hasGeo = s.lat != null && s.lng != null;
  return `
    <article class="mural-card" id="solicitud-${s.id}">
      <header class="mural-card-header">
        <strong>${escapeHtml(s.patientNombre)}</strong>
        <span class="mural-zona">${escapeHtml(s.zona)}</span>
      </header>
      <p class="mural-body">${escapeHtml(s.necesidad)}</p>
      ${geoPanel(s)}
      <footer class="mural-footer">
        <div class="mural-footer-row">
          <time class="mural-time">${formatFecha(s.createdAt)}</time>
          <div class="mural-actions">
            ${hasGeo ? `<button type="button" class="icon-btn btn-geo-view" data-geo-id="${s.id}" aria-label="Ver ubicación">${SVG_PIN}</button>` : ""}
            ${shareButton(s)}
          </div>
        </div>
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
      btn.classList.toggle("icon-btn-active", !panel.hidden);
    });
  });
}

function bindShareButtons(root: HTMLElement): void {
  bindShareActions(root);
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

const MAX_PALABRAS = 400;

function contarPalabras(texto: string): number {
  const t = texto.trim();
  return t ? t.split(/\s+/).length : 0;
}

function recortarPalabras(texto: string, max: number): string {
  const partes = texto.trim().split(/\s+/);
  if (partes.length <= max || !texto.trim()) return texto;
  return partes.slice(0, max).join(" ");
}

function bindLimitePalabras(root: HTMLElement): void {
  const ta = root.querySelector<HTMLTextAreaElement>('textarea[name="necesidad"]');
  const counter = root.querySelector("#word-counter");
  if (!ta || !counter) return;

  const actualizar = (): void => {
    const n = contarPalabras(ta.value);
    if (n > MAX_PALABRAS) {
      ta.value = recortarPalabras(ta.value, MAX_PALABRAS);
    }
    const actual = contarPalabras(ta.value);
    counter.textContent = `${actual} / ${MAX_PALABRAS} palabras`;
    counter.classList.toggle("word-counter-limit", actual >= MAX_PALABRAS);
  };

  ta.addEventListener("input", actualizar);
  actualizar();
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
        <label class="grid-full">PIN (contraseña, 4 dígitos)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required /></label>
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
      <label>PIN (contraseña, 4 dígitos)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required /></label>
      <p class="muted"><a href="#/olvide-pin">Olvidé mi PIN (contraseña)</a></p>
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
      <h2 class="compose-title">Solicitar ayuda</h2>
      <p class="muted compose-user">Como <strong>${escapeHtml(nombre)}</strong> · <a href="#/paciente">Mi cuenta</a></p>
      <label class="compose-field">
        <span class="compose-label">Zona donde se encuentra</span>
        <select name="zona" class="input-select" required>${zonaOptions()}</select>
      </label>
      <div class="compose-field">
        <span class="compose-label">Necesidad / situación</span>
        <textarea
          class="compose-textarea"
          name="necesidad"
          rows="8"
          required
          placeholder="Describa con detalle qué necesita o qué padece…"
        ></textarea>
        <span class="word-counter" id="word-counter">0 / ${MAX_PALABRAS} palabras</span>
      </div>
      <div class="geo-row">
        <button type="button" class="btn btn-ghost btn-sm" id="btn-geo">📍 Usar mi ubicación actual</button>
        <button type="button" class="btn btn-ghost btn-sm" id="btn-geo-clear" hidden>Quitar ubicación</button>
        <input type="hidden" name="lat" id="geo-lat" />
        <input type="hidden" name="lng" id="geo-lng" />
        <p class="muted geo-status" id="geo-status">Opcional: adjunte coordenadas GPS.</p>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Publicar</button>
    </form>
  `;
}

function composeGuest(): string {
  return `
    <div class="mural-compose mural-compose-guest" id="compose-guest">
      <h2 class="compose-title">Solicitar ayuda</h2>
      <p class="compose-guest-msg">Regístrese para publicar en el muro.</p>
      <div class="compose-actions" id="compose-guest-actions">
        <button type="button" class="btn btn-primary" id="btn-registrar">Registrar</button>
        <button type="button" class="btn btn-ghost" id="btn-iniciar-sesion">Iniciar sesión</button>
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
  if (status) status.textContent = "Opcional: adjunte coordenadas GPS.";
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
    bindLimitePalabras(slot);
    slot.querySelector("#form-solicitud")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const s = getPatientSession();
      if (!s) return;
      const fd = new FormData(e.target as HTMLFormElement);
      const necesidad = String(fd.get("necesidad")).trim();
      if (!necesidad) {
        alert("Describa su necesidad o situación.");
        return;
      }
      if (contarPalabras(necesidad) > MAX_PALABRAS) {
        alert(`Máximo ${MAX_PALABRAS} palabras.`);
        return;
      }
      const latRaw = String(fd.get("lat"));
      const lngRaw = String(fd.get("lng"));
      const lat = latRaw ? Number(latRaw) : undefined;
      const lng = lngRaw ? Number(lngRaw) : undefined;
      try {
        await createSolicitud({
          patientCedula: s.cedula,
          patientNombre: s.nombre,
          zona: String(fd.get("zona")),
          necesidad,
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

  slot.querySelector("#btn-registrar")?.addEventListener("click", () => {
    panel.hidden = false;
    panel.innerHTML = registroRapidoForm();
    actions.hidden = true;
    bindRegistroRapido(root, panel, actions, getFiltro);
  });

  slot.querySelector("#btn-iniciar-sesion")?.addEventListener("click", () => {
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
        pin: String(fd.get("pin")),
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
      const p = await loginPaciente(String(fd.get("cedula")), String(fd.get("pin")));
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
