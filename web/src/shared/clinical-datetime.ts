/** Fecha/hora de documentos y saludo del médico (paridad app). */

export function formatDocumentDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .toLowerCase();
  return `${date} · ${time}`;
}

export function saludoHora(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function tituloProfesional(sexo?: string): string {
  const s = (sexo || "").trim().toLowerCase();
  if (s === "femenino" || s === "f" || s.startsWith("fem") || s === "mujer") return "Dra.";
  return "Dr.";
}
