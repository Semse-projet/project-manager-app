import type { IntakeWarning } from "../smart-intake.types.js";

export const WARNING_RULES: IntakeWarning[] = [
  {
    id: "warning_mold_present",
    severity: "critical",
    triggeredBy: "condition:mold_or_moisture",
    message: {
      es: "Se detecto posible moho o humedad. Pintar directamente sobre esto no es recomendable.",
      en: "Potential mold or moisture detected. Painting directly over this is not recommended.",
    },
    recommendation: {
      es: "Se requiere limpieza, tratamiento o revision de la causa antes de pintar.",
      en: "Cleaning, treatment, or root-cause inspection is required before painting.",
    },
  },
  {
    id: "warning_area_unknown",
    severity: "caution",
    triggeredBy: "area:not_sure",
    message: {
      es: "Sin area aproximada, el rango del presupuesto sera mas amplio.",
      en: "Without an approximate area, the estimate range will be wider.",
    },
    recommendation: {
      es: "Sube fotos o agrega medidas aproximadas de las paredes.",
      en: "Upload photos or provide approximate wall measurements.",
    },
  },
  {
    id: "warning_labor_only_materials",
    severity: "info",
    triggeredBy: "estimatePreference:labor_only",
    message: {
      es: "Si el cliente provee materiales, debe confirmar tipo, cantidad y calidad.",
      en: "If the client provides materials, they should confirm type, quantity, and quality.",
    },
  },
  {
    id: "warning_hourly_pricing",
    severity: "info",
    triggeredBy: "pricingMode:hourly",
    message: {
      es: "El cobro por hora puede variar segun reparaciones ocultas o tiempos de secado.",
      en: "Hourly billing can vary because of hidden repairs or drying time.",
    },
  },
  {
    id: "warning_electrical_hazard",
    severity: "critical",
    triggeredBy: "prometeo_detection:electrical_hazard",
    message: {
      es: "Se detectaron palabras asociadas a riesgo electrico. Puede requerir profesional certificado.",
      en: "Electrical hazard keywords were detected. A licensed electrician may be required.",
    },
    recommendation: {
      es: "No intentes reparar un problema electrico sin certificacion.",
      en: "Do not attempt electrical repairs without certification.",
    },
  },
];

