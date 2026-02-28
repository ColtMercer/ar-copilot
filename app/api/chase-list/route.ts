export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getUserSubscription, invoiceLimitForPlan } from "@/lib/billing";

export const runtime = "nodejs";

type Stage = "pre_due" | "day_1" | "day_7" | "day_14" | "final";

function computeStage(daysOverdue: number, daysSinceFollowup: number): Stage | null {
  // Pre-due: exactly 3 days before due date (daysOverdue = -3)
  if (daysOverdue === -3 && daysSinceFollowup >= 5) return "pre_due";

  // Overdue stages
  if (daysOverdue >= 21 && daysSinceFollowup >= 3) return "final";
  if (daysOverdue >= 14 && daysOverdue <= 17 && daysSinceFollowup >= 3) return "day_14";
  if (daysOverdue >= 7 && daysOverdue <= 10 && daysSinceFollowup >= 3) return "day_7";
  if (daysOverdue >= 1 && daysOverdue <= 3 && daysSinceFollowup >= 3) return "day_1";

  return null;
}

function severity(stage: Stage): number {
  // higher = more urgent
  switch (stage) {
    case "final":
      return 5;
    case "day_14":
      return 4;
    case "day_7":
      return 3;
    case "day_1":
      return 2;
    case "pre_due":
      return 1;
  }
}

export async function GET() {
  const session = await getSession();
  const userId = session?.user?.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const subscription = await getUserSubscription(userId);
  const limit = invoiceLimitForPlan(subscription.plan);
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS count FROM invoices WHERE user_id = $1 AND status = 'open'`,
    [userId]
  );
  const openCount = countRows?.[0]?.count ?? 0;
  if (openCount > limit) {
    return NextResponse.json(
      { ok: false, error: "invoice_limit_exceeded", plan: subscription.plan, limit, open_invoices: openCount },
      { status: 402 }
    );
  }

  const { rows } = await db.query(`
    SELECT
      i.*,
      c.name AS client_name,
      c.primary_contact_name,
      c.primary_contact_email,
      cs.tone AS client_tone,
      cs.payment_link AS payment_link,
      cs.signature_name AS signature_name,
      cs.signature_company AS signature_company,
      cs.signature_phone AS signature_phone,
      cs.signature_email AS signature_email,
      cs.include_late_fee AS include_late_fee,
      cs.late_fee_text AS late_fee_text,
      (CURRENT_DATE - i.due_date) AS days_overdue,
      CASE
        WHEN i.last_followup_at IS NULL THEN 9999
        ELSE (CURRENT_DATE - i.last_followup_at::date)
      END AS days_since_followup
    FROM invoices i
    LEFT JOIN clients c ON c.id = i.client_id AND c.user_id = $1
    LEFT JOIN client_settings cs ON cs.client_id = c.id AND cs.user_id = $1
    WHERE i.status = 'open' AND i.user_id = $1
  `, [userId]);

  const chaseList = rows
    .map((inv: any) => {
      const daysOverdue = Number(inv.days_overdue);
      const daysSinceFollowup = Number(inv.days_since_followup);

      const recommendedStage = computeStage(daysOverdue, daysSinceFollowup);
      if (!recommendedStage) return null;

      return {
        invoice_id: inv.id,
        client_id: inv.client_id,
        client_name: inv.client_name,
        contact_name: inv.primary_contact_name,
        contact_email: inv.primary_contact_email,
        invoice_number: inv.invoice_number,
        amount_cents: inv.amount_cents,
        currency: inv.currency,
        due_date: inv.due_date,
        days_overdue: daysOverdue,
        days_since_followup: daysSinceFollowup === 9999 ? null : daysSinceFollowup,
        last_followup_stage: inv.last_followup_stage,
        recommended_stage: recommendedStage,
        client_tone: inv.client_tone || "friendly",
        payment_link: inv.payment_link || null,
        signature_name: inv.signature_name || null,
        signature_company: inv.signature_company || null,
        signature_phone: inv.signature_phone || null,
        signature_email: inv.signature_email || null,
        include_late_fee: inv.include_late_fee ?? false,
        late_fee_text: inv.late_fee_text || null,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      const sev = severity(a.recommended_stage) - severity(b.recommended_stage);
      if (sev !== 0) return -sev; // desc
      const amt = Number(a.amount_cents) - Number(b.amount_cents);
      if (amt !== 0) return -amt; // desc
      return String(a.due_date).localeCompare(String(b.due_date));
    });

  const { rows: dateRows } = await db.query(`SELECT CURRENT_DATE::text AS today`);
  const today = dateRows?.[0]?.today || new Date().toISOString().slice(0, 10);

  return NextResponse.json({ ok: true, date: today, chase_list: chaseList });
}
