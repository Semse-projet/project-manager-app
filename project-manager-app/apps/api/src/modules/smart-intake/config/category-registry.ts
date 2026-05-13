import type { BilingualString, IntakeQuestion, SmartIntakeCategory } from "../smart-intake.types.js";
import { PAINTING_QUESTIONS } from "./questions/painting.questions.js";
import { EXTERIOR_PAINTING_QUESTIONS } from "./questions/exterior-painting.questions.js";
import { DRYWALL_QUESTIONS } from "./questions/drywall.questions.js";
import { BATHROOM_QUESTIONS } from "./questions/bathroom.questions.js";
import { KITCHEN_QUESTIONS } from "./questions/kitchen.questions.js";
import { CLEANING_QUESTIONS } from "./questions/cleaning.questions.js";
import { CARPENTRY_QUESTIONS } from "./questions/carpentry.questions.js";

export type MilestoneTemplate = {
  order: number;
  title: BilingualString;
  description: BilingualString;
  paymentPercentage: number;
  requiresEvidence: boolean;
};

export type CategoryRates = {
  /** Base rate per sqft (labor) or per hour */
  unit: "sqft" | "hourly" | "fixed";
  baseMin: number;
  baseMax: number;
  /** Floor estimate when no area data is available */
  fallbackMin: number;
  fallbackMax: number;
  /** Applied when condition is bad / access is difficult */
  complexityMultiplier: { low: number; medium: number; high: number };
};

export type CategoryDefinition = {
  id: SmartIntakeCategory;
  label: BilingualString;
  /** Trade slug sent to bridge service */
  trade: string;
  /** ProjectType slug for BuildOpsProject */
  projectType: string;
  /** Keywords (lowercase) used for auto-detection from rawDescription */
  keywords: string[];
  /** Confidence when user explicitly selected this category */
  explicitConfidence: number;
  /** Confidence when detected from keywords */
  keywordConfidence: number;
  rates: CategoryRates;
  milestones: MilestoneTemplate[];
  questions: IntakeQuestion[];
};

const STANDARD_MILESTONES: MilestoneTemplate[] = [
  {
    order: 1,
    title: { es: "Confirmación de alcance y depósito", en: "Scope confirmation and deposit" },
    description: { es: "Confirmación de materiales, medidas y depósito inicial.", en: "Material, measurements, and initial deposit confirmation." },
    paymentPercentage: 35,
    requiresEvidence: true,
  },
  {
    order: 2,
    title: { es: "Trabajo en progreso", en: "Work in progress" },
    description: { es: "Ejecución del trabajo principal con evidencia fotográfica.", en: "Main work execution with photo evidence." },
    paymentPercentage: 45,
    requiresEvidence: true,
  },
  {
    order: 3,
    title: { es: "Finalización y limpieza", en: "Completion and cleanup" },
    description: { es: "Trabajo terminado, limpieza y aprobación final del cliente.", en: "Work completed, cleanup, and final client approval." },
    paymentPercentage: 20,
    requiresEvidence: true,
  },
];

const HIGH_VALUE_MILESTONES: MilestoneTemplate[] = [
  {
    order: 1,
    title: { es: "Depósito y confirmación de diseño", en: "Deposit and design confirmation" },
    description: { es: "Planos, materiales y permisos confirmados. Depósito inicial.", en: "Plans, materials, and permits confirmed. Initial deposit." },
    paymentPercentage: 30,
    requiresEvidence: true,
  },
  {
    order: 2,
    title: { es: "Demolición y preparación", en: "Demolition and preparation" },
    description: { es: "Remoción del material existente y preparación del espacio.", en: "Removal of existing material and space preparation." },
    paymentPercentage: 20,
    requiresEvidence: true,
  },
  {
    order: 3,
    title: { es: "Instalación principal", en: "Main installation" },
    description: { es: "Instalación de los elementos principales del proyecto.", en: "Installation of the main project elements." },
    paymentPercentage: 35,
    requiresEvidence: true,
  },
  {
    order: 4,
    title: { es: "Acabados y entrega final", en: "Finishing and final handover" },
    description: { es: "Acabados, revisión y aprobación final del cliente.", en: "Finishing, inspection, and final client approval." },
    paymentPercentage: 15,
    requiresEvidence: true,
  },
];

export const CATEGORY_REGISTRY: Record<SmartIntakeCategory, CategoryDefinition> = {
  interior_painting: {
    id: "interior_painting",
    label: { es: "Pintura interior", en: "Interior painting" },
    trade: "painting",
    projectType: "interior-painting",
    keywords: ["paint", "painting", "wall", "walls", "pintar", "pintura", "pared", "paredes", "interior paint", "pintura interior"],
    explicitConfidence: 0.98,
    keywordConfidence: 0.72,
    rates: {
      unit: "sqft",
      baseMin: 0.75,
      baseMax: 1.5,
      fallbackMin: 150,
      fallbackMax: 400,
      complexityMultiplier: { low: 1.0, medium: 1.2, high: 1.5 },
    },
    milestones: STANDARD_MILESTONES,
    questions: PAINTING_QUESTIONS,
  },

  exterior_painting: {
    id: "exterior_painting",
    label: { es: "Pintura exterior", en: "Exterior painting" },
    trade: "painting",
    projectType: "exterior-painting",
    keywords: ["exterior paint", "outside paint", "pintura exterior", "siding paint", "fachada", "outdoor", "exterior"],
    explicitConfidence: 0.98,
    keywordConfidence: 0.75,
    rates: {
      unit: "sqft",
      baseMin: 1.0,
      baseMax: 2.0,
      fallbackMin: 500,
      fallbackMax: 1500,
      complexityMultiplier: { low: 1.0, medium: 1.3, high: 1.7 },
    },
    milestones: STANDARD_MILESTONES,
    questions: EXTERIOR_PAINTING_QUESTIONS,
  },

  drywall_repair: {
    id: "drywall_repair",
    label: { es: "Reparación de drywall", en: "Drywall repair" },
    trade: "drywall",
    projectType: "drywall-repair",
    keywords: ["drywall", "sheetrock", "placa", "yeso", "pared de yeso", "agujero en pared", "hole in wall", "wall repair", "reparacion pared", "textura"],
    explicitConfidence: 0.97,
    keywordConfidence: 0.80,
    rates: {
      unit: "sqft",
      baseMin: 2.5,
      baseMax: 5.5,
      fallbackMin: 200,
      fallbackMax: 800,
      complexityMultiplier: { low: 1.0, medium: 1.25, high: 1.6 },
    },
    milestones: STANDARD_MILESTONES,
    questions: DRYWALL_QUESTIONS,
  },

  bathroom_remodel: {
    id: "bathroom_remodel",
    label: { es: "Remodelación de baño", en: "Bathroom remodel" },
    trade: "remodeling",
    projectType: "bathroom-remodel",
    keywords: ["bathroom", "bath", "baño", "shower", "ducha", "tub", "tina", "toilet", "inodoro", "tile", "azulejo", "vanity", "lavamanos", "plomeria baño"],
    explicitConfidence: 0.97,
    keywordConfidence: 0.78,
    rates: {
      unit: "fixed",
      baseMin: 3000,
      baseMax: 15000,
      fallbackMin: 3000,
      fallbackMax: 10000,
      complexityMultiplier: { low: 1.0, medium: 1.4, high: 2.0 },
    },
    milestones: HIGH_VALUE_MILESTONES,
    questions: BATHROOM_QUESTIONS,
  },

  kitchen_remodel: {
    id: "kitchen_remodel",
    label: { es: "Remodelación de cocina", en: "Kitchen remodel" },
    trade: "remodeling",
    projectType: "kitchen-remodel",
    keywords: ["kitchen", "cocina", "cabinet", "gabinete", "countertop", "encimera", "mesada", "appliance", "electrodomestico", "refrigerator", "nevera", "stove", "estufa"],
    explicitConfidence: 0.97,
    keywordConfidence: 0.78,
    rates: {
      unit: "fixed",
      baseMin: 5000,
      baseMax: 40000,
      fallbackMin: 5000,
      fallbackMax: 25000,
      complexityMultiplier: { low: 1.0, medium: 1.3, high: 1.8 },
    },
    milestones: HIGH_VALUE_MILESTONES,
    questions: KITCHEN_QUESTIONS,
  },

  cleaning: {
    id: "cleaning",
    label: { es: "Limpieza", en: "Cleaning" },
    trade: "cleaning",
    projectType: "residential-cleaning",
    keywords: ["clean", "cleaning", "limpieza", "limpiar", "deep clean", "limpieza profunda", "move out clean", "post construction clean", "maid", "ama de llaves"],
    explicitConfidence: 0.97,
    keywordConfidence: 0.82,
    rates: {
      unit: "hourly",
      baseMin: 25,
      baseMax: 60,
      fallbackMin: 100,
      fallbackMax: 400,
      complexityMultiplier: { low: 1.0, medium: 1.3, high: 1.6 },
    },
    milestones: [
      {
        order: 1,
        title: { es: "Confirmación y acceso", en: "Confirmation and access" },
        description: { es: "Confirmación de fecha, horario y acceso al espacio.", en: "Date, schedule, and space access confirmation." },
        paymentPercentage: 30,
        requiresEvidence: false,
      },
      {
        order: 2,
        title: { es: "Servicio completado", en: "Service completed" },
        description: { es: "Limpieza completada y aprobada por el cliente.", en: "Cleaning completed and approved by client." },
        paymentPercentage: 70,
        requiresEvidence: true,
      },
    ],
    questions: CLEANING_QUESTIONS,
  },

  general_carpentry: {
    id: "general_carpentry",
    label: { es: "Carpintería general", en: "General carpentry" },
    trade: "carpentry",
    projectType: "general-carpentry",
    keywords: ["door", "window", "puerta", "ventana", "floor", "piso", "hardwood", "madera", "deck", "terrace", "terraza", "cabinet", "closet", "armario", "carpentry", "carpinteria", "wood"],
    explicitConfidence: 0.96,
    keywordConfidence: 0.70,
    rates: {
      unit: "fixed",
      baseMin: 500,
      baseMax: 8000,
      fallbackMin: 500,
      fallbackMax: 3000,
      complexityMultiplier: { low: 1.0, medium: 1.3, high: 1.7 },
    },
    milestones: STANDARD_MILESTONES,
    questions: CARPENTRY_QUESTIONS,
  },
};

/** Ordered by specificity — more specific keywords checked first */
const DETECTION_ORDER: SmartIntakeCategory[] = [
  "bathroom_remodel",
  "kitchen_remodel",
  "drywall_repair",      // before interior_painting: "agujero en pared", "yeso", "sheetrock"
  "exterior_painting",   // before interior_painting: "exterior", "fachada"
  "interior_painting",
  "cleaning",
  "general_carpentry",
];

export function detectCategoryFromText(input: {
  selectedCategoryId?: string | null;
  selectedSubcategoryId?: string | null;
  rawDescription: string;
}): SmartIntakeCategory {
  // Explicit selection takes priority
  if (input.selectedCategoryId) {
    const mapped = mapSelectedCategoryId(input.selectedCategoryId, input.selectedSubcategoryId ?? null);
    if (mapped) return mapped;
  }

  const lower = input.rawDescription.toLowerCase();
  for (const categoryId of DETECTION_ORDER) {
    const def = CATEGORY_REGISTRY[categoryId];
    if (def.keywords.some((kw) => lower.includes(kw))) {
      return categoryId;
    }
  }

  return "interior_painting";
}

export function getCategoryConfidence(input: {
  selectedCategoryId?: string | null;
  selectedSubcategoryId?: string | null;
  rawDescription: string;
  detectedCategory: SmartIntakeCategory;
}): number {
  if (input.selectedCategoryId) {
    const def = CATEGORY_REGISTRY[input.detectedCategory];
    return def.explicitConfidence;
  }

  const lower = input.rawDescription.toLowerCase();
  const def = CATEGORY_REGISTRY[input.detectedCategory];
  if (def.keywords.some((kw) => lower.includes(kw))) {
    return def.keywordConfidence;
  }

  return 0.24;
}

function mapSelectedCategoryId(
  selectedCategoryId: string,
  selectedSubcategoryId: string | null,
): SmartIntakeCategory | null {
  switch (selectedCategoryId) {
    case "pintura":
    case "painting":
      return selectedSubcategoryId === "exterior" ? "exterior_painting" : "interior_painting";
    case "drywall":
      return "drywall_repair";
    case "bano":
    case "bathroom":
      return "bathroom_remodel";
    case "cocina":
    case "kitchen":
      return "kitchen_remodel";
    case "limpieza":
    case "cleaning":
      return "cleaning";
    case "carpinteria":
    case "carpentry":
    case "ventanas":
    case "puertas":
    case "windows":
    case "doors":
      return "general_carpentry";
    default:
      return null;
  }
}
