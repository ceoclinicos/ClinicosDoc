/** Compartir solicitud en redes sociales */
export function shareSolicitud(s: {
  patientNombre: string;
  zona: string;
  necesidad: string;
  id: string;
}): void {
  const url = `${window.location.origin}${window.location.pathname}#/solicitud/${s.id}`;
  const text = `🆘 ${s.patientNombre} · ${s.zona}\n${s.necesidad}\n\n#Venezuela #AyudaHumanitaria\n${url}`;
  const title = "Solicitud de ayuda — Clínicos Doc";

  if (navigator.share) {
    navigator.share({ title, text, url }).catch(() => {});
    return;
  }

  const enc = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${enc}`, "_blank", "noopener,noreferrer");
}

function sharePayload(s: { patientNombre: string; zona: string; necesidad: string; id: string }) {
  const url = `${window.location.origin}${window.location.pathname}#/solicitud/${s.id}`;
  const short = s.necesidad.length > 120 ? `${s.necesidad.slice(0, 120)}…` : s.necesidad;
  const text = `${s.patientNombre} en ${s.zona} necesita ayuda: ${short} ${url}`;
  return { url, text, enc: encodeURIComponent(text) };
}

const SVG_SHARE =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';

export function shareButton(s: { id: string }): string {
  return `
    <button type="button" class="icon-btn" data-share-toggle="${s.id}" aria-label="Compartir solicitud" aria-expanded="false">
      ${SVG_SHARE}
    </button>
  `;
}

export function shareMenu(s: {
  patientNombre: string;
  zona: string;
  necesidad: string;
  id: string;
}): string {
  const { enc } = sharePayload(s);
  const hasNative = typeof navigator !== "undefined" && !!navigator.share;
  return `
    <div class="share-menu" id="share-menu-${s.id}" hidden role="menu" aria-label="Opciones para compartir">
      ${hasNative ? `<button type="button" class="share-menu-item" role="menuitem" data-share-native="${s.id}">Compartir…</button>` : ""}
      <a class="share-menu-item" role="menuitem" href="https://wa.me/?text=${enc}" target="_blank" rel="noopener" data-share-close>WhatsApp</a>
      <a class="share-menu-item" role="menuitem" href="https://twitter.com/intent/tweet?text=${enc}" target="_blank" rel="noopener" data-share-close>X</a>
      <a class="share-menu-item" role="menuitem" href="https://www.threads.net/intent/post?text=${enc}" target="_blank" rel="noopener" data-share-close>Threads</a>
    </div>
  `;
}

function closeAllShareMenus(root: HTMLElement): void {
  root.querySelectorAll(".share-menu").forEach((m) => {
    (m as HTMLElement).hidden = true;
  });
  root.querySelectorAll("[data-share-toggle]").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
    btn.classList.remove("icon-btn-active");
  });
}

function getCardShareData(card: Element, id: string) {
  return {
    id,
    patientNombre: card.querySelector("strong")?.textContent ?? "",
    zona: card.querySelector(".mural-zona")?.textContent ?? "",
    necesidad: card.querySelector(".mural-body")?.textContent ?? "",
  };
}

export function bindShareActions(root: HTMLElement): void {
  root.querySelectorAll("[data-share-native]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-share-native");
      const card = root.querySelector(`#solicitud-${id}`);
      if (!id || !card) return;
      shareSolicitud(getCardShareData(card, id));
      closeAllShareMenus(root);
    });
  });

  root.querySelectorAll("[data-share-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-share-toggle");
      if (!id) return;
      const menu = root.querySelector(`#share-menu-${id}`) as HTMLElement | null;
      if (!menu) return;
      const willOpen = menu.hidden;
      closeAllShareMenus(root);
      if (willOpen) {
        menu.hidden = false;
        btn.setAttribute("aria-expanded", "true");
        btn.classList.add("icon-btn-active");
      }
    });
  });

  root.querySelectorAll("[data-share-close]").forEach((el) => {
    el.addEventListener("click", () => closeAllShareMenus(root));
  });

  if (!root.dataset.shareBound) {
    root.dataset.shareBound = "1";
    document.addEventListener("click", () => closeAllShareMenus(root));
  }
}
