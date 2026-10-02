import type { IntakeQuestion } from "../../smart-intake.types.js";

export const PLUMBING_QUESTIONS: IntakeQuestion[] = [
  {
    id: "plumbing_type",
    category: "plumbing_repair",
    step: 1,
    label: {
      es: "¿Qué tipo de trabajo de plomería necesita?",
      en: "What type of plumbing work is needed?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Reparación de fuga", en: "Leak repair" }, value: "leak_repair" },
      { label: { es: "Destapado de cañerías", en: "Clog / drain clearing" }, value: "clog_removal" },
      { label: { es: "Reemplazo de accesorio (grifo, inodoro)", en: "Fixture replacement (faucet, toilet)" }, value: "replacement" },
      { label: { es: "Instalación nueva", en: "New installation" }, value: "new_install" },
      { label: { es: "Re-tubería de una sección", en: "Repiping a section" }, value: "structural" },
    ],
  },
  {
    id: "plumbing_scope",
    category: "plumbing_repair",
    step: 2,
    label: {
      es: "¿Cuántos puntos o accesorios están involucrados?",
      en: "How many fixtures or points are involved?",
    },
    description: {
      es: "Por ejemplo: un lavamanos, varios baños, o toda la casa.",
      en: "For example: one sink, several bathrooms, or the whole house.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "1 accesorio", en: "1 fixture" }, value: "small" },
      { label: { es: "2 – 4 accesorios", en: "2 – 4 fixtures" }, value: "medium" },
      { label: { es: "Toda la casa / sistema completo", en: "Whole house / full system" }, value: "large" },
    ],
  },
  {
    id: "plumbing_access",
    category: "plumbing_repair",
    step: 3,
    label: {
      es: "¿Qué tan accesible es la tubería o el accesorio?",
      en: "How accessible is the pipe or fixture?",
    },
    description: {
      es: "El acceso difícil (detrás de paredes o bajo tierra) aumenta el tiempo de trabajo.",
      en: "Difficult access (behind walls or underground) increases labor time.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "medium",
    answerType: "single_choice",
    allowOther: false,
    allowNotSure: true,
    options: [
      { label: { es: "Acceso fácil (visible, sin romper nada)", en: "Easy access (visible, no demolition)" }, value: "easy_access" },
      { label: { es: "Detrás de pared o gabinete", en: "Behind a wall or cabinet" }, value: "behind_wall" },
      { label: { es: "Bajo tierra o piso", en: "Underground or under the floor" }, value: "underground" },
    ],
  },
  {
    id: "plumbing_material",
    category: "plumbing_repair",
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
