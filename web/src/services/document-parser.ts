export interface DocumentSection {
  id: string;
  title: string;
  body: string;
}

const SECTION_MARKER = /^\[\[SECTION:(.+?)]]\s*$/;

export function parseDocumentSections(content: string): DocumentSection[] {
  const trimmed = content.trim();
  if (!trimmed) {
    return [{ id: crypto.randomUUID(), title: "", body: "" }];
  }

  const chunks = trimmed.split(/(?=\[\[SECTION:[^\]]+]])/).map((c) => c.trim()).filter(Boolean);
  if (chunks.length === 0) {
    return [{ id: crypto.randomUUID(), title: "", body: trimmed }];
  }

  return chunks.map((chunk) => {
    const lines = chunk.split("\n");
    const first = lines[0]?.trim() ?? "";
    const match = SECTION_MARKER.exec(first);
    if (match) {
      return {
        id: crypto.randomUUID(),
        title: match[1].trim(),
        body: lines.slice(1).join("\n").trim(),
      };
    }
    return { id: crypto.randomUUID(), title: "", body: chunk };
  });
}

export function serializeDocumentSections(sections: DocumentSection[]): string {
  return sections
    .map((s) => {
      const title = s.title.trim();
      const body = s.body.trim();
      if (!title && !body) return null;
      if (!title) return body;
      if (!body) return `[[SECTION:${title}]]`;
      return `[[SECTION:${title}]]\n${body}`;
    })
    .filter(Boolean)
    .join("\n\n");
}
