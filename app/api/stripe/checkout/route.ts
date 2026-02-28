import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { assertValidPriceId, getAppBaseUrl } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  const userId = session?.user?.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { priceId?: string };
  const priceId = (body.priceId || "").trim();
  if (!priceId) {
    return NextResponse.json({ ok: false, error: "priceId required" }, { status: 400 });
  }

  try {
    assertValidPriceId(priceId);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "invalid price" }, { status: 400 });
  }

  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
  }

  const db = await getDb();
  const { rows } = await db.query(
    `SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1`,
    [userId]
  );
  let stripeCustomerId = rows[0]?.stripe_customer_id as string | undefined;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { user_id: userId },
    });
    stripeCustomerId = customer.id;
  }

  await db.query(
    `INSERT INTO subscriptions (user_id, stripe_customer_id, plan, plan_status)
     VALUES ($1, $2, 'free', 'active')
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       updated_at = now()`,
    [userId, stripeCustomerId]
  );

  const baseUrl = getAppBaseUrl();

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: userId,
    subscription_data: {
      metadata: { user_id: userId },
    },
    success_url: `${baseUrl}/dashboard?stripe=success`,
    cancel_url: `${baseUrl}/dashboard?stripe=cancel`,
  });

  return NextResponse.json({ ok: true, url: checkoutSession.url });
}
