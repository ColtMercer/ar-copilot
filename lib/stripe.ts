import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";

const globalForStripe = globalThis as unknown as { stripe?: Stripe };

export const stripe =
  globalForStripe.stripe ??
  new Stripe(stripeSecretKey, {
    apiVersion: "2026-02-25.clover" as Stripe.LatestApiVersion,
  });

if (process.env.NODE_ENV !== "production") {
  globalForStripe.stripe = stripe;
}
