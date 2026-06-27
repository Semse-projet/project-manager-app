import Stripe from "stripe";
import { ENV } from "./_core/env";

// Initialize Stripe only when the secret key is configured.
// In tests and local dev without Stripe, the instance will be null.
function createStripeClient(): Stripe | null {
  if (!ENV.stripeSecretKey) {
    console.warn("[Stripe] STRIPE_SECRET_KEY not configured. Stripe features disabled.");
    return null;
  }
  return new Stripe(ENV.stripeSecretKey, {
    apiVersion: "2026-06-24.dahlia",
  });
}

export const stripe = createStripeClient();

export type PlanKey = "free" | "pro" | "team";

export interface PlanConfig {
  name: string;
  description: string;
  price: number; // in cents
  interval: "month" | "year" | null;
  features: string[];
}

export const PLANS: Record<PlanKey, PlanConfig> = {
  free: {
    name: "Free",
    description: "Acceso básico para usuarios individuales",
    price: 0,
    interval: null,
    features: [
      "Hasta 3 proyectos",
      "Asistente AI básico",
      "Soporte comunitario",
    ],
  },
  pro: {
    name: "Pro",
    description: "Para profesionales que necesitan más potencia",
    price: 1900, // $19/month
    interval: "month",
    features: [
      "Proyectos ilimitados",
      "AI avanzada con análisis de código",
      "Soporte prioritario",
      "Integraciones personalizadas",
      "Historial de versiones completo",
    ],
  },
  team: {
    name: "Team",
    description: "Para equipos que colaboran",
    price: 4900, // $49/month
    interval: "month",
    features: [
      "Todo lo de Pro",
      "Colaboración en equipo",
      "Panel de administración",
      "SSO y seguridad avanzada",
      "Soporte dedicado",
      "Auditoría de actividad",
    ],
  },
};
