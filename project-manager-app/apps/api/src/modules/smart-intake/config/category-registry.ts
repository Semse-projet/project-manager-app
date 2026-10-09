import type { BilingualString, IntakeQuestion, SmartIntakeCategory } from "../smart-intake.types.js";
import { PAINTING_QUESTIONS } from "./questions/painting.questions.js";
import { EXTERIOR_PAINTING_QUESTIONS } from "./questions/exterior-painting.questions.js";
import { DRYWALL_QUESTIONS } from "./questions/drywall.questions.js";
import { BATHROOM_QUESTIONS } from "./questions/bathroom.questions.js";
import { KITCHEN_QUESTIONS } from "./questions/kitchen.questions.js";
import { CLEANING_QUESTIONS } from "./questions/cleaning.questions.js";
import { CARPENTRY_QUESTIONS } from "./questions/carpentry.questions.js";
import { PLUMBING_QUESTIONS } from "./questions/plumbing.questions.js";
import { ELECTRICAL_QUESTIONS } from "./questions/electrical.questions.js";
import { FLOORING_QUESTIONS } from "./questions/flooring.questions.js";
import { LANDSCAPING_QUESTIONS } from "./questions/landscaping.questions.js";
import { ROOFING_QUESTIONS } from "./questions/roofing.questions.js";
import { HVAC_QUESTIONS } from "./questions/hvac.questions.js";
import { FENCING_DECKS_QUESTIONS } from "./questions/fencing-decks.questions.js";
import { HANDYMAN_QUESTIONS } from "./questions/handyman.questions.js";
import { MASONRY_CONCRETE_QUESTIONS } from "./questions/masonry-concrete.questions.js";
import { DEMOLITION_QUESTIONS } from "./questions/demolition.questions.js";
import { MOVING_QUESTIONS } from "./questions/moving.questions.js";
import { PRESSURE_WASHING_QUESTIONS } from "./questions/pressure-washing.questions.js";

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

  plumbing_repair: {
    id: "plumbing_repair",
    label: { es: "Plomería", en: "Plumbing" },
    trade: "plumbing",
    projectType: "plumbing-repair",
    keywords: ["plumbing", "plomeria", "plomero", "leak", "fuga", "pipe", "tuberia", "caneria", "clog", "destapado", "drain", "desague", "sanitario", "grifo", "faucet"],
    explicitConfidence: 0.97,
    keywordConfidence: 0.78,
    rates: {
      unit: "fixed",
      baseMin: 80,
      baseMax: 1200,
      fallbackMin: 80,
      fallbackMax: 400,
      complexityMultiplier: { low: 1.0, medium: 1.3, high: 1.7 },
    },
    milestones: STANDARD_MILESTONES,
    questions: PLUMBING_QUESTIONS,
  },

  electrical_work: {
    id: "electrical_work",
    label: { es: "Electricidad", en: "Electrical" },
    trade: "electrical",
    projectType: "electrical-work",
    keywords: ["electrical", "electricidad", "electricista", "wiring", "cableado", "breaker", "panel electrico", "outlet", "tomacorriente", "cortocircuito", "short circuit", "iluminacion electrica"],
    explicitConfidence: 0.97,
    keywordConfidence: 0.78,
    rates: {
      unit: "fixed",
      baseMin: 90,
      baseMax: 2500,
      fallbackMin: 90,
      fallbackMax: 500,
      complexityMultiplier: { low: 1.0, medium: 1.3, high: 1.8 },
    },
    milestones: STANDARD_MILESTONES,
    questions: ELECTRICAL_QUESTIONS,
  },

  flooring_installation: {
    id: "flooring_installation",
    label: { es: "Pisos", en: "Flooring" },
    trade: "flooring",
    projectType: "flooring-installation",
    keywords: ["flooring", "piso", "pisos", "hardwood", "madera piso", "ceramica", "azulejo piso", "laminado", "vinilico", "pulido de piso", "tile floor"],
    explicitConfidence: 0.96,
    keywordConfidence: 0.72,
    rates: {
      unit: "fixed",
      baseMin: 200,
      baseMax: 6000,
      fallbackMin: 200,
      fallbackMax: 2000,
      complexityMultiplier: { low: 1.0, medium: 1.3, high: 1.7 },
    },
    milestones: STANDARD_MILESTONES,
    questions: FLOORING_QUESTIONS,
  },

  landscaping: {
    id: "landscaping",
    label: { es: "Jardinería", en: "Landscaping" },
    trade: "landscaping",
    projectType: "landscaping",
    keywords: ["landscaping", "jardineria", "jardin", "garden", "poda", "pruning", "cesped", "lawn", "riego", "irrigation", "paisajismo", "arboles"],
    explicitConfidence: 0.96,
    keywordConfidence: 0.75,
    rates: {
      unit: "fixed",
      baseMin: 80,
      baseMax: 3000,
      fallbackMin: 80,
      fallbackMax: 500,
      complexityMultiplier: { low: 1.0, medium: 1.3, high: 1.7 },
    },
    milestones: STANDARD_MILESTONES,
    questions: LANDSCAPING_QUESTIONS,
  },
  roofing: {
    id: "roofing",
    label: { es: "Techos", en: "Roofing" },
    trade: "roofing",
    projectType: "roofing",
    keywords: ["roof", "roofing", "techo", "techos", "tejado", "gotera", "shingle", "shingles", "teja", "tejas", "canaleta", "gutter", "azotea con filtracion"],
    explicitConfidence: 0.96,
    keywordConfidence: 0.78,
    rates: {
      unit: "fixed",
      baseMin: 300,
      baseMax: 18000,
      fallbackMin: 300,
      fallbackMax: 6000,
      complexityMultiplier: { low: 1.0, medium: 1.3, high: 1.8 },
    },
    milestones: HIGH_VALUE_MILESTONES,
    questions: ROOFING_QUESTIONS,
  },

  hvac: {
    id: "hvac",
    label: { es: "Climatización (HVAC)", en: "HVAC" },
    trade: "hvac",
    projectType: "hvac",
    keywords: ["hvac", "air conditioning", "aire acondicionado", "a/c", "mini split", "minisplit", "furnace", "calefaccion", "heating", "ducto", "ductos", "ductwork", "climatizacion", "condensador", "thermostat", "termostato"],
    explicitConfidence: 0.96,
    keywordConfidence: 0.80,
    rates: {
      unit: "fixed",
      baseMin: 120,
      baseMax: 12000,
      fallbackMin: 120,
      fallbackMax: 3500,
      complexityMultiplier: { low: 1.0, medium: 1.3, high: 1.7 },
    },
    milestones: STANDARD_MILESTONES,
    questions: HVAC_QUESTIONS,
  },
  fencing_decks: {
    id: "fencing_decks",
    label: { es: "Cercas y decks", en: "Fencing and decks" },
    trade: "fencing",
    projectType: "fencing-decks",
    keywords: ["fence", "fencing", "cercado", "cercas", "cerca de madera", "cerca de metal", "cerca perimetral", "cerco", "valla", "deck", "decking", "pergola", "gazebo", "railing", "baranda"],
    explicitConfidence: 0.96,
    keywordConfidence: 0.78,
    rates: {
      unit: "fixed",
      baseMin: 200,
      baseMax: 20000,
      fallbackMin: 200,
      fallbackMax: 6000,
      complexityMultiplier: { low: 1.0, medium: 1.3, high: 1.7 },
    },
    milestones: HIGH_VALUE_MILESTONES,
    questions: FENCING_DECKS_QUESTIONS,
  },
  handyman: {
    id: "handyman",
    label: { es: "Arreglos generales (handyman)", en: "Handyman" },
    trade: "handyman",
    projectType: "handyman",
    keywords: ["handyman", "handy man", "manitas", "odd jobs", "small repairs", "minor repairs", "arreglos varios", "reparaciones menores", "pequenas reparaciones", "pequeñas reparaciones", "mount a tv", "mount tv", "montar tv", "montar un tv", "montar el tv", "assemble furniture", "armar muebles", "ensamblar muebles", "punch list", "hang shelves", "colgar cuadros", "colgar repisas"],
    explicitConfidence: 0.95,
    keywordConfidence: 0.74,
    rates: {
      unit: "fixed",
      baseMin: 90,
      baseMax: 1200,
      fallbackMin: 90,
      fallbackMax: 450,
      complexityMultiplier: { low: 1.0, medium: 1.25, high: 1.6 },
    },
    milestones: [
      {
        order: 1,
        title: { es: "Confirmación de tareas y acceso", en: "Task list and access confirmation" },
        description: { es: "Confirmación de la lista de tareas, materiales, fecha y acceso.", en: "Task list, materials, date, and access confirmation." },
        paymentPercentage: 30,
        requiresEvidence: false,
      },
      {
        order: 2,
        title: { es: "Trabajos completados", en: "Work completed" },
        description: { es: "Todas las tareas terminadas y aprobadas por el cliente.", en: "All tasks completed and approved by the client." },
        paymentPercentage: 70,
        requiresEvidence: true,
      },
    ],
    questions: HANDYMAN_QUESTIONS,
  },
  masonry_concrete: {
    id: "masonry_concrete",
    label: { es: "Albañilería y concreto", en: "Masonry and concrete" },
    trade: "masonry",
    projectType: "masonry-concrete",
    keywords: ["concrete", "concreto", "hormigon", "cemento", "cement", "masonry", "mamposteria", "albanileria", "albañilería", "brick", "bricks", "ladrillo", "ladrillos", "paver", "pavers", "adoquin", "adoquines", "driveway", "entrada de autos", "sidewalk", "acera", "banqueta", "slab", "retaining wall", "muro de contencion", "chimney", "chimenea", "foundation", "cimentacion", "cimiento"],
    explicitConfidence: 0.96,
    keywordConfidence: 0.78,
    rates: {
      unit: "fixed",
      baseMin: 300,
      baseMax: 25000,
      fallbackMin: 300,
      fallbackMax: 7000,
      complexityMultiplier: { low: 1.0, medium: 1.3, high: 1.8 },
    },
    milestones: HIGH_VALUE_MILESTONES,
    questions: MASONRY_CONCRETE_QUESTIONS,
  },
  demolition: {
    id: "demolition",
    label: { es: "Demolición", en: "Demolition" },
    trade: "demolition",
    projectType: "demolition",
    keywords: ["demolition", "demolicion", "demolish", "demoler", "tear down", "teardown", "derribar", "derribo", "knock down", "tumbar", "gutting", "debris removal", "escombros"],
    explicitConfidence: 0.96,
    keywordConfidence: 0.80,
    rates: {
      unit: "fixed",
      baseMin: 400,
      baseMax: 20000,
      fallbackMin: 400,
      fallbackMax: 6000,
      complexityMultiplier: { low: 1.0, medium: 1.35, high: 1.9 },
    },
    milestones: STANDARD_MILESTONES,
    questions: DEMOLITION_QUESTIONS,
  },

  moving: {
    id: "moving",
    label: { es: "Mudanzas", en: "Moving" },
    trade: "moving",
    projectType: "moving",
    keywords: ["mudanza", "mudanzas", "trasteo", "moving company", "moving help", "help moving", "furniture movers", "mover muebles", "need movers", "hire movers", "packing and moving", "empacar"],
    explicitConfidence: 0.96,
    keywordConfidence: 0.80,
    rates: {
      unit: "fixed",
      baseMin: 150,
      baseMax: 4000,
      fallbackMin: 150,
      fallbackMax: 1500,
      complexityMultiplier: { low: 1.0, medium: 1.2, high: 1.5 },
    },
    milestones: [
      {
        order: 1,
        title: { es: "Confirmación de fecha y acceso", en: "Date and access confirmation" },
        description: { es: "Confirmación de fecha, direcciones, inventario y acceso.", en: "Date, addresses, inventory, and access confirmation." },
        paymentPercentage: 30,
        requiresEvidence: false,
      },
      {
        order: 2,
        title: { es: "Mudanza completada", en: "Move completed" },
        description: { es: "Todo entregado en destino y aprobado por el cliente.", en: "Everything delivered at destination and approved by the client." },
        paymentPercentage: 70,
        requiresEvidence: true,
      },
    ],
    questions: MOVING_QUESTIONS,
  },

  pressure_washing: {
    id: "pressure_washing",
    label: { es: "Lavado a presión", en: "Pressure washing" },
    trade: "pressure-washing",
    projectType: "pressure-washing",
    keywords: ["pressure wash", "pressure washing", "power wash", "power washing", "soft wash", "lavado a presion", "lavado a presión", "lavado con presion", "hidrolavadora", "hidrolavado", "hidrolavar"],
    explicitConfidence: 0.96,
    keywordConfidence: 0.82,
    rates: {
      unit: "fixed",
      baseMin: 100,
      baseMax: 1500,
      fallbackMin: 100,
      fallbackMax: 500,
      complexityMultiplier: { low: 1.0, medium: 1.2, high: 1.5 },
    },
    milestones: [
      {
        order: 1,
        title: { es: "Confirmación de alcance y acceso", en: "Scope and access confirmation" },
        description: { es: "Confirmación de superficies, fecha y acceso a agua y electricidad.", en: "Surfaces, date, and water/power access confirmation." },
        paymentPercentage: 30,
        requiresEvidence: false,
      },
      {
        order: 2,
        title: { es: "Lavado completado", en: "Washing completed" },
        description: { es: "Trabajo terminado con fotos antes y después, aprobado por el cliente.", en: "Work completed with before/after photos, approved by the client." },
        paymentPercentage: 70,
        requiresEvidence: true,
      },
    ],
    questions: PRESSURE_WASHING_QUESTIONS,
  },
};

/** Ordered by specificity — more specific keywords checked first */
const DETECTION_ORDER: SmartIntakeCategory[] = [
  "bathroom_remodel",
  "kitchen_remodel",
  "drywall_repair",      // before interior_painting: "agujero en pared", "yeso", "sheetrock"
  "pressure_washing",    // before exterior_painting/cleaning: "exterior"/"limpieza" would swallow it
  "demolition",          // before exterior_painting/masonry: "demoler un muro de concreto"
  "exterior_painting",   // before interior_painting: "exterior", "fachada"
  "masonry_concrete",    // before interior_painting: its "wall" keyword would swallow "retaining wall"
  "interior_painting",
  "cleaning",
  "moving",              // after cleaning: "limpieza de mudanza" stays cleaning
  "plumbing_repair",     // before general_carpentry: avoids "pipe"/"floor" ambiguity
  "electrical_work",
  "flooring_installation", // before general_carpentry: its "floor"/"piso" keywords are broader
  "landscaping",
  "roofing",             // before general_carpentry: "teja"/"techo" are specific
  "hvac",
  "fencing_decks",       // before general_carpentry: its "deck"/"terraza" keywords overlap
  "general_carpentry",   // broadest keyword set — checked last
  "handyman",            // last: generic odd-jobs phrases must never steal a specific trade
];

/**
 * Short keywords (<= 3 chars, e.g. "tub") only match as whole words, so they
 * don't fire inside longer words such as "tuberia".
 */
function matchesKeyword(lowerText: string, keyword: string): boolean {
  if (keyword.length > 3) return lowerText.includes(keyword);
  let from = 0;
  const isLetter = (ch: string | undefined) => ch !== undefined && /[a-záéíóúñü]/i.test(ch);
  for (;;) {
    const i = lowerText.indexOf(keyword, from);
    if (i === -1) return false;
    if (!isLetter(lowerText[i - 1]) && !isLetter(lowerText[i + keyword.length])) return true;
    from = i + 1;
  }
}

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
    if (def.keywords.some((kw) => matchesKeyword(lower, kw))) {
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
  if (def.keywords.some((kw) => matchesKeyword(lower, kw))) {
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
    case "plomeria":
    case "plumbing":
      return "plumbing_repair";
    case "electricidad":
    case "electrical":
      return "electrical_work";
    case "pisos":
    case "flooring":
      return "flooring_installation";
    case "jardineria":
    case "landscaping":
    case "gardening":
      return "landscaping";
    case "techos":
    case "roofing":
      return "roofing";
    case "cercas":
    case "fencing":
    case "decks":
      return "fencing_decks";
    case "handyman":
    case "manitas":
    case "mantenimiento":
      return "handyman";
    case "albanileria":
    case "masonry":
    case "concreto":
    case "concrete":
      return "masonry_concrete";
    case "demolicion":
    case "demolition":
      return "demolition";
    case "mudanza":
    case "mudanzas":
    case "moving":
      return "moving";
    case "lavado":
    case "lavado_presion":
    case "pressure_washing":
    case "hidrolavado":
      return "pressure_washing";
    case "climatizacion":
    case "hvac":
    case "aire":
      return "hvac";
    default:
      return null;
  }
}
