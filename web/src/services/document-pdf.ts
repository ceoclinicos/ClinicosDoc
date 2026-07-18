/** Vista/impresión de documento clínico (paridad con PDF de la app). */
import type { ClinicalDocument, DocumentHeader, DocumentType, PatientMembrete } from "../shared/models";
import { DocumentReportTitles, DocumentTypeLabels } from "../shared/models";
import { parseDocumentSections } from "./document-parser";
import {
  RECIPE_SECTION,
  RECETA_INDICACIONES_SECTION,
  RECETA_MOLDE_INDICACIONES,
  RECETA_MOLDE_RECIPE,
} from "../shared/receta";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatBirth(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString("es-VE");
  } catch {
    return iso.slice(0, 10);
  }
}

export function buildMembreteFromPatient(p: {
  nombre: string;
  edad: number;
  sexo: string;
  fechaNacimiento: string;
}): PatientMembrete {
  return {
    nombre: p.nombre,
    edad: String(p.edad),
    sexo: p.sexo || "—",
    fechaNacimiento: formatBirth(p.fechaNacimiento),
    fecha: new Date().toLocaleDateString("es-VE"),
  };
}

export function renderHeaderHtml(header?: DocumentHeader | null): string {
  if (!header) return "";
  const logoSrc = header.logoBase64
    ? header.logoBase64.startsWith("data:")
      ? header.logoBase64
      : `data:image/jpeg;base64,${header.logoBase64}`
    : null;
  const logo = logoSrc
    ? `<img class="print-header-logo" src="${logoSrc}" alt="" width="72" height="72" />`
    : "";
  return `
    <header class="print-header">
      ${logo}
      <div class="print-header-name">${escapeHtml(header.doctorName || header.name)}</div>
      ${header.subtitle ? `<div class="print-header-sub">${escapeHtml(header.subtitle)}</div>` : ""}
      ${header.description ? `<div class="print-header-desc">${escapeHtml(header.description)}</div>` : ""}
    </header>
  `;
}

export function renderMembreteHtml(m?: PatientMembrete | null): string {
  if (!m) return "";
  return `
    <section class="print-membrete">
      <div><strong>Paciente:</strong> ${escapeHtml(m.nombre)}</div>
      <div><strong>Edad:</strong> ${escapeHtml(m.edad)} años · <strong>Sexo:</strong> ${escapeHtml(m.sexo)}</div>
      <div><strong>Fecha de nacimiento:</strong> ${escapeHtml(m.fechaNacimiento)}</div>
    </section>
  `;
}

export function renderReportDateHtml(m?: PatientMembrete | null): string {
  const fecha = m?.fecha?.trim();
  if (!fecha) return "";
  return `<div class="print-date-row">${escapeHtml(fecha)}</div>`;
}

export function renderContentHtml(content: string): string {
  const sections = parseDocumentSections(content);
  if (!sections.length) {
    return `<pre class="print-body">${escapeHtml(content)}</pre>`;
  }
  return sections
    .map((s) => {
      const title = s.title ? `<h3>${escapeHtml(s.title)}</h3>` : "";
      return `<article class="print-section">${title}<pre class="print-body">${escapeHtml(s.body)}</pre></article>`;
    })
    .join("");
}

export function buildFullDocumentHtml(options: {
  type: DocumentType;
  content: string;
  header?: DocumentHeader | null;
  membrete?: PatientMembrete | null;
  patientCedula?: string;
}): string {
  if (options.type === "receta") {
    return buildRecetaLandscapeHtml(options);
  }
  const title = DocumentReportTitles[options.type] || DocumentTypeLabels[options.type];
  return `
    <div class="print-doc">
      ${renderReportDateHtml(options.membrete)}
      ${renderHeaderHtml(options.header)}
      <h1 class="print-title">${escapeHtml(title)}</h1>
      ${renderMembreteHtml(options.membrete)}
      <hr class="print-rule" />
      ${renderContentHtml(options.content)}
    </div>
  `;
}

function buildRecetaLandscapeHtml(options: {
  content: string;
  header?: DocumentHeader | null;
  membrete?: PatientMembrete | null;
  patientCedula?: string;
}): string {
  const sections = parseDocumentSections(options.content);
  const recipe =
    sections.find((s) => s.title.toLowerCase() === RECIPE_SECTION.toLowerCase())?.body ??
    RECETA_MOLDE_RECIPE;
  const indicaciones =
    sections.find((s) => s.title.toLowerCase() === RECETA_INDICACIONES_SECTION.toLowerCase())
      ?.body ?? RECETA_MOLDE_INDICACIONES;
  const m = options.membrete;
  const patientBlock = `
    <div class="receta-patient">
      <div><strong>Nombre:</strong> ${escapeHtml(m?.nombre || "—")}</div>
      <div><strong>C.I.:</strong> ${escapeHtml(options.patientCedula || "—")}</div>
      <div><strong>Edad:</strong> ${escapeHtml(m?.edad ? `${m.edad}` : "—")}</div>
    </div>`;
  const footer = `
    <div class="receta-footer">
      <div>Fecha: ${escapeHtml(m?.fecha || new Date().toLocaleDateString("es-VE"))}</div>
      <div>Firma: ____________________</div>
    </div>`;
  const half = (title: string, body: string) => `
    <div class="receta-half">
      ${renderHeaderHtml(options.header)}
      <h2 class="receta-half-title">${escapeHtml(title)}</h2>
      ${patientBlock}
      <pre class="print-body">${escapeHtml(body)}</pre>
      ${footer}
    </div>`;
  return `
    <div class="print-doc print-receta">
      ${half("RECIPE", recipe)}
      <div class="receta-divider"></div>
      ${half("INDICACIONES", indicaciones)}
    </div>
  `;
}

/** Abre diálogo de impresión / Guardar como PDF del navegador. */
export function printClinicalDocument(doc: {
  type: DocumentType;
  content: string;
  header?: DocumentHeader | null;
  membrete?: PatientMembrete | null;
  patientNombre?: string;
  patientCedula?: string;
}): void {
  const bodyHtml = buildFullDocumentHtml(doc);
  const isReceta = doc.type === "receta";
  const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(DocumentReportTitles[doc.type])} — ${escapeHtml(doc.patientNombre || "Clínicos Doc")}</title>
  <style>
    @page { size: ${isReceta ? "A4 landscape" : "A4"}; margin: ${isReceta ? "8mm" : "16mm"}; }
    html, body { background: #fff; }
    body { font-family: "Times New Roman", Times, Georgia, serif; color: #111; margin: 0; line-height: 1.45; }
    .print-doc { max-width: 180mm; margin: 0 auto; padding: 12mm 14mm; }
    .print-doc.print-receta {
      max-width: none;
      padding: 0;
      display: flex;
      flex-direction: row;
      min-height: 180mm;
      gap: 0;
    }
    .receta-half {
      flex: 1;
      padding: 8mm 10mm;
      display: flex;
      flex-direction: column;
      position: relative;
      box-sizing: border-box;
    }
    .receta-divider {
      width: 1px;
      background: #bbb;
      align-self: stretch;
    }
    .receta-half-title {
      text-align: center;
      font-size: 12pt;
      margin: 0.5rem 0;
      font-weight: 700;
    }
    .receta-patient { font-size: 10.5pt; margin-bottom: 0.75rem; }
    .receta-footer {
      margin-top: auto;
      padding-top: 1rem;
      font-size: 10.5pt;
    }
    .print-header { text-align: center; margin-bottom: 0.75rem; }
    .print-header-logo { display: block; width: 48px; height: 48px; object-fit: cover; margin: 0 auto 6px; border-radius: 6px; }
    .print-header-name { font-size: 11pt; font-weight: 700; color: #111; }
    .print-header-sub { font-size: 9pt; color: #222; }
    .print-header-desc { font-size: 8.5pt; color: #444; white-space: pre-wrap; }
    .print-date-row { text-align: right; font-size: 10.5pt; margin-bottom: 0.5rem; }
    .print-title { text-align: center; font-size: 13pt; letter-spacing: 0.03em; margin: 0.75rem 0 1rem; font-weight: 700; }
    .print-membrete { font-size: 10.5pt; margin: 0.5rem 0 0.75rem; }
    .print-rule { border: 0; border-top: 1px solid #999; margin: 0.75rem 0 1rem; }
    .print-section h3 { font-size: 11pt; margin: 0.9rem 0 0.25rem; color: #111; font-weight: 700; }
    .print-body { white-space: pre-wrap; font-family: inherit; margin: 0; font-size: 10.5pt; flex: 1; }
    @media print {
      body { margin: 0; }
      .print-doc { padding: 0; max-width: none; }
    }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;

  // iframe oculto: evita ventana en blanco por noopener/document.write
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Impresión");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
    }, 1500);
  };

  const runPrint = () => {
    try {
      const win = iframe.contentWindow;
      if (!win) throw new Error("Sin ventana de impresión");
      win.focus();
      win.print();
    } catch {
      // Fallback: blob URL en pestaña nueva
      try {
        const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, "_blank");
        if (!w) {
          alert("Permita ventanas emergentes o use Vista previa e Imprimir del navegador (Ctrl+P).");
        } else {
          const onLoad = () => {
            try {
              w.focus();
              w.print();
            } finally {
              setTimeout(() => URL.revokeObjectURL(url), 60_000);
            }
          };
          w.addEventListener("load", onLoad);
          // Por si ya cargó
          setTimeout(onLoad, 400);
        }
      } catch {
        alert("No se pudo abrir la impresión. Pruebe Vista previa y Ctrl+P.");
      }
    } finally {
      cleanup();
    }
  };

  iframe.onload = () => {
    // Dar un frame para pintar el contenido antes de print()
    requestAnimationFrame(() => setTimeout(runPrint, 50));
  };

  try {
    const docFrame = iframe.contentDocument;
    if (!docFrame) throw new Error("Sin document");
    docFrame.open();
    docFrame.write(fullHtml);
    docFrame.close();
  } catch {
    // srcdoc como alternativa
    iframe.onload = () => requestAnimationFrame(() => setTimeout(runPrint, 50));
    iframe.srcdoc = fullHtml;
  }
}

export function printFromClinicalDocument(doc: ClinicalDocument): void {
  printClinicalDocument({
    type: doc.type,
    content: doc.content,
    header: doc.headerSnapshot,
    membrete: doc.membrete,
    patientNombre: doc.patientNombre,
  });
}
