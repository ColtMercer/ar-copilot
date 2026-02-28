import { getDb } from "@/lib/db";

export type Plan = "free" | "starter" | "studio";
export type PlanStatus = "active" | "canceled" | "past_due";

export const PLAN_LIMITS: Record<Plan, number> = {
  free: 3,
  starter: 30,
  studio: 150,
};

export function invoiceLimitForPlan(plan: Plan): number {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function planFromPriceId(priceId: string | null | undefined): Plan {
  if (priceId && priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId && priceId === process.env.STRIPE_PRICE_STUDIO) return "studio";
  return "free";
}

export function normalizePlanStatus(status: string | null | undefined): PlanStatus {
  switch (status) {
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "active";
  }
}

export async function getUserSubscription(userId: string) {
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT user_id, stripe_customer_id, stripe_subscription_id, plan, plan_status
     FROM subscriptions
     WHERE user_id = $1`,
    [userId]
  );

  return (
    rows[0] || {
      user_id: userId,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      plan: "free",
      plan_status: "active",
    }
  ) as {
    user_id: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    plan: Plan;
    plan_status: PlanStatus;
  };
}

export function getAppBaseUrl() {
  return (
    process.env.APP_BASE_URL ||
    process.env.AUTH0_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

export function assertValidPriceId(priceId: string) {
  const starter = process.env.STRIPE_PRICE_STARTER;
  const studio = process.env.STRIPE_PRICE_STUDIO;
  if (!starter || !studio) {
    throw new Error("Stripe price IDs are not configured");
  }
  if (priceId !== starter && priceId !== studio) {
    throw new Error("Invalid Stripe price ID");
  }
}

export function getPriceIdForPlan(plan: Plan): string | null {
  if (plan === "starter") return process.env.STRIPE_PRICE_STARTER || null;
  if (plan === "studio") return process.env.STRIPE_PRICE_STUDIO || null;
  return null;
}
