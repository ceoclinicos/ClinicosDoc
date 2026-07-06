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
  const text = `${s.patientNombre} en ${s.zona} necesita ayuda: ${s.necesidad.slice(0, 120)}… ${url}`;
  return { url, text, enc: encodeURIComponent(text) };
}

const SVG_SHARE =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';

const SVG_WA =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 0 0 .614.614l4.458-1.495A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>';

const SVG_X =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';

const SVG_THREADS =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 11.74c-.033-2.286-1.449-3.603-4.02-3.78-.92-.063-1.797-.02-2.604.13-.054.01-.108.02-.16.03v3.63c.052.01.106.02.16.03.807.15 1.684.193 2.604.13 2.571-.177 3.987-1.494 4.02-3.78.033-2.31-1.47-3.7-4.02-3.877-.92-.063-1.797-.02-2.604.13V8.01c.807-.15 1.684-.193 2.604-.13 2.55.177 4.053 1.567 4.02 3.877z"/></svg>';

export function shareActions(s: {
  patientNombre: string;
  zona: string;
  necesidad: string;
  id: string;
}): string {
  const { enc } = sharePayload(s);
  return `
    <div class="share-wrap">
      <button type="button" class="icon-btn" data-share-toggle="${s.id}" aria-label="Compartir solicitud">
        ${SVG_SHARE}
      </button>
      <div class="share-popover" id="share-pop-${s.id}" hidden>
        <button type="button" class="icon-btn" data-share-id="${s.id}" aria-label="Compartir">
          ${SVG_SHARE}
        </button>
        <a class="icon-btn" href="https://wa.me/?text=${enc}" target="_blank" rel="noopener" aria-label="WhatsApp">
          ${SVG_WA}
        </a>
        <a class="icon-btn" href="https://twitter.com/intent/tweet?text=${enc}" target="_blank" rel="noopener" aria-label="X">
          ${SVG_X}
        </a>
        <a class="icon-btn" href="https://www.threads.net/intent/post?text=${enc}" target="_blank" rel="noopener" aria-label="Threads">
          ${SVG_THREADS}
        </a>
      </div>
    </div>
  `;
}

export function bindShareActions(root: HTMLElement): void {
  root.querySelectorAll("[data-share-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-share-id");
      const card = root.querySelector(`#solicitud-${id}`);
      if (!id || !card) return;
      const nombre = card.querySelector("strong")?.textContent ?? "";
      const zona = card.querySelector(".mural-zona")?.textContent?.replace("📍 ", "") ?? "";
      const necesidad = card.querySelector(".mural-body")?.textContent ?? "";
      shareSolicitud({ id, patientNombre: nombre, zona, necesidad });
      root.querySelectorAll(".share-popover").forEach((p) => ((p as HTMLElement).hidden = true));
    });
  });

  root.querySelectorAll("[data-share-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-share-toggle");
      if (!id) return;
      const pop = root.querySelector(`#share-pop-${id}`) as HTMLElement | null;
      if (!pop) return;
      const willOpen = pop.hidden;
      root.querySelectorAll(".share-popover").forEach((p) => ((p as HTMLElement).hidden = true));
      pop.hidden = !willOpen;
    });
  });

  if (!root.dataset.shareBound) {
    root.dataset.shareBound = "1";
    document.addEventListener("click", () => {
      root.querySelectorAll(".share-popover").forEach((p) => ((p as HTMLElement).hidden = true));
    });
  }
}
