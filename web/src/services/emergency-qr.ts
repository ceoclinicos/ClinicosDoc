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

export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2500);
}
