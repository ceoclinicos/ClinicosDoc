/** Vista/impresión de documento clínico (paridad con PDF de la app). */
import type { ClinicalDocument, DocumentHeader, DocumentType, PatientMembrete } from "../shared/models";
import { DocumentReportTitles, DocumentTypeLabels } from "../shared/models";
import { parseDocumentSections } from "./document-parser";

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
  return `
    <header class="print-header">
      <div class="print-header-name">${escapeHtml(header.doctorName || header.name)}</div>
      ${header.subtitle ? `<div class="print-header-sub">${escapeHtml(header.subtitle)}</div>` : ""}
      ${header.description ? `<div class="print-header-desc">${escapeHtml(header.description)}</div>` : ""}
    </header>
  `;
}

export function renderMembreteHtml(m?: PatientMembrete | null): string {
  if (!m) return "";
  return `
    <div class="print-date-row">${escapeHtml(m.fecha || "")}</div>
    <section class="print-membrete">
      <div><strong>Paciente:</strong> ${escapeHtml(m.nombre)}</div>
      <div><strong>Edad:</strong> ${escapeHtml(m.edad)} años · <strong>Sexo:</strong> ${escapeHtml(m.sexo)}</div>
      <div><strong>Fecha de nacimiento:</strong> ${escapeHtml(m.fechaNacimiento)}</div>
    </section>
  `;
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
}): string {
  const title = DocumentReportTitles[options.type] || DocumentTypeLabels[options.type];
  return `
    <div class="print-doc">
      ${renderHeaderHtml(options.header)}
      <h1 class="print-title">${escapeHtml(title)}</h1>
      ${renderMembreteHtml(options.membrete)}
      <hr class="print-rule" />
      ${renderContentHtml(options.content)}
    </div>
  `;
}

/** Abre ventana de impresión / Guardar como PDF del navegador. */
export function printClinicalDocument(doc: {
  type: DocumentType;
  content: string;
  header?: DocumentHeader | null;
  membrete?: PatientMembrete | null;
  patientNombre?: string;
}): void {
  const html = buildFullDocumentHtml(doc);
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!w) {
    alert("Permita ventanas emergentes para imprimir o guardar PDF.");
    return;
  }
  w.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${DocumentReportTitles[doc.type]} — ${doc.patientNombre || "Clínicos Doc"}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: "Times New Roman", Times, Georgia, serif; color: #111; margin: 0; line-height: 1.45; background: #fff; }
    .print-doc { max-width: 180mm; margin: 0 auto; padding: 12mm 14mm; }
    .print-header { text-align: center; margin-bottom: 0.75rem; }
    .print-header-name { font-size: 13pt; font-weight: 700; color: #111; }
    .print-header-sub { font-size: 11pt; color: #222; }
    .print-header-desc { font-size: 10pt; color: #444; white-space: pre-wrap; }
    .print-date-row { text-align: right; font-size: 10.5pt; margin-bottom: 0.5rem; }
    .print-title { text-align: center; font-size: 13pt; letter-spacing: 0.03em; margin: 0.75rem 0 1rem; font-weight: 700; }
    .print-membrete { font-size: 10.5pt; margin: 0.5rem 0 0.75rem; }
    .print-rule { border: 0; border-top: 1px solid #999; margin: 0.75rem 0 1rem; }
    .print-section h3 { font-size: 11pt; margin: 0.9rem 0 0.25rem; color: #111; font-weight: 700; }
    .print-body { white-space: pre-wrap; font-family: inherit; margin: 0; font-size: 11pt; }
    @media print { body { margin: 0; } .print-doc { padding: 0; max-width: none; } }
  </style>
</head>
<body>${html}
<script>window.onload = function(){ window.print(); }</script>
</body></html>`);
  w.document.close();
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
