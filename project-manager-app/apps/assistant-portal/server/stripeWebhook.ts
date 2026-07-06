import type { Request, Response } from "express";
import { stripe } from "./stripe";
import { ENV } from "./_core/env";
import * as db from "./db";

export async function stripeWebhookHandler(req: Request, res: Response) {
  if (!stripe) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      ENV.stripeWebhookSecret
    );
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle test events for webhook verification
  if (event.id.startsWith("evt_test_")) {
    console.log("[Stripe Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.user_id
          ? parseInt(session.metadata.user_id, 10)
          : null;
        const customerId = session.customer as string;

        if (userId && customerId) {
          await db.updateStripeCustomerId(userId, customerId);
        }

        // If subscription mode, retrieve and store subscription
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          if (userId) {
            const firstItem = subscription.items.data[0];
            await db.upsertSubscription({
              userId,
              stripeSubscriptionId: subscription.id,
              stripePriceId: firstItem?.price.id || "",
              status: subscription.status,
              currentPeriodEnd: firstItem?.current_period_end
                ? firstItem.current_period_end * 1000
                : undefined,
            });
          }
        }

        // If payment mode, record the payment
        if (session.mode === "payment" && session.payment_intent) {
          const pi = await stripe.paymentIntents.retrieve(
            session.payment_intent as string
          );
          if (userId) {
            await db.createPayment({
              userId,
              stripePaymentIntentId: pi.id,
              amount: pi.amount,
              currency: pi.currency,
              status: pi.status,
            });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;
        const user = await db.getUserByStripeCustomerId(customerId);
        if (user) {
          const firstItem = subscription.items.data[0];
          await db.upsertSubscription({
            userId: user.id,
            stripeSubscriptionId: subscription.id,
            stripePriceId: firstItem?.price.id || "",
            status: subscription.status,
            currentPeriodEnd: firstItem?.current_period_end
              ? firstItem.current_period_end * 1000
              : undefined,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;
        const user = await db.getUserByStripeCustomerId(customerId);
        if (user) {
          const firstItem = subscription.items.data[0];
          await db.upsertSubscription({
            userId: user.id,
            stripeSubscriptionId: subscription.id,
            stripePriceId: firstItem?.price.id || "",
            status: "canceled",
            currentPeriodEnd: firstItem?.current_period_end
              ? firstItem.current_period_end * 1000
              : undefined,
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;
        const user = await db.getUserByStripeCustomerId(customerId);
        if (user && invoice.payment_intent) {
          await db.createPayment({
            userId: user.id,
            stripePaymentIntentId: invoice.payment_intent as string,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: "succeeded",
            description: invoice.lines?.data?.[0]?.description || undefined,
          });
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, error);
    // Return 200 to prevent Stripe from retrying
  }

  res.json({ received: true });
}
