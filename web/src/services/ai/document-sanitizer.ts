const PATIENT_LINE = /^(nombre|edad|sexo|fecha)\s*:/i;
const PATIENT_SECTION = /^datos del paciente$/i;
const DOCUMENT_TITLE_LINE =
  /^(\*\*)?\s*(informe\s+m[eé]dico|historia\s+cl[ií]nica|reposo\s+m[eé]dico)\s*(\*\*)?:?\s*$/i;
const SECTION_MARKER = /^\[\[SECTION:(.+?)]]\s*$/;

export function sanitizeDocumentContent(content: string): string {
  let text = content.trim();
  text = removePatientDataSection(text);
  text = removeLeadingPatientLines(text);
  text = text
    .split("\n")
    .filter((line) => !DOCUMENT_TITLE_LINE.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

function removePatientDataSection(content: string): string {
  if (content.includes("[[SECTION:")) {
    const chunks = content.split(/(?=\[\[SECTION:[^\]]+]])/).map((c) => c.trim()).filter(Boolean);
    return chunks
      .filter((chunk) => {
        const first = chunk.split("\n")[0]?.trim() ?? "";
        const m = SECTION_MARKER.exec(first);
        const title = m?.[1]?.trim() ?? "";
        return !PATIENT_SECTION.test(title);
      })
      .join("\n\n");
  }
  return content;
}

function removeLeadingPatientLines(content: string): string {
  const lines = content.split("\n");
  while (lines.length) {
    const line = lines[0].trim();
    if (!line) {
      lines.shift();
      continue;
    }
    if (PATIENT_LINE.test(line) || /\*\*datos del paciente\*\*/i.test(line)) {
      lines.shift();
      continue;
    }
    if (DOCUMENT_TITLE_LINE.test(line)) {
      lines.shift();
      continue;
    }
    break;
  }
  return lines.join("\n");
}
