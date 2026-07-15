/** Tamaños cuadrados permitidos para logos de encabezado. */
export const ALLOWED_LOGO_SIZES = new Set([256, 512]);

/**
 * Valida 256×256 o 512×512 y devuelve JPEG en base64 (sin prefijo data:).
 */
export function fileToLogoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (w !== h || !ALLOWED_LOGO_SIZES.has(w)) {
          reject(
            new Error(
              `El logo debe ser cuadrado de 256×256 o 512×512 píxeles (recibido ${w}×${h})`,
            ),
          );
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo procesar la imagen"));
          return;
        }
        ctx.drawImage(img, 0, 0);
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
