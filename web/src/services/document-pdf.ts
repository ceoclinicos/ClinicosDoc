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
    <section class="print-membrete">
      <div><strong>Paciente:</strong> ${escapeHtml(m.nombre)}</div>
      <div><strong>Edad:</strong> ${escapeHtml(m.edad)} años · <strong>Sexo:</strong> ${escapeHtml(m.sexo)}</div>
      <div><strong>Fecha de nacimiento:</strong> ${escapeHtml(m.fechaNacimiento)}</div>
      <div><strong>Fecha:</strong> ${escapeHtml(m.fecha)}</div>
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
    body { font-family: Georgia, "Times New Roman", serif; color: #0b1f33; margin: 24px; line-height: 1.45; }
    .print-header { text-align: center; margin-bottom: 1rem; }
    .print-header-name { font-size: 1.25rem; font-weight: 700; color: #0d9488; }
    .print-header-sub { font-size: 0.95rem; color: #334155; }
    .print-header-desc { font-size: 0.85rem; color: #64748b; white-space: pre-wrap; }
    .print-title { text-align: center; font-size: 1.15rem; letter-spacing: 0.04em; margin: 1rem 0; }
    .print-membrete { font-size: 0.95rem; margin: 0.75rem 0 1rem; }
    .print-rule { border: 0; border-top: 1px solid #cbd5e1; margin: 1rem 0; }
    .print-section h3 { font-size: 1rem; margin: 1rem 0 0.35rem; color: #0f766e; }
    .print-body { white-space: pre-wrap; font-family: inherit; margin: 0; font-size: 0.95rem; }
    @media print { body { margin: 12mm; } }
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
