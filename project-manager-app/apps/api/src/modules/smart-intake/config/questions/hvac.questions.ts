import type { IntakeQuestion } from "../../smart-intake.types.js";

export const HVAC_QUESTIONS: IntakeQuestion[] = [
  {
    id: "hvac_type",
    category: "hvac",
    step: 1,
    label: {
      es: "¿Qué tipo de trabajo de climatización necesita?",
      en: "What type of HVAC work is needed?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Mantenimiento o limpieza", en: "Maintenance or cleaning" }, value: "maintenance" },
      { label: { es: "Reparación de equipo existente", en: "Repair of existing unit" }, value: "repair" },
      { label: { es: "Reemplazo de equipo", en: "Unit replacement" }, value: "replacement" },
      { label: { es: "Instalación nueva (mini split o central)", en: "New installation (mini split or central)" }, value: "new_install" },
      { label: { es: "Ductos nuevos o rediseño de ductos", en: "New or redesigned ductwork" }, value: "structural" },
    ],
  },
  {
    id: "hvac_scope",
    category: "hvac",
    step: 2,
    label: {
      es: "¿Cuántas zonas o equipos están involucrados?",
      en: "How many zones or units are involved?",
    },
    description: {
      es: "Por ejemplo: una habitación, varias zonas, o toda la casa.",
      en: "For example: one room, several zones, or the whole house.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "1 equipo o zona", en: "1 unit or zone" }, value: "small" },
      { label: { es: "2 – 3 equipos o zonas", en: "2 – 3 units or zones" }, value: "medium" },
      { label: { es: "Toda la casa / sistema central", en: "Whole house / central system" }, value: "large" },
    ],
  },
  {
    id: "hvac_access",
    category: "hvac",
    step: 3,
    label: {
      es: "¿Dónde está o estará el equipo?",
      en: "Where is or will the equipment be located?",
    },
    description: {
      es: "Áticos y espacios reducidos aumentan el tiempo de trabajo.",
      en: "Attics and tight spaces increase labor time.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "medium",
    answerType: "single_choice",
    allowOther: false,
    allowNotSure: true,
    options: [
      { label: { es: "Fácil acceso (exterior o cuarto de equipos)", en: "Easy access (outdoors or equipment room)" }, value: "easy_access" },
      { label: { es: "Ático o espacio reducido", en: "Attic or crawl space" }, value: "tight_space" },
      { label: { es: "Techo o azotea", en: "Rooftop" }, value: "rooftop" },
    ],
  },
  {
    id: "hvac_equipment",
    category: "hvac",
    step: 4,
    label: {
      es: "¿Qué gama de equipo prefiere?",
      en: "What equipment tier do you prefer?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "medium",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Económico", en: "Budget" }, value: "budget" },
      { label: { es: "Estándar", en: "Standard" }, value: "standard" },
      { label: { es: "Alta eficiencia / inverter", en: "High efficiency / inverter" }, value: "premium" },
    ],
  },
];
