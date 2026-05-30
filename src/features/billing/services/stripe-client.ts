import "server-only";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require("stripe");

let stripeInstance: unknown | null = null;

export async function getStripe(): Promise<unknown | null> {
  if (stripeInstance) return stripeInstance;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  stripeInstance = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
  return stripeInstance;
}

export function isStripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
}
