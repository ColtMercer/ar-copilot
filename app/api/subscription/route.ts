export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserSubscription, PLAN_LIMITS } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  const userId = session?.user?.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const subscription = await getUserSubscription(userId);
  const plan = subscription.plan;
  const planStatus = subscription.plan_status;
  const currentPeriodEnd = subscription.current_period_end;
  const invoiceLimit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  return NextResponse.json({ plan, planStatus, currentPeriodEnd, invoiceLimit });
}
