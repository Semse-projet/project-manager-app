import { loadStripe, type Stripe } from "@stripe/stripe-js";

// The publishable key is meant to be public (it can only create tokens, never
// move money or read account data on its own) — safe to ship to the browser
// via NEXT_PUBLIC_*. Nothing here can substitute for the real STRIPE_SECRET_KEY
// used server-side in apps/api.
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();

export function isStripeConfigured(): boolean {
  return Boolean(PUBLISHABLE_KEY);
}

let stripePromise: Promise<Stripe | null> | null = null;

/** Lazily loads Stripe.js once and reuses the same promise across callers —
 * loadStripe() itself already memoizes the underlying <script> tag, this just
 * avoids re-triggering it from multiple components mounting the form. */
export function getStripe(): Promise<Stripe | null> {
  if (!PUBLISHABLE_KEY) {
    return Promise.resolve(null);
  }
  if (!stripePromise) {
    stripePromise = loadStripe(PUBLISHABLE_KEY);
  }
  return stripePromise;
}
