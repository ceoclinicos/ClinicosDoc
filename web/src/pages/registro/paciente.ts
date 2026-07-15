import { registerRoute, navigate } from "../../app/router";
import {
  getPatientSession,
  clearPatientSession,
  setPatientSession,
} from "../../registro/session";
import { loginPaciente, registerPaciente } from "../../registro/store";
import {
  bindBirthDateSelects,
  birthDateFieldsHtml,
  parseBirthFromForm,
} from "../../services/birth-date";
import {
  TIPOS_SANGRE,
  emergenciaPublicUrl,
  getFichaByCedula,
  upsertFichaEmergencia,
  type EmergencyContact,
  type FichaEmergencia,
} from "../../services/emergency-ficha";
import {
  buildEmergencyQrDataUrl,
  buildEmergencyWallpaperBlob,
  buildEmergencyCardBlob,
  downloadBlob,
  printEmergencyCardPdf,
  shareEmergencyCard,
  shareTextWhatsApp,
} from "../../services/emergency-qr";
import { bindNavButtons, page } from "../helpers";

function tabs(active: "entrar" | "registro"): string {
  return `
    <div class="tab-row">
      <button type="button" class="tab ${active === "entrar" ? "active" : ""}" data-tab="entrar">Entrar</button>
      <button type="button" class="tab ${active === "registro" ? "active" : ""}" data-tab="registro">Registrarme</button>
    </div>
  `;
}

function bloodOptions(selected = ""): string {
  return TIPOS_SANGRE.map(
    (t) => `<option value="${t}" ${t === selected ? "selected" : ""}>${t}</option>`,
  ).join("");
}

function contactRowsHtml(contacts: EmergencyContact[]): string {
  const list = contacts.length ? contacts : [{ nombre: "", telefono: "", parentesco: "" }];
  return list
    .map(
      (c, i) => `
    <div class="card-panel contact-row" data-cidx="${i}">
      <label>Nombre contacto ${i + 1}<input name="cNombre${i}" value="${escapeAttr(c.nombre)}" /></label>
      <label>Teléfono<input name="cTel${i}" type="tel" value="${escapeAttr(c.telefono)}" /></label>
      <label>Parentesco<input name="cPar${i}" value="${escapeAttr(c.parentesco)}" placeholder="Madre, esposo…" /></label>
    </div>`,
    )
    .join("");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

async function mountFichaEditor(root: HTMLElement, cedula: string, nombre: string): Promise<void> {
  root.innerHTML = `<p class="muted">Cargando ficha…</p>`;
  let ficha: FichaEmergencia | null = null;
  try {
    ficha = await getFichaByCedula(cedula);
  } catch (err) {
    root.innerHTML = `<p class="status-badge status-error">${err instanceof Error ? err.message : "Error"}</p>`;
    return;
  }

  const contacts = ficha?.contactos?.length ? ficha.contactos : [{ nombre: "", telefono: "", parentesco: "" }];

  root.innerHTML = `
    <div class="card-panel emergency-intro">
      <h2>Ficha Médica de Emergencia</h2>
      <p class="muted">Responda las preguntas médicas. Al guardar podrá compartir la tarjeta (tamaño cédula ~9×6 cm) como publicación en Instagram o WhatsApp.</p>
    </div>
    <form class="form" id="ficha-form">
      <label>Nombre<input name="nombre" required value="${escapeAttr(ficha?.nombre || nombre)}" /></label>
      <label>Tipo de sangre
        <select name="tipoSangre" required>${bloodOptions(ficha?.tipoSangre || "")}</select>
      </label>
      <label>¿Es alérgico a algún medicamento o alimento?
        <textarea name="alergias" rows="2" placeholder="Ej. Penicilina, mariscos… Si no, indique Ninguna">${escapeAttr(ficha?.alergias || "")}</textarea>
      </label>
      <label>¿Padece usted alguna enfermedad de base como hipertensión arterial, diabetes mellitus u otra?
        <textarea name="condiciones" rows="2" placeholder="Ej. Hipertensión, diabetes… Si no, indique Ninguna">${escapeAttr(ficha?.condiciones || "")}</textarea>
      </label>
      <label>¿Toma usted algún tipo de tratamiento actualmente para alguna enfermedad o suplementario?
        <textarea name="medicamentos" rows="2" placeholder="Ej. Metformina, vitamina D… Si no, indique Ninguno">${escapeAttr(ficha?.medicamentos || "")}</textarea>
      </label>
      <h3 class="home-section-title">Contactos de emergencia</h3>
      <div id="contacts-box">${contactRowsHtml(contacts)}</div>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-add-contact">+ Otro contacto</button>
      <label class="check-row disclaimer-check">
        <input type="checkbox" name="declaracionFe" value="1" required ${ficha?.declaracionFe ? "checked" : ""} />
        <span>Doy fe como usuario de esta tarjeta médica de emergencia que los datos aportados son reales y rellenados por mi persona.</span>
      </label>
      <button type="submit" class="btn btn-primary">Guardar ficha</button>
    </form>
    <div id="ficha-actions" class="stack" style="margin-top:1rem" hidden>
      <p class="status-badge status-ok">Ficha lista</p>
      <p class="muted" id="ficha-url"></p>
      <img id="ficha-qr" alt="Código QR de emergencia" class="emergency-qr-img" width="220" height="220" />
      <button type="button" class="btn btn-primary" id="btn-dl-pdf">Imprimir / PDF tarjeta (9×6 cm)</button>
      <button type="button" class="btn btn-secondary" id="btn-dl-card">Descargar tarjeta PNG</button>
      <button type="button" class="btn btn-ghost" id="btn-dl-qr">Descargar QR</button>
      <button type="button" class="btn btn-ghost" id="btn-dl-wallpaper">Fondo de pantalla</button>
      <a class="btn btn-ghost" id="ficha-preview-link" href="#">Ver ficha pública</a>
    </div>
    <dialog id="share-dialog">
      <div class="form share-ficha-dialog">
        <h2>¡Ficha guardada!</h2>
        <p><strong>Compártela como publicación principal</strong> en Instagram o WhatsApp para que tu familia sepa escanear el QR en una emergencia.</p>
        <img id="share-card-preview" alt="Vista previa tarjeta" class="share-card-preview" hidden />
        <div class="stack">
          <button type="button" class="btn btn-primary" id="btn-share-wa">Compartir en WhatsApp</button>
          <button type="button" class="btn btn-secondary" id="btn-share-native">Compartir (Instagram / otras apps)</button>
          <button type="button" class="btn btn-ghost" id="btn-share-pdf">Imprimir / PDF (9×6 cm)</button>
          <button type="button" class="btn btn-ghost" id="btn-share-close">Cerrar</button>
        </div>
        <p class="muted" style="margin-top:0.75rem">En Instagram: descarga la tarjeta PNG y publícala como post principal o historia.</p>
      </div>
    </dialog>
  `;

  let contactCount = contacts.length;
  root.querySelector("#btn-add-contact")?.addEventListener("click", () => {
    if (contactCount >= 5) {
      alert("Máximo 5 contactos");
      return;
    }
    const box = root.querySelector("#contacts-box") as HTMLElement;
    const i = contactCount++;
    box.insertAdjacentHTML(
      "beforeend",
      `
    <div class="card-panel contact-row" data-cidx="${i}">
      <label>Nombre contacto ${i + 1}<input name="cNombre${i}" value="" /></label>
      <label>Teléfono<input name="cTel${i}" type="tel" value="" /></label>
      <label>Parentesco<input name="cPar${i}" value="" placeholder="Madre, esposo…" /></label>
    </div>`,
    );
  });

  let lastQr = "";
  let lastSaved: FichaEmergencia | null = null;
  let lastCardBlob: Blob | null = null;

  const shareDialog = root.querySelector("#share-dialog") as HTMLDialogElement;

  async function prepareCard(saved: FichaEmergencia): Promise<Blob> {
    lastCardBlob = await buildEmergencyCardBlob(saved);
    const preview = root.querySelector("#share-card-preview") as HTMLImageElement;
    preview.src = URL.createObjectURL(lastCardBlob);
    preview.hidden = false;
    return lastCardBlob;
  }

  async function openSharePrompt(saved: FichaEmergencia): Promise<void> {
    try {
      await prepareCard(saved);
    } catch {
      /* preview opcional */
    }
    shareDialog.showModal();
  }

  root.querySelector("#btn-dl-qr")?.addEventListener("click", () => {
    if (!lastQr || !lastSaved) return;
    const a = document.createElement("a");
    a.href = lastQr;
    a.download = `qr-emergencia-${lastSaved.publicId}.png`;
    a.click();
  });

  root.querySelector("#btn-dl-wallpaper")?.addEventListener("click", async () => {
    if (!lastSaved) return;
    try {
      const blob = await buildEmergencyWallpaperBlob(lastSaved);
      downloadBlob(blob, `fondo-emergencia-${lastSaved.publicId}.png`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo generar el fondo");
    }
  });

  root.querySelector("#btn-dl-card")?.addEventListener("click", async () => {
    if (!lastSaved) return;
    try {
      const blob = lastCardBlob ?? (await buildEmergencyCardBlob(lastSaved));
      lastCardBlob = blob;
      downloadBlob(blob, `tarjeta-emergencia-${lastSaved.publicId}.png`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo generar la tarjeta");
    }
  });

  root.querySelector("#btn-dl-pdf")?.addEventListener("click", async () => {
    if (!lastSaved) return;
    try {
      await printEmergencyCardPdf(lastSaved);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo abrir el PDF");
    }
  });

  root.querySelector("#btn-share-wa")?.addEventListener("click", async () => {
    if (!lastSaved) return;
    const url = emergenciaPublicUrl(lastSaved.publicId);
    const text =
      `Mi tarjeta médica de emergencia (Clínicos Doc)\n` +
      `${url}\n` +
      `Compártela también como publicación principal en Instagram.`;
    if (lastCardBlob) {
      downloadBlob(lastCardBlob, `tarjeta-emergencia-${lastSaved.publicId}.png`);
    }
    shareTextWhatsApp(text);
  });

  root.querySelector("#btn-share-native")?.addEventListener("click", async () => {
    if (!lastSaved) return;
    try {
      const blob = lastCardBlob ?? (await prepareCard(lastSaved));
      const result = await shareEmergencyCard(lastSaved, blob);
      if (result === "copied") {
        alert("Texto copiado. En Instagram: descarga la tarjeta PNG y publícala como post principal.");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo compartir");
    }
  });

  root.querySelector("#btn-share-pdf")?.addEventListener("click", async () => {
    if (!lastSaved) return;
    try {
      await printEmergencyCardPdf(lastSaved);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo abrir el PDF");
    }
  });

  root.querySelector("#btn-share-close")?.addEventListener("click", () => shareDialog.close());

  async function refreshQrUi(saved: FichaEmergencia): Promise<void> {
    lastSaved = saved;
    const actions = root.querySelector("#ficha-actions") as HTMLElement;
    const url = emergenciaPublicUrl(saved.publicId);
    actions.hidden = false;
    (root.querySelector("#ficha-url") as HTMLElement).textContent = url;
    (root.querySelector("#ficha-preview-link") as HTMLAnchorElement).href = `#/emergencia/${saved.publicId}`;
    lastQr = await buildEmergencyQrDataUrl(saved.publicId, 440);
    (root.querySelector("#ficha-qr") as HTMLImageElement).src = lastQr;
  }

  if (ficha) await refreshQrUi(ficha);

  root.querySelector("#ficha-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    if (fd.get("declaracionFe") !== "1") {
      alert("Debe marcar la declaración de veracidad de los datos.");
      return;
    }
    const contactos: EmergencyContact[] = [];
    for (let i = 0; i < 8; i++) {
      const n = String(fd.get(`cNombre${i}`) ?? "").trim();
      const t = String(fd.get(`cTel${i}`) ?? "").trim();
      if (!n && !t) continue;
      contactos.push({
        nombre: n,
        telefono: t,
        parentesco: String(fd.get(`cPar${i}`) ?? "").trim(),
      });
    }
    try {
      const saved = await upsertFichaEmergencia({
        patientCedula: cedula,
        nombre: String(fd.get("nombre")),
        tipoSangre: String(fd.get("tipoSangre")),
        alergias: String(fd.get("alergias")),
        condiciones: String(fd.get("condiciones")),
        medicamentos: String(fd.get("medicamentos")),
        contactos,
        existingPublicId: ficha?.publicId,
        declaracionFe: true,
      });
      ficha = saved;
      await refreshQrUi(saved);
      await openSharePrompt(saved);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar");
    }
  });
}

function bindPacientePage(el: HTMLElement): void {
  const session = getPatientSession();
  if (!session) {
    let mode: "entrar" | "registro" = "entrar";
    const body = el.querySelector(".page-body") as HTMLElement;

    const renderAuth = (): void => {
      body.innerHTML =
        mode === "entrar"
          ? `
          ${tabs("entrar")}
          <form class="form" id="pac-login">
            <label>Cédula<input name="cedula" required placeholder="Ej. V-12345678" /></label>
            <label>PIN (contraseña, 4 dígitos)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required /></label>
            <p class="muted"><a href="#/olvide-pin">Olvidé mi PIN (contraseña)</a></p>
            <button type="submit" class="btn btn-primary">Entrar</button>
          </form>
        `
          : `
          ${tabs("registro")}
          <form class="form" id="pac-registro">
            <label>Nombre completo<input name="nombre" required /></label>
            <label>Cédula<input name="cedula" required /></label>
            <label>Sexo
              <select name="sexo" required>
                <option value="">Seleccione…</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
              </select>
            </label>
            ${birthDateFieldsHtml("nac")}
            <p class="muted">La edad se calcula con la fecha de nacimiento.</p>
            <label>Teléfono<input name="telefono" type="tel" required placeholder="0412…" /></label>
            <label>Correo<input name="correo" type="email" required /></label>
            <label>PIN (contraseña, 4 dígitos)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required /></label>
            <button type="submit" class="btn btn-primary">Registrarme</button>
          </form>
        `;

      body.querySelectorAll("[data-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          mode = btn.getAttribute("data-tab") as "entrar" | "registro";
          renderAuth();
        });
      });

      if (mode === "registro") bindBirthDateSelects(body, "nac");

      body.querySelector("#pac-login")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        try {
          const p = await loginPaciente(String(fd.get("cedula")), String(fd.get("pin")));
          setPatientSession({ cedula: p.cedula, nombre: p.nombre });
          navigate("/paciente");
        } catch (err) {
          alert(err instanceof Error ? err.message : "Error");
        }
      });

      body.querySelector("#pac-registro")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target as HTMLFormElement);
        try {
          const birth = parseBirthFromForm(fd, "nac");
          const p = await registerPaciente({
            cedula: String(fd.get("cedula")),
            nombre: String(fd.get("nombre")),
            edad: birth.age,
            fechaNacimiento: birth.iso.slice(0, 10),
            sexo: String(fd.get("sexo")),
            telefono: String(fd.get("telefono")),
            correo: String(fd.get("correo")),
            pin: String(fd.get("pin")),
          });
          setPatientSession({ cedula: p.cedula, nombre: p.nombre });
          navigate("/paciente");
        } catch (err) {
          alert(err instanceof Error ? err.message : "Error al registrar");
        }
      });
    };
    renderAuth();
    return;
  }

  el.querySelector("#btn-logout")?.addEventListener("click", () => {
    clearPatientSession();
    navigate("/paciente");
  });

  const slot = el.querySelector("#ficha-slot") as HTMLElement;
  void mountFichaEditor(slot, session.cedula, session.nombre);
  bindNavButtons(el);
}

registerRoute({
  path: "/paciente",
  title: "Mi ficha",
  nav: false,
  render: () => {
    const session = getPatientSession();
    const el = page(
      session ? `Hola, ${session.nombre.split(" ")[0]}` : "Portal del paciente",
      session
        ? `
        <p class="lead">Aquí gestiona su ficha de emergencia. Para pedir ayuda comunitaria use <strong>Ayudemos</strong> (sin ver informes médicos).</p>
        <div class="grid-2" style="margin-bottom:1rem">
          <button type="button" class="tile" data-nav="/ayudemos">Ir a Ayudemos</button>
        </div>
        <div id="ficha-slot"></div>
      `
        : `
        <p class="lead">Regístrese para crear su ficha de emergencia (QR) y publicar en Ayudemos.</p>
        ${tabs("entrar")}
        <form class="form" id="pac-login">
          <label>Cédula<input name="cedula" required placeholder="Ej. V-12345678" /></label>
          <label>PIN (contraseña, 4 dígitos)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" required /></label>
          <p class="muted"><a href="#/olvide-pin">Olvidé mi PIN (contraseña)</a></p>
          <button type="submit" class="btn btn-primary">Entrar</button>
        </form>
      `,
      session ? `<button type="button" class="btn btn-ghost btn-sm" id="btn-logout">Salir</button>` : "",
    );
    bindPacientePage(el);
    return el;
  },
});
