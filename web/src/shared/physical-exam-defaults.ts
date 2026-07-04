import type { PhysicalExamSystem } from "./models";

export const PhysicalExamDefaults: PhysicalExamSystem[] = [
  {
    id: "general",
    name: "General",
    defaultText:
      "Paciente en regulares condiciones generales, consciente, colaborador, eupneico, hidratado.",
    sortOrder: 0,
  },
  {
    id: "signos_vitales",
    name: "Signos vitales",
    defaultText: "TA: [---] mmHg | FC: [---] lpm | FR: [---] rpm | SaTO2: [---]%",
    sortOrder: 1,
  },
  {
    id: "cardiopulmonar",
    name: "Cardiopulmonar",
    defaultText:
      "Tórax simétrico, normoexpansible, ruidos respiratorios presentes sin agregados, ruidos cardiacos rítmicos regulares, no soplo, no galope.",
    sortOrder: 3,
  },
  {
    id: "abdomen",
    name: "Abdomen",
    defaultText:
      "Ruidos hidroaéreos presentes, plano, blando, depresible, no doloroso a palpación superficial ni profunda; sin visceromegalias.",
    sortOrder: 4,
  },
  {
    id: "extremidades",
    name: "Extremidades",
    defaultText: "Simétricas, eutróficas, sin edemas; llenado capilar menor a 3 segundos.",
    sortOrder: 5,
  },
  {
    id: "neurologico",
    name: "Neurológico",
    defaultText: "Consciente, orientado en tiempo, espacio y persona; Glasgow 15/15.",
    sortOrder: 6,
  },
];

export const DefaultEnabledExamIds = [
  "general",
  "signos_vitales",
  "cardiopulmonar",
  "abdomen",
  "extremidades",
  "neurologico",
];
