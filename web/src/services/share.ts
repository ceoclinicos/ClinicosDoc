/** Compartir solicitud — diálogo nativo del dispositivo (Web Share API) */
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

  const fallback = `${text}`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(fallback).then(() => {
      alert("Texto copiado. Péguelo donde quiera compartir.");
    });
    return;
  }

  window.open(`https://wa.me/?text=${encodeURIComponent(fallback)}`, "_blank", "noopener,noreferrer");
}

/** Icono «compartir» estándar (tres nodos conectados) */
const SVG_SHARE =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>';

export function shareButton(s: { id: string }): string {
  return `
    <button type="button" class="icon-btn icon-btn-share" data-share-id="${s.id}" aria-label="Compartir">
      ${SVG_SHARE}
    </button>
  `;
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
  root.querySelectorAll("[data-share-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-share-id");
      const card = root.querySelector(`#solicitud-${id}`);
      if (!id || !card) return;
      shareSolicitud(getCardShareData(card, id));
    });
  });
}
