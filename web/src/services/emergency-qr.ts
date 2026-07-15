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

  // Card blanca (~10% menos altura vertical)
  const cardX = 64;
  const cardY = 220;
  const cardW = W - 128;
  const cardH = Math.round(1480 * 0.9); // 1332
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
    ["Condiciones", ficha.condiciones],
    ["Medicamentos", ficha.medicamentos],
  ];
  for (const [label, value] of lines) {
    ctx.fillStyle = "#0d9488";
    ctx.font = "700 26px system-ui, Segoe UI, sans-serif";
    ctx.fillText(label.toUpperCase(), pad, y);
    y += 40;
    ctx.fillStyle = "#0b1f33";
    ctx.font = "400 30px system-ui, Segoe UI, sans-serif";
    y = wrapText(ctx, value || "—", pad, y, cardW - 112, 38);
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
  ctx.font = "500 29px system-ui, Segoe UI, sans-serif";
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

/** Tarjeta vertical elegante; 800 px de ancho, alto proporcional. */
export async function buildEmergencyCardBlob(ficha: FichaEmergencia): Promise<Blob> {
  const BASE_W = 709;
  const BASE_H = Math.round(1063 * 0.9); // 957
  const W = 800;
  const S = W / BASE_W;
  const H = Math.round(BASE_H * S); // ~1080
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el canvas");
  ctx.scale(S, S);

  const navy = "#0b1f33";
  const teal = "#0d9488";
  const red = "#dc2626";
  const muted = "#64748b";
  const footerGray = "#64748b";

  // Mismo degradado que la referencia (navy → teal → navy)
  const bg = ctx.createLinearGradient(0, 0, 0, BASE_H);
  bg.addColorStop(0, "#0b1f33");
  bg.addColorStop(0.45, "#0f766e");
  bg.addColorStop(1, "#0b1f33");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  const padX = 28;
  const padY = 24;
  const cardX = padX;
  const cardY = padY;
  const cardW = BASE_W - padX * 2;
  const cardH = BASE_H - padY * 2 - 36; // deja aire para "Clínicos Doc · Ayudemos"
  const radius = 26;
  const contentL = cardX + 40;
  const contentW = cardW - 80;
  const cx = BASE_W / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  roundRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Cabecera centrada (como la referencia)
  let y = cardY + 48;
  ctx.textAlign = "center";
  ctx.fillStyle = red;
  ctx.font = "700 19px system-ui, Segoe UI, sans-serif";
  ctx.fillText("FICHA MÉDICA DE EMERGENCIA", cx, y);

  y += 38;
  ctx.fillStyle = navy;
  ctx.font = "700 28px system-ui, Segoe UI, sans-serif";
  y = wrapText(ctx, ficha.nombre.slice(0, 48), cx, y, contentW, 32);

  y += 6;
  ctx.fillStyle = muted;
  ctx.font = "500 16px system-ui, Segoe UI, sans-serif";
  ctx.fillText(`C.I. ${ficha.patientCedula}`, cx, y);

  y += 40;
  ctx.textAlign = "left";
  const rows: [string, string][] = [
    ["Tipo de sangre", ficha.tipoSangre || "—"],
    ["Alergias", ficha.alergias || "—"],
    ["Condiciones", ficha.condiciones || "—"],
    ["Medicamentos", ficha.medicamentos || "—"],
  ];
  if (ficha.contactos.length) {
    rows.push([
      "Contactos",
      ficha.contactos
        .slice(0, 2)
        .map((c) => `${c.nombre} (${c.parentesco}): ${c.telefono}`)
        .join("\n"),
    ]);
  }

  for (const [label, value] of rows) {
    ctx.fillStyle = teal;
    ctx.font = "700 14px system-ui, Segoe UI, sans-serif";
    ctx.fillText(label.toUpperCase(), contentL, y);
    y += 22;
    ctx.fillStyle = navy;
    ctx.font = "400 16px system-ui, Segoe UI, sans-serif";
    for (const line of value.split("\n")) {
      y = wrapText(ctx, line || "—", contentL, y, contentW, 20);
      y += 2;
    }
    y += 14;
  }

  const scanY = cardY + cardH - 28;
  const qrSize = 190;
  let qrY = Math.max(y + 10, scanY - qrSize - 28);
  if (qrY + qrSize + 24 > scanY) qrY = scanY - qrSize - 24;
  const qrX = (BASE_W - qrSize) / 2;
  const qrDataUrl = await buildEmergencyQrDataUrl(ficha.publicId, Math.round(qrSize * S));
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = footerGray;
  ctx.font = "500 14px system-ui, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Escanea en emergencia · clinicosdoc.com", cx, scanY);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 15px system-ui, Segoe UI, sans-serif";
  ctx.fillText("Clínicos Doc · Ayudemos", cx, BASE_H - 14);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la tarjeta"))), "image/png");
  });
}

/** Abre diálogo de impresión / Guardar PDF a tamaño vertical ~6×9 cm. */
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
  @page { size: 60mm 81mm; margin: 2mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: system-ui, Segoe UI, sans-serif; color: #0b1f33;
    background: linear-gradient(180deg, #0b1f33 0%, #0f766e 45%, #0b1f33 100%);
  }
  .card {
    width: 56mm; height: 72mm; border-radius: 3mm; overflow: hidden;
    background: #fff; display: flex; flex-direction: column;
    page-break-inside: avoid; padding: 3mm 4mm 2mm;
  }
  .title { color: #dc2626; text-align: center; font-size: 7pt; font-weight: 700; letter-spacing: 0.02em; }
  h1 { margin: 1.5mm 0 0.8mm; font-size: 11pt; line-height: 1.15; text-align: center; color: #0b1f33; }
  .meta { color: #64748b; font-size: 7pt; text-align: center; margin-bottom: 2.5mm; }
  .label { color: #0d9488; font-size: 6.5pt; font-weight: 700; text-transform: uppercase; margin-top: 1.4mm; }
  .val { font-size: 7.5pt; line-height: 1.25; color: #0b1f33; }
  .qr-wrap { text-align: center; margin-top: auto; padding: 1.5mm 0 1mm; }
  .qr-wrap img { width: 22mm; height: 22mm; }
  .foot { text-align: center; font-size: 5.5pt; color: #64748b; padding-top: 0.5mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
  <div class="card">
    <div class="title">FICHA MÉDICA DE EMERGENCIA</div>
    <h1>${esc(ficha.nombre)}</h1>
    <div class="meta">C.I. ${esc(ficha.patientCedula)}</div>
    <div class="label">Tipo de sangre</div><div class="val">${esc(ficha.tipoSangre)}</div>
    <div class="label">Alergias</div><div class="val">${esc(ficha.alergias)}</div>
    <div class="label">Condiciones</div><div class="val">${esc(ficha.condiciones)}</div>
    <div class="label">Medicamentos</div><div class="val">${esc(ficha.medicamentos)}</div>
    ${contacts ? `<div class="label">Contactos</div><div class="val">${contacts}</div>` : ""}
    <div class="qr-wrap">
      <img src="${qr}" alt="QR" />
    </div>
    <div class="foot">Escanea en emergencia · clinicosdoc.com</div>
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

/** Descarga un PDF vertical (~6×9 cm) con la tarjeta embebida. */
export async function downloadEmergencyCardPdf(ficha: FichaEmergencia): Promise<void> {
  const cardBlob = await buildEmergencyCardBlob(ficha);
  const imgUrl = URL.createObjectURL(cardBlob);
  try {
    const img = await loadImage(imgUrl);
    const W = img.naturalWidth || 709;
    const H = img.naturalHeight || 1063;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear el PDF");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0);
    const jpeg = c.toDataURL("image/jpeg", 0.92);
    const b64 = jpeg.split(",")[1] ?? "";
    const jpegBytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    // Página PDF en puntos (1 mm ≈ 2.8346 pt) → 60×81 mm (−10% altura)
    const pdfBlob = buildJpegPdf(jpegBytes, W, H, 170.08, 229.61);
    downloadBlob(pdfBlob, `tarjeta-emergencia-${ficha.publicId}.pdf`);
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}

function buildJpegPdf(
  jpeg: Uint8Array,
  imgW: number,
  imgH: number,
  pageW: number,
  pageH: number,
): Blob {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [0];
  let offset = 0;

  const pushStr = (s: string) => {
    const bytes = encoder.encode(s);
    parts.push(bytes);
    offset += bytes.length;
  };
  const pushBytes = (b: Uint8Array) => {
    parts.push(b);
    offset += b.length;
  };
  const markObj = () => {
    offsets.push(offset);
  };

  pushStr("%PDF-1.4\n");

  markObj();
  pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  markObj();
  pushStr("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  markObj();
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n`,
  );
  const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ`;
  markObj();
  pushStr(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  markObj();
  pushStr(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  pushBytes(jpeg);
  pushStr("\nendstream\nendobj\n");

  const xrefStart = offset;
  pushStr(`xref\n0 ${offsets.length}\n`);
  pushStr("0000000000 65535 f \n");
  for (let i = 1; i < offsets.length; i++) {
    pushStr(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  );

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return new Blob([out], { type: "application/pdf" });
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
