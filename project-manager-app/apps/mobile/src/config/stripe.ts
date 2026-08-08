/**
 * Mirrors apps/web/lib/stripe-client.ts's isStripeConfigured()/PUBLISHABLE_KEY
 * pattern. The publishable key can only create tokens, never move money or
 * read account data — safe to ship in the app bundle via EXPO_PUBLIC_*.
 * As of this writing no key is set in Railway for any environment, so this
 * intentionally resolves to "not configured" everywhere until one is added —
 * same real state as the web app's payout form today, not a mobile-only gap.
 */
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || undefined;

export function isStripeConfigured(): boolean {
  return Boolean(STRIPE_PUBLISHABLE_KEY);
}
