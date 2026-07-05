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

export function shareSite(): void {
  const url = window.location.href.split("#")[0] + "#/ayudame";
  const text = "Muro de ayuda para zonas afectadas en Venezuela — Clínicos Doc";
  if (navigator.share) {
    navigator.share({ title: "Clínicos Doc — Ayúdame", text, url }).catch(() => {});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank");
  }
}

export function shareLinks(s: { patientNombre: string; zona: string; necesidad: string; id: string }): string {
  const url = `${window.location.origin}${window.location.pathname}#/solicitud/${s.id}`;
  const text = `${s.patientNombre} en ${s.zona} necesita ayuda: ${s.necesidad.slice(0, 120)}…`;
  const enc = encodeURIComponent(`${text} ${url}`);
  return `
    <div class="share-row">
      <a class="share-btn" href="https://wa.me/?text=${enc}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="share-btn" href="https://twitter.com/intent/tweet?text=${enc}" target="_blank" rel="noopener">X</a>
      <a class="share-btn" href="https://www.threads.net/intent/post?text=${enc}" target="_blank" rel="noopener">Threads</a>
      <button type="button" class="share-btn" data-share-id="${s.id}">Compartir</button>
    </div>
  `;
}
