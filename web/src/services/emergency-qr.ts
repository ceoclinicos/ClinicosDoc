/** QR + imagen wallpaper de ficha de emergencia. */
import QRCode from "qrcode";
import type { FichaEmergencia } from "./emergency-ficha";
import { emergenciaPublicUrl } from "./emergency-ficha";

export async function buildEmergencyQrDataUrl(publicId: string, size = 512): Promise<string> {
  const url = emergenciaPublicUrl(publicId);
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: size,
    color: { dark: "#0b1f33", light: "#ffffff" },
  });
}

/** Wallpaper vertical (1080×1920) para poner de fondo en el celular. */
export async function buildEmergencyWallpaperBlob(ficha: FichaEmergencia): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el canvas");

  // Fondo
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0b1f33");
  grad.addColorStop(0.45, "#0f766e");
  grad.addColorStop(1, "#0b1f33");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Card blanca
  const cardX = 64;
  const cardY = 180;
  const cardW = W - 128;
  const cardH = 1480;
  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.fillStyle = "#dc2626";
  ctx.font = "700 36px system-ui, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FICHA MÉDICA DE EMERGENCIA", W / 2, cardY + 70);

  ctx.fillStyle = "#0b1f33";
  ctx.font = "700 48px system-ui, Segoe UI, sans-serif";
  ctx.fillText(ficha.nombre.slice(0, 28), W / 2, cardY + 140);

  ctx.fillStyle = "#64748b";
  ctx.font = "500 28px system-ui, Segoe UI, sans-serif";
  ctx.fillText(`C.I. ${ficha.patientCedula}`, W / 2, cardY + 185);

  // Datos clave
  ctx.textAlign = "left";
  let y = cardY + 250;
  const pad = cardX + 56;
  const lines: [string, string][] = [
    ["Tipo de sangre", ficha.tipoSangre],
    ["Alergias", ficha.alergias],
    ["Condiciones / Comorbilidades", ficha.condiciones],
    ["Medicamentos", ficha.medicamentos],
  ];
  for (const [label, value] of lines) {
    ctx.fillStyle = "#0d9488";
    ctx.font = "700 26px system-ui, Segoe UI, sans-serif";
    ctx.fillText(label.toUpperCase(), pad, y);
    y += 40;
    ctx.fillStyle = "#0b1f33";
    ctx.font = "400 30px system-ui, Segoe UI, sans-serif";
    y = wrapText(ctx, value, pad, y, cardW - 112, 38);
    y += 36;
  }

  if (ficha.contactos.length) {
    ctx.fillStyle = "#0d9488";
    ctx.font = "700 26px system-ui, Segoe UI, sans-serif";
    ctx.fillText("CONTACTOS", pad, y);
    y += 44;
    ctx.fillStyle = "#0b1f33";
    ctx.font = "400 28px system-ui, Segoe UI, sans-serif";
    for (const c of ficha.contactos.slice(0, 3)) {
      ctx.fillText(`${c.nombre} (${c.parentesco}): ${c.telefono}`, pad, y);
      y += 40;
    }
  }

  // QR
  const qrSize = 420;
  const qrDataUrl = await buildEmergencyQrDataUrl(ficha.publicId, qrSize);
  const qrImg = await loadImage(qrDataUrl);
  const qrX = (W - qrSize) / 2;
  const qrY = Math.min(y + 40, cardY + cardH - qrSize - 120);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = "#64748b";
  ctx.font = "500 24px system-ui, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Escanea en emergencia · clinicosdoc.com", W / 2, qrY + qrSize + 48);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 28px system-ui, Segoe UI, sans-serif";
  ctx.fillText("Clínicos Doc · Ayudemos", W / 2, H - 80);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))), "image/png");
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(/\s+/);
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar el QR"));
    img.src = src;
  });
}

/** Tarjeta tipo cédula ~9×6 cm a 300 dpi (1063×709 px) para imprimir / compartir. */
export async function buildEmergencyCardBlob(ficha: FichaEmergencia): Promise<Blob> {
  const W = 1063;
  const H = 709;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el canvas");

  ctx.fillStyle = "#0b1f33";
  ctx.fillRect(0, 0, W, H);

  roundRect(ctx, 18, 18, W - 36, H - 36, 18);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.fillStyle = "#dc2626";
  ctx.font = "700 22px system-ui, Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("FICHA MÉDICA DE EMERGENCIA", 40, 55);

  ctx.fillStyle = "#0b1f33";
  ctx.font = "700 32px system-ui, Segoe UI, sans-serif";
  ctx.fillText(ficha.nombre.slice(0, 32), 40, 100);

  ctx.fillStyle = "#64748b";
  ctx.font = "500 18px system-ui, Segoe UI, sans-serif";
  ctx.fillText(`C.I. ${ficha.patientCedula} · Sangre ${ficha.tipoSangre}`, 40, 130);

  const leftW = 620;
  let y = 170;
  const rows: [string, string][] = [
    ["Alergias", ficha.alergias],
    ["Condiciones / Comorbilidades", ficha.condiciones],
    ["Medicamentos", ficha.medicamentos],
  ];
  for (const [label, value] of rows) {
    ctx.fillStyle = "#0d9488";
    ctx.font = "700 15px system-ui, Segoe UI, sans-serif";
    ctx.fillText(label.toUpperCase(), 40, y);
    y += 22;
    ctx.fillStyle = "#0b1f33";
    ctx.font = "400 17px system-ui, Segoe UI, sans-serif";
    y = wrapText(ctx, value || "—", 40, y, leftW - 20, 22);
    y += 14;
  }

  if (ficha.contactos.length) {
    ctx.fillStyle = "#0d9488";
    ctx.font = "700 15px system-ui, Segoe UI, sans-serif";
    ctx.fillText("CONTACTOS", 40, y);
    y += 22;
    ctx.fillStyle = "#0b1f33";
    ctx.font = "400 16px system-ui, Segoe UI, sans-serif";
    for (const c of ficha.contactos.slice(0, 2)) {
      ctx.fillText(`${c.nombre} (${c.parentesco}): ${c.telefono}`.slice(0, 58), 40, y);
      y += 22;
    }
  }

  const qrSize = 220;
  const qrDataUrl = await buildEmergencyQrDataUrl(ficha.publicId, qrSize);
  const qrImg = await loadImage(qrDataUrl);
  const qrX = W - qrSize - 48;
  const qrY = (H - qrSize) / 2 - 10;
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = "#64748b";
  ctx.font = "500 13px system-ui, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Escanea en emergencia", qrX + qrSize / 2, qrY + qrSize + 28);
  ctx.fillText("Clínicos Doc", qrX + qrSize / 2, qrY + qrSize + 48);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la tarjeta"))), "image/png");
  });
}

/** Abre diálogo de impresión / Guardar PDF a tamaño ~9×6 cm. */
export async function printEmergencyCardPdf(ficha: FichaEmergencia): Promise<void> {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const contacts = ficha.contactos
    .slice(0, 2)
    .map((c) => `${esc(c.nombre)} (${esc(c.parentesco)}): ${esc(c.telefono)}`)
    .join("<br/>");
  const qr = await buildEmergencyQrDataUrl(ficha.publicId, 280);

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
<title>Tarjeta emergencia — ${esc(ficha.nombre)}</title>
<style>
  @page { size: 90mm 60mm; margin: 2mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: system-ui, Segoe UI, sans-serif; color: #0b1f33; }
  .card {
    width: 86mm; height: 56mm; border: 0.4mm solid #0b1f33; border-radius: 2mm;
    padding: 2.5mm 3mm; display: grid; grid-template-columns: 1fr 22mm; gap: 2mm;
    page-break-inside: avoid;
  }
  .badge { color: #dc2626; font-size: 7pt; font-weight: 700; letter-spacing: 0.04em; }
  h1 { margin: 0.5mm 0; font-size: 11pt; }
  .meta { color: #64748b; font-size: 7.5pt; margin-bottom: 1.5mm; }
  .label { color: #0d9488; font-size: 6.5pt; font-weight: 700; text-transform: uppercase; margin-top: 0.8mm; }
  .val { font-size: 7.5pt; line-height: 1.2; }
  .qr-wrap { text-align: center; align-self: center; }
  .qr-wrap img { width: 20mm; height: 20mm; }
  .qr-caption { font-size: 5.5pt; color: #64748b; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
  <div class="card">
    <div>
      <div class="badge">FICHA MÉDICA DE EMERGENCIA</div>
      <h1>${esc(ficha.nombre)}</h1>
      <div class="meta">C.I. ${esc(ficha.patientCedula)} · Sangre ${esc(ficha.tipoSangre)}</div>
      <div class="label">Alergias</div><div class="val">${esc(ficha.alergias)}</div>
      <div class="label">Condiciones / Comorbilidades</div><div class="val">${esc(ficha.condiciones)}</div>
      <div class="label">Medicamentos</div><div class="val">${esc(ficha.medicamentos)}</div>
      ${contacts ? `<div class="label">Contactos</div><div class="val">${contacts}</div>` : ""}
    </div>
    <div class="qr-wrap">
      <img src="${qr}" alt="QR" />
      <div class="qr-caption">Escanear</div>
    </div>
  </div>
</body></html>`;

  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    document.body.removeChild(frame);
    throw new Error("No se pudo abrir impresión");
  }
  doc.open();
  doc.write(html);
  doc.close();
  await new Promise((r) => setTimeout(r, 350));
  try {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  } finally {
    setTimeout(() => frame.remove(), 1500);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2500);
}

export function shareTextWhatsApp(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

export async function shareEmergencyCard(
  ficha: FichaEmergencia,
  cardBlob: Blob,
): Promise<"shared" | "copied" | "manual"> {
  const url = emergenciaPublicUrl(ficha.publicId);
  const text =
    `Mi tarjeta médica de emergencia (Clínicos Doc)\n` +
    `Escanea el QR o abre: ${url}\n` +
    `Compártela como publicación principal en Instagram o envíala por WhatsApp.`;
  const file = new File([cardBlob], `tarjeta-emergencia-${ficha.publicId}.png`, {
    type: "image/png",
  });
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  if (nav.share) {
    try {
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ title: "Tarjeta médica de emergencia", text, files: [file] });
        return "shared";
      }
      await nav.share({ title: "Tarjeta médica de emergencia", text, url });
      return "shared";
    } catch {
      /* cancelado */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "manual";
  }
}
