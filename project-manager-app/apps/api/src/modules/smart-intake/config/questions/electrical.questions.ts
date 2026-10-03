import type { IntakeQuestion } from "../../smart-intake.types.js";

export const ELECTRICAL_QUESTIONS: IntakeQuestion[] = [
  {
    id: "electrical_type",
    category: "electrical_work",
    step: 1,
    label: {
      es: "¿Qué tipo de trabajo eléctrico necesita?",
      en: "What type of electrical work is needed?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Tomacorriente o interruptor", en: "Outlet or switch" }, value: "minor" },
      { label: { es: "Instalación de iluminación", en: "Lighting installation" }, value: "lighting" },
      { label: { es: "Actualización de panel eléctrico", en: "Panel upgrade" }, value: "panel_upgrade" },
      { label: { es: "Recableado de una zona", en: "Rewiring a section" }, value: "structural" },
      { label: { es: "Instalación nueva", en: "New installation" }, value: "new_install" },
    ],
    warningIfSelected: {
      optionValue: "structural",
      warningId: "warning_electrical_hazard",
    },
  },
  {
    id: "electrical_scope",
    category: "electrical_work",
    step: 2,
    label: {
      es: "¿Cuántos puntos o circuitos están involucrados?",
      en: "How many points or circuits are involved?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "1 circuito o punto", en: "1 circuit or point" }, value: "small" },
      { label: { es: "2 – 5 puntos", en: "2 – 5 points" }, value: "medium" },
      { label: { es: "Toda la casa / panel completo", en: "Whole house / full panel" }, value: "large" },
    ],
  },
  {
    id: "electrical_panel",
    category: "electrical_work",
    step: 3,
    label: {
      es: "¿En qué estado está el panel eléctrico actual?",
      en: "What condition is the current electrical panel in?",
    },
    description: {
      es: "Un panel antiguo o subdimensionado puede requerir trabajo adicional.",
      en: "An old or undersized panel may require extra work.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "medium",
    answerType: "single_choice",
    allowOther: false,
    allowNotSure: true,
    options: [
      { label: { es: "Adecuado y moderno", en: "Adequate and modern" }, value: "good" },
      { label: { es: "Antiguo pero funcional", en: "Older but functional" }, value: "aging_panel" },
      { label: { es: "Necesita reemplazo", en: "Needs replacement" }, value: "structural" },
    ],
  },
  {
    id: "electrical_material",
    category: "electrical_work",
    step: 4,
    label: {
      es: "¿Qué calidad de materiales prefiere?",
      en: "What quality of materials do you prefer?",
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
      { label: { es: "Premium", en: "Premium" }, value: "premium" },
    ],
  },
];
