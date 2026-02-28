import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getAppBaseUrl } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  const userId = session?.user?.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const { rows } = await db.query(
    `SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1`,
    [userId]
  );

  const stripeCustomerId = rows[0]?.stripe_customer_id as string | undefined;
  if (!stripeCustomerId) {
    return NextResponse.json({ ok: false, error: "no_customer" }, { status: 400 });
  }

  const baseUrl = getAppBaseUrl();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${baseUrl}/dashboard`,
  });

  return NextResponse.json({ ok: true, url: portalSession.url });
}
