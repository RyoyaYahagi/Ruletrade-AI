import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { getStripe, isStripeEnabled } from "./stripe-client";

export async function verifyStripeSignature(params: {
  payload: string;
  signature: string;
}) {
  if (!isStripeEnabled())
    return { verified: false, error: "Stripe not configured" };

  const stripe = await getStripe();
  if (!stripe) return { verified: false, error: "Stripe not initialized" };

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret)
    return { verified: false, error: "Webhook secret not configured" };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = (stripe as any).webhooks.constructEvent(
      params.payload,
      params.signature,
      secret,
    );
    return { verified: true, event };
  } catch (err: unknown) {
    return {
      verified: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function processStripeEvent(event: Record<string, unknown>) {
  const db = await createDatabaseClient();

  const eventType = String(event.type);
  const eventId = String(event.id);

  await db.from("billing_webhook_events").insert({
    stripe_event_id: eventId,
    event_type: eventType,
    payload: JSON.stringify(event),
  });

  // Basic event handling
  if (eventType === "checkout.session.completed") {
    const session = event.data as Record<string, unknown>;
    const customerId = String(session.customer);
    const subscriptionId = String(session.subscription);

    // Update subscription status
    await db
      .from("billing_subscriptions")
      .update({ status: "active", stripe_subscription_id: subscriptionId })
      .eq("stripe_subscription_id", subscriptionId);
  }

  if (eventType === "customer.subscription.deleted") {
    const subscription = event.data as Record<string, unknown>;
    const subscriptionId = String(subscription.id);

    await db
      .from("billing_subscriptions")
      .update({ status: "canceled" })
      .eq("stripe_subscription_id", subscriptionId);
  }
}
