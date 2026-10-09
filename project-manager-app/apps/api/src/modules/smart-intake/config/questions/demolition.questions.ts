import type { IntakeQuestion } from "../../smart-intake.types.js";

export const DEMOLITION_QUESTIONS: IntakeQuestion[] = [
  {
    id: "demolition_type",
    category: "demolition",
    step: 1,
    label: {
      es: "¿Qué hay que demoler o retirar?",
      en: "What needs to be demolished or removed?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Acabados interiores (pisos, gabinetes, azulejos)", en: "Interior finishes (flooring, cabinets, tile)" }, value: "interior_finishes" },
      { label: { es: "Pared no estructural", en: "Non-structural wall" }, value: "partition_wall" },
      { label: { es: "Concreto, patio o acera", en: "Concrete, patio or sidewalk" }, value: "concrete_removal" },
      { label: { es: "Deck, cobertizo o estructura exterior", en: "Deck, shed or outbuilding" }, value: "outbuilding" },
      { label: { es: "Pared que podría ser de carga o demolición de estructura completa", en: "Possibly load-bearing wall or full structure demolition" }, value: "structural" },
    ],
  },
  {
    id: "demolition_scope",
    category: "demolition",
    step: 2,
    label: {
      es: "¿Qué tan grande es la demolición?",
      en: "How large is the demolition?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Pequeña (una habitación o menos de 100 pies²)", en: "Small (one room or under 100 sq ft)" }, value: "small" },
      { label: { es: "Mediana (varias áreas, 100 – 500 pies²)", en: "Medium (several areas, 100 – 500 sq ft)" }, value: "medium" },
      { label: { es: "Grande (más de 500 pies² o una estructura)", en: "Large (over 500 sq ft or a structure)" }, value: "large" },
    ],
  },
  {
    id: "demolition_age",
    category: "demolition",
    step: 3,
    label: {
      es: "¿De qué época es la construcción?",
      en: "When was the building constructed?",
    },
    description: {
      es: "Los materiales anteriores a 1980 pueden contener asbesto o pintura con plomo y requieren pruebas.",
      en: "Pre-1980 materials may contain asbestos or lead paint and require testing.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "medium",
    answerType: "single_choice",
    allowOther: false,
    allowNotSure: true,
    options: [
      { label: { es: "Antes de 1980", en: "Before 1980" }, value: "pre_1980" },
      { label: { es: "1980 o después", en: "1980 or later" }, value: "post_1980" },
    ],
  },
  {
    id: "demolition_disposal",
    category: "demolition",
    step: 4,
    label: {
      es: "¿Quién se encarga de retirar los escombros?",
      en: "Who handles debris removal?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "medium",
    answerType: "single_choice",
    allowOther: false,
    allowNotSure: true,
    options: [
      { label: { es: "El contratista retira todo", en: "The contractor hauls everything away" }, value: "haul_away" },
      { label: { es: "Solo contenedor (yo lo llevo)", en: "Dumpster only (I handle it)" }, value: "dumpster_only" },
      { label: { es: "Yo me encargo de todo", en: "I handle it all" }, value: "client_handles" },
    ],
  },
];
