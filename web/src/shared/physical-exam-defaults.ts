import type { PhysicalExamSystem } from "./models";

/** Orden clínico fijo (paridad con la app). */
export const displayPriority: Record<string, number> = {
  signos_vitales: 0,
  general: 1,
  piel: 2,
  cabeza_cuello: 3,
  cardiopulmonar: 4,
  abdomen: 5,
  extremidades: 6,
  neurologico: 7,
};

export const PhysicalExamDefaults: PhysicalExamSystem[] = [
  {
    id: "signos_vitales",
    name: "Signos vitales",
    defaultText: "",
    sortOrder: 0,
  },
  {
    id: "general",
    name: "General",
    defaultText:
      "Paciente en regulares condiciones generales, consciente, colaborador, eupneico, hidratado.",
    sortOrder: 1,
  },
  {
    id: "piel",
    name: "Piel",
    defaultText: "Turgor y elasticidad conservados, sin lesiones primarias ni secundarias.",
    sortOrder: 2,
  },
  {
    id: "cabeza_cuello",
    name: "Cabeza y cuello",
    defaultText: "Normocéfalo; cuello móvil, sin adenomegalias ni ingurgitación yugular.",
    sortOrder: 3,
  },
  {
    id: "cardiopulmonar",
    name: "Cardiopulmonar",
    defaultText:
      "Tórax simétrico, normoexpansible, ruidos respiratorios presentes sin agregados, ruidos cardiacos rítmicos regulares, no soplo, no galope.",
    sortOrder: 4,
  },
  {
    id: "abdomen",
    name: "Abdomen",
    defaultText:
      "Ruidos hidroaéreos presentes, plano, blando, depresible, no doloroso a palpación superficial ni profunda; sin visceromegalias.",
    sortOrder: 5,
  },
  {
    id: "extremidades",
    name: "Extremidades",
    defaultText: "Simétricas, eutróficas, sin edemas; llenado capilar menor a 3 segundos.",
    sortOrder: 6,
  },
  {
    id: "neurologico",
    name: "Neurológico",
    defaultText: "Consciente, orientado en tiempo, espacio y persona; Glasgow 15/15.",
    sortOrder: 7,
  },
];

export const DefaultEnabledExamIds = PhysicalExamDefaults.map((s) => s.id);

export function orderEnabledIds(ids: string[]): string[] {
  return [...new Set(ids)].sort((a, b) => {
    const pa = displayPriority[a] ?? 100;
    const pb = displayPriority[b] ?? 100;
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });
}

export function priorityForName(name: string): number {
  const n = name.trim().toLowerCase();
  if (n.startsWith("signos")) return 0;
  if (n.startsWith("general")) return 1;
  if (n.startsWith("piel")) return 2;
  if (n.startsWith("cabeza")) return 3;
  if (n.startsWith("cardiopulmonar") || n.startsWith("cardio")) return 4;
  if (n.startsWith("abdomen")) return 5;
  if (n.startsWith("extremidades")) return 6;
  if (n.startsWith("neurol")) return 7;
  return 100;
}
