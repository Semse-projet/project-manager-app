import type { IntakeQuestion } from "../../smart-intake.types.js";

export const HANDYMAN_QUESTIONS: IntakeQuestion[] = [
  {
    id: "handyman_type",
    category: "handyman",
    step: 1,
    label: {
      es: "¿Qué tipo de trabajos necesita?",
      en: "What kind of jobs do you need done?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "Armar o montar (muebles, TV, repisas)", en: "Assembly or mounting (furniture, TV, shelves)" }, value: "assembly_mounting" },
      { label: { es: "Reparaciones menores del hogar", en: "Minor home repairs" }, value: "minor_repairs" },
      { label: { es: "Instalar accesorios (cortinas, cerraduras, luminarias simples)", en: "Install fixtures (blinds, locks, simple light fittings)" }, value: "fixture_install" },
      { label: { es: "Lista de varios arreglos pendientes", en: "A list of assorted odd jobs" }, value: "odd_jobs_list" },
      { label: { es: "Podría requerir un profesional con licencia (eléctrico, gas, plomería)", en: "May need a licensed professional (electrical, gas, plumbing)" }, value: "licensed_trade" },
    ],
  },
  {
    id: "handyman_scope",
    category: "handyman",
    step: 2,
    label: {
      es: "¿Cuánto trabajo es en total?",
      en: "How much work is it in total?",
    },
    description: {
      es: "Una estimación de tiempo ayuda: una tarea rápida, media jornada o un día completo o más.",
      en: "A time estimate helps: one quick task, half a day, or a full day or more.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "high",
    answerType: "single_choice",
    allowOther: true,
    allowNotSure: true,
    options: [
      { label: { es: "1 tarea rápida (1 – 2 horas)", en: "1 quick task (1 – 2 hours)" }, value: "small" },
      { label: { es: "Varias tareas (media jornada)", en: "Several tasks (half a day)" }, value: "medium" },
      { label: { es: "Jornada completa o más", en: "Full day or more" }, value: "large" },
    ],
  },
  {
    id: "handyman_materials",
    category: "handyman",
    step: 3,
    label: {
      es: "¿Quién aporta los materiales?",
      en: "Who supplies the materials?",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "medium",
    answerType: "single_choice",
    allowOther: false,
    allowNotSure: true,
    options: [
      { label: { es: "Yo ya los tengo", en: "I already have them" }, value: "client_supplied" },
      { label: { es: "El profesional los compra", en: "The professional buys them" }, value: "contractor_supplied" },
      { label: { es: "Mezcla de ambos", en: "A mix of both" }, value: "mixed" },
    ],
  },
  {
    id: "handyman_access",
    category: "handyman",
    step: 4,
    label: {
      es: "¿Qué tan accesible es el trabajo?",
      en: "How accessible is the work?",
    },
    description: {
      es: "Alturas, espacios reducidos o varios pisos aumentan el tiempo.",
      en: "Heights, tight spaces, or multiple floors increase time.",
    },
    required: false,
    affectsEstimate: true,
    estimateImpact: "medium",
    answerType: "single_choice",
    allowOther: false,
    allowNotSure: true,
    options: [
      { label: { es: "Fácil acceso, planta baja", en: "Easy access, ground floor" }, value: "easy_access" },
      { label: { es: "Alturas, escalera o varios pisos", en: "Heights, ladder or multiple floors" }, value: "elevated_access" },
      { label: { es: "Espacios reducidos", en: "Tight spaces" }, value: "tight_space" },
    ],
  },
];
