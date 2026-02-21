import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = await getDb();

  // Get all open invoices with client info
  const { rows: invoices } = await db.query(`
    SELECT
      i.*,
      c.name AS client_name,
      c.primary_contact_name,
      c.primary_contact_email,
      cs.tone AS client_tone,
      (CURRENT_DATE - i.due_date) AS days_overdue,
      CASE
        WHEN i.last_followup_at IS NULL THEN 9999
        ELSE (CURRENT_DATE - i.last_followup_at::date)
      END AS days_since_followup
    FROM invoices i
    LEFT JOIN clients c ON c.id = i.client_id
    LEFT JOIN client_settings cs ON cs.client_id = c.id
    WHERE i.status = 'open'
    ORDER BY
      CASE
        WHEN (CURRENT_DATE - i.due_date) >= 21 THEN 1
        WHEN (CURRENT_DATE - i.due_date) BETWEEN 14 AND 20 THEN 2
        WHEN (CURRENT_DATE - i.due_date) BETWEEN 7 AND 13 THEN 3
        WHEN (CURRENT_DATE - i.due_date) BETWEEN 1 AND 6 THEN 4
        ELSE 5
      END ASC,
      i.amount_cents DESC,
      i.due_date ASC
  `);

  const chaseList = invoices
    .map((inv: any) => {
      const daysOverdue = parseInt(inv.days_overdue) || 0;
      const daysSinceFollowup = parseInt(inv.days_since_followup) || 9999;

      let recommendedStage: string | null = null;
      let needsFollowUp = false;

      if (daysOverdue < 0 && daysOverdue >= -3 && daysSinceFollowup >= 5) {
        recommendedStage = "pre_due";
        needsFollowUp = true;
      } else if (daysOverdue >= 21 && daysSinceFollowup >= 3) {
        recommendedStage = "final";
        needsFollowUp = true;
      } else if (daysOverdue >= 14 && daysOverdue <= 20 && daysSinceFollowup >= 3) {
        recommendedStage = "day_14";
        needsFollowUp = true;
      } else if (daysOverdue >= 7 && daysOverdue <= 13 && daysSinceFollowup >= 3) {
        recommendedStage = "day_7";
        needsFollowUp = true;
      } else if (daysOverdue >= 1 && daysOverdue <= 6 && daysSinceFollowup >= 3) {
        recommendedStage = "day_1";
        needsFollowUp = true;
      }

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
        needs_followup: needsFollowUp,
        client_tone: inv.client_tone || "friendly",
      };
    })
    .filter((item: any) => item.needs_followup);

  return NextResponse.json({ ok: true, date: new Date().toISOString().slice(0, 10), chase_list: chaseList });
}
