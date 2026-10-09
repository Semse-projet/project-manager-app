import type { IntakeQuestion } from "../../smart-intake.types.js";

export const MASONRY_CONCRETE_QUESTIONS: IntakeQuestion[] = [
  {
    id: "masonry_type",
    category: "masonry_concrete",
    step: 1,
    label: {
      es: "¿Qué tipo de trabajo de albañilería o concreto necesita?",
      en: "What type of masonry or concrete work is needed?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Losa, patio o entrada de autos", en: "Slab, patio or driveway" }, value: "slab_driveway" },
      { label: { es: "Acera, escalones o reparación de grietas", en: "Sidewalk, steps or crack repair" }, value: "repair_flatwork" },
      { label: { es: "Muro de ladrillo o bloque", en: "Brick or block wall" }, value: "brick_block_wall" },
      { label: { es: "Adoquines (pavers) o acabado decorativo", en: "Pavers or decorative finish" }, value: "pavers" },
      { label: { es: "Muro de contención, cimentación o chimenea", en: "Retaining wall, foundation or chimney" }, value: "structural" },
    ],
  },
  {
    id: "masonry_scope",
    category: "masonry_concrete",
    step: 2,
    label: {
      es: "¿Qué tan grande es el trabajo?",
      en: "How large is the job?",
    },
    description: {
      es: "Una entrada de autos para dos carros ronda los 400 – 600 pies².",
      en: "A two-car driveway is roughly 400 – 600 sq ft.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Pequeño (menos de 100 pies² o un tramo corto)", en: "Small (under 100 sq ft or a short run)" }, value: "small" },
      { label: { es: "Mediano (100 – 400 pies²)", en: "Medium (100 – 400 sq ft)" }, value: "medium" },
      { label: { es: "Grande (más de 400 pies²)", en: "Large (over 400 sq ft)" }, value: "large" },
    ],
  },
  {
    id: "masonry_condition",
    category: "masonry_concrete",
    step: 3,
    label: {
      es: "¿Cuál es el estado del sitio?",
      en: "What is the condition of the site?",
    },
    description: {
      es: "Demoler concreto existente o preparar el terreno aumenta el costo.",
      en: "Removing existing concrete or preparing the ground increases cost.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "medium",
    answerType: "single_choice",
    allowOther: false,
    allowNotSure: true,
    options: [
      { label: { es: "Terreno listo, obra nueva", en: "Ground ready, new work" }, value: "ready_ground" },
      { label: { es: "Reparación de lo existente", en: "Repair of existing work" }, value: "repair_existing" },
      { label: { es: "Hay que demoler o retirar lo existente", en: "Existing work must be demolished or removed" }, value: "demolition_needed" },
    ],
  },
  {
    id: "masonry_access",
    category: "masonry_concrete",
    step: 4,
    label: {
      es: "¿Pueden entrar camiones y equipo hasta el lugar?",
      en: "Can trucks and equipment reach the site?",
    },
    description: {
      es: "Si el concreto debe llevarse a mano o con bomba, el costo sube.",
      en: "If concrete must be wheeled in or pumped, cost goes up.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "medium",
    answerType: "single_choice",
    allowOther: false,
    allowNotSure: true,
    options: [
      { label: { es: "Sí, acceso directo para camión", en: "Yes, direct truck access" }, value: "easy_access" },
      { label: { es: "Acceso limitado (hay que llevarlo a mano)", en: "Limited access (must be wheeled in)" }, value: "limited_access" },
      { label: { es: "Requiere bomba o equipo especial", en: "Needs a pump or special equipment" }, value: "pump_required" },
    ],
  },
];
