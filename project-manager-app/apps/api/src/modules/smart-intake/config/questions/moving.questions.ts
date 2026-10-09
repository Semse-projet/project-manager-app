import type { IntakeQuestion } from "../../smart-intake.types.js";

export const MOVING_QUESTIONS: IntakeQuestion[] = [
  {
    id: "moving_type",
    category: "moving",
    step: 1,
    label: {
      es: "¿Qué tipo de mudanza necesita?",
      en: "What type of move do you need?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Casa o apartamento completo", en: "Full house or apartment" }, value: "full_move" },
      { label: { es: "Solo algunos muebles o artículos grandes", en: "Only a few furniture pieces or large items" }, value: "few_items" },
      { label: { es: "Ayuda para cargar o descargar un camión", en: "Help loading or unloading a truck" }, value: "load_unload" },
      { label: { es: "Empaque y mudanza", en: "Packing and moving" }, value: "packing_included" },
    ],
  },
  {
    id: "moving_scope",
    category: "moving",
    step: 2,
    label: {
      es: "¿Qué tan grande es la mudanza?",
      en: "How big is the move?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Estudio o 1 habitación", en: "Studio or 1 bedroom" }, value: "small" },
      { label: { es: "2 – 3 habitaciones", en: "2 – 3 bedrooms" }, value: "medium" },
      { label: { es: "4 habitaciones o más", en: "4+ bedrooms" }, value: "large" },
    ],
  },
  {
    id: "moving_distance",
    category: "moving",
    step: 3,
    label: {
      es: "¿A qué distancia es la mudanza?",
      en: "How far is the move?",
    },
    description: {
      es: "Las mudanzas de larga distancia se cotizan distinto a las locales.",
      en: "Long-distance moves are priced differently from local ones.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "medium",
    answerType: "single_choice",
    allowOther: false,
    allowNotSure: true,
    options: [
      { label: { es: "Local (misma ciudad)", en: "Local (same city)" }, value: "local" },
      { label: { es: "Regional (menos de 100 millas)", en: "Regional (under 100 miles)" }, value: "regional" },
      { label: { es: "Larga distancia o entre estados", en: "Long distance or interstate" }, value: "long_distance" },
    ],
  },
  {
    id: "moving_access",
    category: "moving",
    step: 4,
    label: {
      es: "¿Cómo es el acceso en origen y destino?",
      en: "What is access like at pickup and drop-off?",
    },
    description: {
      es: "Escaleras, distancias largas de carga y artículos pesados (piano, caja fuerte) aumentan el costo.",
      en: "Stairs, long carries and heavy items (piano, safe) increase cost.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "medium",
    answerType: "single_choice",
    allowOther: false,
    allowNotSure: true,
    options: [
      { label: { es: "Planta baja o ascensor", en: "Ground floor or elevator" }, value: "easy_access" },
      { label: { es: "Escaleras o carga larga", en: "Stairs or long carry" }, value: "stairs" },
      { label: { es: "Artículos especiales (piano, caja fuerte, muy pesados)", en: "Specialty items (piano, safe, very heavy)" }, value: "special_items" },
    ],
  },
];
