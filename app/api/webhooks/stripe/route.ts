import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getDb } from "@/lib/db";
import { normalizePlanStatus, planFromPriceId } from "@/lib/billing";

export const runtime = "nodejs";

function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
) {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id;
}

function getSubscriptionId(subscription: string | Stripe.Subscription | null | undefined) {
  if (!subscription) return null;
  if (typeof subscription === "string") return subscription;
  return subscription.id;
}

async function resolveUserIdByCustomer(db: any, customerId: string | null) {
  if (!customerId) return null;
  const { rows } = await db.query(
    `SELECT user_id FROM subscriptions WHERE stripe_customer_id = $1`,
    [customerId]
  );
  return rows[0]?.user_id || null;
}

async function upsertSubscriptionByUserId(
  db: any,
  userId: string,
  data: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    plan?: string | null;
    planStatus?: string | null;
  }
) {
  const insertPlan = data.plan ?? "free";
  const insertStatus = data.planStatus ?? "active";

  await db.query(
    `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, plan_status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
       stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
       plan = COALESCE($6, subscriptions.plan),
       plan_status = COALESCE($7, subscriptions.plan_status),
       updated_at = now()`,
    [
      userId,
      data.stripeCustomerId ?? null,
      data.stripeSubscriptionId ?? null,
      insertPlan,
      insertStatus,
      data.plan ?? null,
      data.planStatus ?? null,
    ]
  );
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, error: "missing_signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ ok: false, error: "missing_webhook_secret" }, { status: 500 });
  }

  const payload = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: `signature_verification_failed` }, { status: 400 });
  }

  const db = await getDb();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = getCustomerId(session.customer);
      const subscriptionId = getSubscriptionId(session.subscription);
      let userId = session.client_reference_id || session.metadata?.user_id || null;
      if (!userId) {
        userId = await resolveUserIdByCustomer(db, customerId);
      }
      if (!userId || !subscriptionId) break;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price?.id;
      const plan = planFromPriceId(priceId);
      const planStatus = normalizePlanStatus(subscription.status);

      await upsertSubscriptionByUserId(db, userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan,
        planStatus,
      });
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = getCustomerId(subscription.customer);
      let userId = subscription.metadata?.user_id || null;
      if (!userId) {
        userId = await resolveUserIdByCustomer(db, customerId);
      }
      if (!userId) break;

      const priceId = subscription.items.data[0]?.price?.id;
      const plan = planFromPriceId(priceId);
      const planStatus = normalizePlanStatus(subscription.status);

      await upsertSubscriptionByUserId(db, userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        plan,
        planStatus,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = getCustomerId(subscription.customer);
      let userId = subscription.metadata?.user_id || null;
      if (!userId) {
        userId = await resolveUserIdByCustomer(db, customerId);
      }
      if (!userId) break;

      await upsertSubscriptionByUserId(db, userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: null,
        plan: "free",
        planStatus: "canceled",
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = getCustomerId(invoice.customer);
      const userId = await resolveUserIdByCustomer(db, customerId);
      if (!userId) break;

      await upsertSubscriptionByUserId(db, userId, {
        stripeCustomerId: customerId,
        planStatus: "past_due",
      });
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ ok: true });
}
