/**
 * OCR local en el navegador (paridad con DocumentOcrService.kt de Android).
 * - Imágenes: Tesseract.js (español), todo corre en el dispositivo.
 * - PDF: pdf.js extrae el texto si es digital; si la página es escaneada
 *   (sin texto), se rasteriza a canvas y se le pasa Tesseract.
 */
import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_PDF_PAGES = 10;
const PDF_RENDER_SCALE = 2;

async function ocrImage(
  source: string | Blob | HTMLCanvasElement,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const result = await Tesseract.recognize(source, "spa", {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  return result.data.text.trim();
}

async function pdfPageToCanvas(page: pdfjsLib.PDFPageProxy): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

async function extractPdfText(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const parts: string[] = [];

  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    // PDF digital: el texto viene embebido y sale perfecto sin OCR.
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 20) {
      parts.push(text);
    } else {
      // Página escaneada: rasterizar y OCR.
      const canvas = await pdfPageToCanvas(page);
      const pageText = await ocrImage(canvas, (p) =>
        onProgress?.(Math.round(((i - 1) / pages + p / 100 / pages) * 100)),
      );
      if (pageText) parts.push(pageText);
    }
    onProgress?.(Math.round((i / pages) * 100));
  }
  await pdf.destroy();
  return parts.join("\n\n").trim();
}

/** Extrae texto de una foto o PDF. Lanza error si no hay texto legible. */
export async function extractTextFromFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  let text: string;
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    text = await extractPdfText(file, onProgress);
  } else if (file.type.startsWith("image/")) {
    text = await ocrImage(file, onProgress);
  } else {
    throw new Error("Formato no soportado. Usa una foto o un PDF.");
  }
  if (!text) {
    throw new Error("No se detectó texto legible. Prueba con más luz o un documento más nítido.");
  }
  return text;
}
