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

/** Tarjeta vertical ~6×9 cm a 300 dpi (709×1063 px), colores navy/teal de la app. */
export async function buildEmergencyCardBlob(ficha: FichaEmergencia): Promise<Blob> {
  const W = 709;
  const H = 1063;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el canvas");

  const navy = "#0b1f33";
  const navyLight = "#1a3a5c";
  const teal = "#0d9488";
  const tealLight = "#14b8a6";
  const surface = "#f4f7fa";

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, navy);
  bg.addColorStop(0.55, navyLight);
  bg.addColorStop(1, "#0a4a55");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const pad = 22;
  const cardX = pad;
  const cardY = pad;
  const cardW = W - pad * 2;
  const cardH = H - pad * 2;
  const radius = 22;

  roundRect(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Barra superior navy
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, 72, radius);
  ctx.clip();
  ctx.fillStyle = navy;
  ctx.fillRect(cardX, cardY, cardW, 72);
  ctx.restore();
  ctx.fillStyle = navy;
  ctx.fillRect(cardX, cardY + 40, cardW, 32);

  // Acento teal bajo el header
  const accent = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0);
  accent.addColorStop(0, teal);
  accent.addColorStop(1, tealLight);
  ctx.fillStyle = accent;
  ctx.fillRect(cardX, cardY + 72, cardW, 6);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 18px system-ui, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FICHA MÉDICA DE EMERGENCIA", W / 2, cardY + 44);

  let y = cardY + 110;
  const contentL = cardX + 28;
  const contentW = cardW - 56;

  ctx.fillStyle = navy;
  ctx.font = "700 28px system-ui, Segoe UI, sans-serif";
  ctx.textAlign = "left";
  y = wrapText(ctx, ficha.nombre.slice(0, 40), contentL, y, contentW, 32);

  // Badge sangre
  y += 8;
  const blood = ficha.tipoSangre || "—";
  ctx.font = "700 16px system-ui, Segoe UI, sans-serif";
  const bloodLabel = `Sangre ${blood}`;
  const bloodW = Math.max(110, ctx.measureText(bloodLabel).width + 28);
  roundRect(ctx, contentL, y - 18, bloodW, 32, 10);
  ctx.fillStyle = "#fef2f2";
  ctx.fill();
  ctx.fillStyle = "#dc2626";
  ctx.fillText(bloodLabel, contentL + 14, y + 4);

  ctx.fillStyle = "#64748b";
  ctx.font = "500 16px system-ui, Segoe UI, sans-serif";
  ctx.fillText(`C.I. ${ficha.patientCedula}`, contentL + bloodW + 16, y + 4);

  y += 36;
  const panelTop = y - 8;
  roundRect(ctx, contentL - 8, panelTop, contentW + 16, 230, 14);
  ctx.fillStyle = surface;
  ctx.fill();

  y += 12;
  const rows: [string, string][] = [
    ["Alergias", ficha.alergias],
    ["Condiciones / Comorbilidades", ficha.condiciones],
    ["Medicamentos", ficha.medicamentos],
  ];
  for (const [label, value] of rows) {
    ctx.fillStyle = teal;
    ctx.font = "700 13px system-ui, Segoe UI, sans-serif";
    ctx.fillText(label.toUpperCase(), contentL, y);
    y += 20;
    ctx.fillStyle = navy;
    ctx.font = "400 15px system-ui, Segoe UI, sans-serif";
    y = wrapText(ctx, value || "—", contentL, y, contentW, 20);
    y += 10;
  }

  if (ficha.contactos.length) {
    y += 6;
    ctx.fillStyle = teal;
    ctx.font = "700 13px system-ui, Segoe UI, sans-serif";
    ctx.fillText("CONTACTOS", contentL, y);
    y += 20;
    ctx.fillStyle = navy;
    ctx.font = "400 14px system-ui, Segoe UI, sans-serif";
    for (const c of ficha.contactos.slice(0, 2)) {
      y = wrapText(
        ctx,
        `${c.nombre} (${c.parentesco}): ${c.telefono}`.slice(0, 64),
        contentL,
        y,
        contentW,
        18,
      );
      y += 4;
    }
  }

  const footerH = 44;
  const footerY = cardY + cardH - footerH;
  const qrSize = 200;
  const qrX = (W - qrSize) / 2;
  const qrY = Math.min(y + 24, footerY - qrSize - 52);
  const qrDataUrl = await buildEmergencyQrDataUrl(ficha.publicId, qrSize);
  const qrImg = await loadImage(qrDataUrl);

  // Marco suave del QR
  roundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 14);
  ctx.fillStyle = surface;
  ctx.fill();
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = navyLight;
  ctx.font = "600 15px system-ui, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Escanea en emergencia", W / 2, qrY + qrSize + 28);

  // Pie: clinicosdoc.com en todo el borde inferior, levemente separado del borde
  ctx.save();
  roundRect(ctx, cardX, footerY - 8, cardW, footerH + 8, radius);
  ctx.clip();
  ctx.fillStyle = navy;
  ctx.fillRect(cardX, footerY, cardW, footerH + 8);
  ctx.restore();
  ctx.fillStyle = navy;
  ctx.fillRect(cardX, footerY, cardW, 12);

  ctx.fillStyle = tealLight;
  ctx.font = "600 15px system-ui, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  // clinicosdoc.com repartido en todo el borde inferior
  const brand = "clinicosdoc.com";
  const chars = brand.split("");
  const totalGap = cardW - 48;
  const step = totalGap / (chars.length - 1);
  const startX = cardX + 24;
  ctx.fillStyle = "#e2e8f0";
  chars.forEach((ch, i) => {
    ctx.fillText(ch, startX + i * step, footerY + 28);
  });

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
  @page { size: 60mm 90mm; margin: 2mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: system-ui, Segoe UI, sans-serif; color: #0b1f33; background: #0b1f33; }
  .card {
    width: 56mm; height: 86mm; border-radius: 2.5mm; overflow: hidden;
    background: #fff; display: flex; flex-direction: column;
    page-break-inside: avoid;
  }
  .hdr {
    background: linear-gradient(135deg, #0b1f33, #1a3a5c);
    color: #fff; text-align: center; padding: 2.2mm 2mm 1.8mm;
    font-size: 6.5pt; font-weight: 700; letter-spacing: 0.03em;
  }
  .accent { height: 1.2mm; background: linear-gradient(90deg, #0d9488, #14b8a6); }
  .body { flex: 1; padding: 2.5mm 3mm 1mm; }
  h1 { margin: 0 0 1mm; font-size: 11pt; line-height: 1.15; }
  .meta { color: #64748b; font-size: 7pt; margin-bottom: 1.5mm; }
  .blood { color: #dc2626; font-weight: 700; }
  .label { color: #0d9488; font-size: 6pt; font-weight: 700; text-transform: uppercase; margin-top: 1mm; }
  .val { font-size: 7pt; line-height: 1.2; }
  .qr-wrap { text-align: center; padding: 1mm 0 2mm; }
  .qr-wrap img { width: 22mm; height: 22mm; }
  .qr-caption { font-size: 6.5pt; color: #1a3a5c; font-weight: 600; margin-top: 0.8mm; }
  .foot {
    background: #0b1f33; color: #e2e8f0; text-align: center;
    font-size: 6.5pt; font-weight: 600; letter-spacing: 0.28em;
    padding: 2mm 1.5mm; margin-top: auto;
  }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
  <div class="card">
    <div class="hdr">FICHA MÉDICA DE EMERGENCIA</div>
    <div class="accent"></div>
    <div class="body">
      <h1>${esc(ficha.nombre)}</h1>
      <div class="meta">C.I. ${esc(ficha.patientCedula)} · <span class="blood">Sangre ${esc(ficha.tipoSangre)}</span></div>
      <div class="label">Alergias</div><div class="val">${esc(ficha.alergias)}</div>
      <div class="label">Condiciones / Comorbilidades</div><div class="val">${esc(ficha.condiciones)}</div>
      <div class="label">Medicamentos</div><div class="val">${esc(ficha.medicamentos)}</div>
      ${contacts ? `<div class="label">Contactos</div><div class="val">${contacts}</div>` : ""}
    </div>
    <div class="qr-wrap">
      <img src="${qr}" alt="QR" />
      <div class="qr-caption">Escanea en emergencia</div>
    </div>
    <div class="foot">clinicosdoc.com</div>
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
    // Página PDF en puntos (1 mm ≈ 2.8346 pt) → 60×90 mm
    const pdfBlob = buildJpegPdf(jpegBytes, W, H, 170.08, 255.12);
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
