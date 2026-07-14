/** Compartir solicitud — imagen landscape + texto (Web Share API) */

type ShareSolicitudData = {
  patientNombre: string;
  zona: string;
  necesidad: string;
  id: string;
};

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.replace(/\s+\S*$/, "") + "…";
  }
  return lines;
}

/** Genera PNG horizontal blanco con el texto de la solicitud. */
export async function buildSolicitudShareImage(s: ShareSolicitudData): Promise<Blob> {
  const W = 1280;
  const H = 720;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el canvas");

  // Fondo blanco limpio
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Acento suave a la izquierda
  ctx.fillStyle = "#0d9488";
  ctx.fillRect(0, 0, 12, H);

  const padX = 72;
  const padTop = 64;
  const contentWidth = W - padX * 2 - 20;

  // Zona
  ctx.fillStyle = "#0d9488";
  ctx.font = "600 28px system-ui, Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText((s.zona || "Zona").toUpperCase(), padX, padTop);

  // Nombre
  ctx.fillStyle = "#0b1f33";
  ctx.font = "700 48px system-ui, Segoe UI, sans-serif";
  const nombreLines = wrapLines(ctx, s.patientNombre || "Solicitud de ayuda", contentWidth, 2);
  let y = padTop + 48;
  for (const line of nombreLines) {
    ctx.fillText(line, padX, y);
    y += 58;
  }

  // Separador
  y += 18;
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(W - padX, y);
  ctx.stroke();
  y += 36;

  // Necesidad
  ctx.fillStyle = "#334155";
  ctx.font = "400 34px system-ui, Segoe UI, sans-serif";
  const bodyLines = wrapLines(ctx, s.necesidad || "", contentWidth, 8);
  for (const line of bodyLines) {
    ctx.fillText(line, padX, y);
    y += 46;
  }

  // Pie: clinicosdoc.com esquina derecha
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 22px system-ui, Segoe UI, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("clinicosdoc.com", W - 48, H - 36);

  // Etiqueta suave izquierda pie
  ctx.textAlign = "left";
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "500 20px system-ui, Segoe UI, sans-serif";
  ctx.fillText("Ayúdame · Clínicos Doc", padX, H - 36);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen"))),
      "image/png",
    );
  });
}

async function shareImageFile(blob: Blob, s: ShareSolicitudData): Promise<boolean> {
  const file = new File([blob], `ayuda-${s.id || "clinicosdoc"}.png`, { type: "image/png" });
  const url = `${window.location.origin}${window.location.pathname}#/solicitud/${s.id}`;
  const text = `🆘 ${s.patientNombre} · ${s.zona}\n${s.necesidad}\n\nclinicosdoc.com\n${url}`;

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "Solicitud de ayuda — Clínicos Doc",
      text,
    });
    return true;
  }

  if (navigator.share) {
    // Comparte texto; además descarga la imagen para el usuario
    downloadBlob(blob, file.name);
    await navigator.share({ title: "Solicitud de ayuda — Clínicos Doc", text, url });
    return true;
  }

  downloadBlob(blob, file.name);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    alert("Imagen descargada y texto copiado. Comparta la imagen desde sus descargas.");
  } else {
    alert("Imagen descargada. Compártala desde sus descargas.");
  }
  return true;
}

function downloadBlob(blob: Blob, name: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function shareSolicitud(s: ShareSolicitudData): Promise<void> {
  try {
    const blob = await buildSolicitudShareImage(s);
    await shareImageFile(blob, s);
  } catch (err) {
    // Fallback solo texto si falla el canvas
    const url = `${window.location.origin}${window.location.pathname}#/solicitud/${s.id}`;
    const text = `🆘 ${s.patientNombre} · ${s.zona}\n${s.necesidad}\n\n#Venezuela #AyudaHumanitaria\n${url}`;
    if (navigator.share) {
      navigator.share({ title: "Solicitud de ayuda — Clínicos Doc", text, url }).catch(() => {});
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      alert("Texto copiado. Péguelo donde quiera compartir.");
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    console.error(err);
  }
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

function getCardShareData(card: Element, id: string): ShareSolicitudData {
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
      void shareSolicitud(getCardShareData(card, id));
    });
  });
}
