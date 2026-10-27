import type { PhysicalExamSystem } from "./models";

/** Orden clínico fijo (paridad con la app). */
export const displayPriority: Record<string, number> = {
  signos_vitales: 0,
  general: 1,
  piel: 2,
  cabeza_cuello: 3,
  ojos: 4,
  oidos: 5,
  nariz: 6,
  boca_faringe: 7,
  cardiopulmonar: 8,
  abdomen: 9,
  extremidades: 10,
  neurologico: 11,
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
    id: "ojos",
    name: "Ojos",
    defaultText:
      "Agudeza visual conservada. Pupilas isocóricas, normorreactivas a la luz y acomodación. Movimientos oculares conservados. Conjuntivas rosadas, escleras anictéricas. Reflejo foveal presente, retina sin exudados ni hemorragias.",
    sortOrder: 4,
  },
  {
    id: "oidos",
    name: "Oídos",
    defaultText:
      "Pabellones auriculares normoinsertos, simétricos e indoloros al trago/tracción. Conductos auditivos externos permeables, sin masas ni secreciones. Membranas timpánicas íntegras, gris perla, cono luminoso y relieves anatómicos conservados bilateralmente.",
    sortOrder: 5,
  },
  {
    id: "nariz",
    name: "Nariz",
    defaultText:
      "Pirámide nasal simétrica. Tabique centrado, mucosa permeable y rosada. Cornetes inferiores de tamaño normal sin hipertrofia. No se observan pólipos, masas ni secreciones patológicas. Ventilación nasal bilateral conservada.",
    sortOrder: 6,
  },
  {
    id: "boca_faringe",
    name: "Boca y Faringe",
    defaultText:
      "Mucosa oral húmeda y rosada. Dentadura completa/en buen estado, encías sin sangrado. Lengua centrada y móvil. Úvula central. Amígdalas palatinas Grado I/IV sin exudado. Faringe posterior normoémica, sin secreción ni petequias.",
    sortOrder: 7,
  },
  {
    id: "cardiopulmonar",
    name: "Cardiopulmonar",
    defaultText:
      "Tórax simétrico, normoexpansible, ruidos respiratorios presentes sin agregados, ruidos cardiacos rítmicos regulares, no soplo, no galope.",
    sortOrder: 8,
  },
  {
    id: "abdomen",
    name: "Abdomen",
    defaultText:
      "Ruidos hidroaéreos presentes, plano, blando, depresible, no doloroso a palpación superficial ni profunda; sin visceromegalias.",
    sortOrder: 9,
  },
  {
    id: "extremidades",
    name: "Extremidades",
    defaultText: "Simétricas, eutróficas, sin edemas; llenado capilar menor a 3 segundos.",
    sortOrder: 10,
  },
  {
    id: "neurologico",
    name: "Neurológico",
    defaultText: "Consciente, orientado en tiempo, espacio y persona; Glasgow 15/15.",
    sortOrder: 11,
  },
];

/** Sistemas activos por defecto: los nuevos (ojos/oídos/nariz/boca) vienen desmarcados (paridad app). */
export const DefaultEnabledExamIds = [
  "signos_vitales",
  "general",
  "piel",
  "cabeza_cuello",
  "cardiopulmonar",
  "abdomen",
  "extremidades",
  "neurologico",
];

/**
 * Ejemplos de estilo cuando el dictado aporta hallazgos patológicos.
 * No sustituyen el texto base normal; solo guían la redacción.
 */
export const PathologicalStyleExamples: Record<string, string> = {
  cardiopulmonar:
    "Tórax simétrico, normoexpansible, se auscultan sibilantes en hemitórax derecho o bilaterales, ruidos cardiacos hipofonéticos, no soplo, no galope.",
  abdomen:
    "Globoso a expensas de panículo adiposo (inicie por apariencia: plano, globoso, batracio o en delantal), ruidos hidroaéreos disminuidos, doloroso a la palpación en flanco e hipocondrio derecho.",
  extremidades:
    "Se evidencia aumento de volumen y limitación funcional a la flexoextensión activa y pasiva de la rodilla derecha, pulsos distales conservados. Resto de extremidades simétricas, eutróficas, sin edema.",
  neurologico:
    "Obnubilado, lenguaje no coherente, desorientado en tiempo, espacio y persona, Glasgow 12/15 puntos.",
};

export function orderEnabledIds(ids: string[]): string[] {
  // Conserva el orden recibido (plantilla / catálogo). Solo elimina duplicados.
  return [...new Set(ids)];
}

export function priorityForName(name: string): number {
  const n = name.trim().toLowerCase();
  if (n.startsWith("signos")) return 0;
  if (n.startsWith("general")) return 1;
  if (n.startsWith("piel")) return 2;
  if (n.startsWith("cabeza")) return 3;
  if (n.startsWith("ojos")) return 4;
  if (n.startsWith("oidos") || n.startsWith("oídos")) return 5;
  if (n.startsWith("nariz")) return 6;
  if (n.startsWith("boca") || n.startsWith("faringe")) return 7;
  if (n.startsWith("cardiopulmonar") || n.startsWith("cardio")) return 8;
  if (n.startsWith("abdomen")) return 9;
  if (n.startsWith("extremidades")) return 10;
  if (n.startsWith("neurol")) return 11;
  return 100;
}
