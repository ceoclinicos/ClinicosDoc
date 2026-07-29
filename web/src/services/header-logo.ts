/** Tamaños de salida del logo (cuadrados). */
export const ALLOWED_LOGO_SIZES = new Set([256, 512]);
const MIN_SIDE = 64;

/**
 * Recorta al centro, escala a 256 o 512 y devuelve JPEG en base64 (sin prefijo data:).
 * Acepta 256, 512, 1024 u otras imágenes.
 */
export function fileToLogoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (w < MIN_SIDE || h < MIN_SIDE) {
          reject(new Error(`La imagen es demasiado pequeña (mínimo ${MIN_SIDE}×${MIN_SIDE} px)`));
          return;
        }
        const side = Math.min(w, h);
        const sx = Math.floor((w - side) / 2);
        const sy = Math.floor((h - side) / 2);
        const target = side >= 512 ? 512 : 256;
        const canvas = document.createElement("canvas");
        canvas.width = target;
        canvas.height = target;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo procesar la imagen"));
          return;
        }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
        resolve(base64);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

export function logoDataUrl(base64?: string | null): string | undefined {
  if (!base64) return undefined;
  if (base64.startsWith("data:")) return base64;
  return `data:image/jpeg;base64,${base64}`;
}
