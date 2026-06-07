import type { IntakeQuestion } from "../../smart-intake.types.js";

export const DRYWALL_QUESTIONS: IntakeQuestion[] = [
  {
    id: "drywall_type",
    category: "drywall_repair",
    step: 1,
    label: {
      es: "¿Qué tipo de trabajo de drywall se necesita?",
      en: "What type of drywall work is needed?",
    },
    description: {
      es: "Esto define si es reparación puntual o instalación nueva.",
      en: "This defines whether it is a spot repair or new installation.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Reparación de agujeros / grietas", en: "Hole or crack repair" }, value: "repair" },
      { label: { es: "Instalación de drywall nuevo", en: "New drywall installation" }, value: "new_install" },
      { label: { es: "Reemplazo de paneles dañados", en: "Damaged panel replacement" }, value: "replacement" },
      { label: { es: "Acabado / textura / lija", en: "Finishing / texture / sanding" }, value: "finishing" },
    ],
  },
  {
    id: "drywall_area",
    category: "drywall_repair",
    step: 2,
    label: {
      es: "¿Cuánto drywall necesita trabajo?",
      en: "How much drywall needs work?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Reparaciones puntuales (menos de 10 sq ft)", en: "Small patches (under 10 sq ft)" }, value: "patches" },
      { label: { es: "Un cuarto o área (10 – 100 sq ft)", en: "One room or area (10 – 100 sq ft)" }, value: "10_100_sqft" },
      { label: { es: "Múltiples cuartos (100 – 500 sq ft)", en: "Multiple rooms (100 – 500 sq ft)" }, value: "100_500_sqft" },
      { label: { es: "Área grande (más de 500 sq ft)", en: "Large area (over 500 sq ft)" }, value: "over_500_sqft" },
    ],
  },
  {
    id: "drywall_condition",
    category: "drywall_repair",
    step: 3,
    label: {
      es: "¿Cuál es la causa principal del daño?",
      en: "What is the main cause of the damage?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "medium",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Golpes o agujeros normales", en: "Normal holes or dents" }, value: "normal_wear" },
      { label: { es: "Agua o humedad", en: "Water or moisture" }, value: "water_damage" },
      { label: { es: "Grietas estructurales", en: "Structural cracks" }, value: "structural" },
      { label: { es: "Daño por insectos o plagas", en: "Insect or pest damage" }, value: "pest" },
    ],
    warningIfSelected: {
      optionValue: "structural",
      warningId: "warning_structural_damage",
    },
  },
  {
    id: "drywall_finish",
    category: "drywall_repair",
    step: 4,
    label: {
      es: "¿Qué nivel de acabado necesita?",
      en: "What finish level is needed?",
    },
    description: {
      es: "El nivel de acabado afecta cuánto tiempo lleva dejar listo para pintar.",
      en: "Finish level affects how long it takes to be paint-ready.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "medium",
    answerType: "single_choice",
    allowOther: false,
    allowNotSure: true,
    options: [
      { label: { es: "Solo reparar — sin acabado final", en: "Repair only — no final finish" }, value: "repair_only" },
      { label: { es: "Listo para pintar", en: "Paint-ready" }, value: "paint_ready" },
      { label: { es: "Textura y acabado completo", en: "Texture and full finish" }, value: "full_finish" },
    ],
  },
];
