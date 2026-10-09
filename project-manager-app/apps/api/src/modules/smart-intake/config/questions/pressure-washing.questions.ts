import type { IntakeQuestion } from "../../smart-intake.types.js";

export const PRESSURE_WASHING_QUESTIONS: IntakeQuestion[] = [
  {
    id: "pw_surface",
    category: "pressure_washing",
    step: 1,
    label: {
      es: "¿Qué superficie necesita lavar?",
      en: "What surface needs washing?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Entrada de autos, acera o patio de concreto", en: "Driveway, sidewalk or concrete patio" }, value: "concrete_flatwork" },
      { label: { es: "Paredes exteriores de la casa", en: "House exterior walls / siding" }, value: "siding" },
      { label: { es: "Deck o cerca de madera", en: "Wood deck or fence" }, value: "wood" },
      { label: { es: "Techo", en: "Roof" }, value: "roof" },
    ],
  },
  {
    id: "pw_scope",
    category: "pressure_washing",
    step: 2,
    label: {
      es: "¿Qué tamaño tiene el área?",
      en: "How large is the area?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Pequeña (menos de 300 pies²)", en: "Small (under 300 sq ft)" }, value: "small" },
      { label: { es: "Mediana (300 – 1,000 pies²)", en: "Medium (300 – 1,000 sq ft)" }, value: "medium" },
      { label: { es: "Grande (más de 1,000 pies² o casa completa)", en: "Large (over 1,000 sq ft or whole house)" }, value: "large" },
    ],
  },
  {
    id: "pw_condition",
    category: "pressure_washing",
    step: 3,
    label: {
      es: "¿Qué tan sucia está la superficie?",
      en: "How dirty is the surface?",
    },
    description: {
      es: "Manchas de aceite, óxido o grafiti no siempre salen por completo.",
      en: "Oil, rust or graffiti stains do not always come out completely.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "medium",
    answerType: "single_choice",
    allowOther: false,
    allowNotSure: true,
    options: [
      { label: { es: "Suciedad ligera o polvo", en: "Light dirt or dust" }, value: "light_dirt" },
      { label: { es: "Moho, algas o musgo", en: "Mold, algae or moss" }, value: "mold_algae" },
      { label: { es: "Manchas de aceite, óxido o grafiti", en: "Oil, rust or graffiti stains" }, value: "heavy_staining" },
    ],
  },
  {
    id: "pw_water",
    category: "pressure_washing",
    step: 4,
    label: {
      es: "¿Hay toma de agua y electricidad disponible?",
      en: "Is a water source and power available?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "low",
    answerType: "single_choice",
    allowOther: false,
    allowNotSure: true,
    options: [
      { label: { es: "Sí, ambas", en: "Yes, both" }, value: "available" },
      { label: { es: "No hay toma de agua (el equipo lleva tanque)", en: "No water source (crew brings a tank)" }, value: "no_water" },
    ],
  },
];
