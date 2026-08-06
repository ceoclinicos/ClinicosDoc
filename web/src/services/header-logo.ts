/** Logo de encabezado: cuadrado final entre 256×256 y 1024×1024 px. */
export const MIN_LOGO_SIDE = 256;
export const MAX_LOGO_SIDE = 1024;

/**
 * Acepta la imagen completa. Si es rectangular, crea un cuadrado del lado mayor
 * y rellena el resto en blanco (ej. 600×800 → 800×800 con bandas blancas).
 * Si el lado mayor supera 1024, escala proporcionalmente.
 */
export function fileToLogoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (w < 1 || h < 1) {
          reject(new Error("No se pudo leer la imagen"));
          return;
        }
        const longest = Math.max(w, h);
        if (longest < MIN_LOGO_SIDE) {
          reject(
            new Error(
              `La imagen es demasiado pequeña (mínimo ${MIN_LOGO_SIDE} px en el lado mayor)`,
            ),
          );
          return;
        }

        const scale = longest > MAX_LOGO_SIDE ? MAX_LOGO_SIDE / longest : 1;
        const drawW = Math.max(1, Math.round(w * scale));
        const drawH = Math.max(1, Math.round(h * scale));
        const side = Math.min(
          MAX_LOGO_SIDE,
          Math.max(MIN_LOGO_SIDE, Math.max(drawW, drawH)),
        );

        const canvas = document.createElement("canvas");
        canvas.width = side;
        canvas.height = side;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo procesar la imagen"));
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, side, side);
        const left = Math.floor((side - drawW) / 2);
        const top = Math.floor((side - drawH) / 2);
        ctx.drawImage(img, 0, 0, w, h, left, top, drawW, drawH);

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
