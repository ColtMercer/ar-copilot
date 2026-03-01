export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Resend } from "resend";

export async function POST(req: Request) {
  const session = await getSession();
  const userId = session?.user?.sub;
  if (!session || !userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { invoice_id, to_email, subject, body: emailBody, stage } = body;

  if (!invoice_id || !to_email || !subject || !emailBody) {
    return NextResponse.json({ error: "invoice_id, to_email, subject, and body are required" }, { status: 400 });
  }

  const db = await getDb();

  // Verify invoice belongs to this user
  const invResult = await db.query(
    "SELECT id, invoice_number FROM invoices WHERE id=$1 AND user_id=$2",
    [invoice_id, userId]
  );
  if (invResult.rowCount === 0) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "AR Copilot <noreply@arcopilot.ai>";

  if (!apiKey) {
    // Dev mode: just log the followup without actually sending
    console.log("[send-email] No RESEND_API_KEY — logging followup only");
    await db.query(
      `INSERT INTO followup_events (invoice_id, channel, stage, subject, body, notes)
       VALUES ($1, 'email', $2, $3, $4, 'email_not_sent_no_api_key')`,
      [invoice_id, stage || null, subject, emailBody]
    );
    return NextResponse.json({ ok: true, sent: false, reason: "no_api_key" });
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [to_email],
      subject,
      text: emailBody,
    });

    if (error) {
      console.error("[send-email] Resend error:", error);
      return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 500 });
    }

    // Log the sent followup
    await db.query(
      `INSERT INTO followup_events (invoice_id, channel, stage, subject, body)
       VALUES ($1, 'email', $2, $3, $4)`,
      [invoice_id, stage || null, subject, emailBody]
    );

    // Update the invoice's last followup tracking
    await db.query(
      `UPDATE invoices SET last_followup_at=now(), last_followup_stage=$1, updated_at=now() WHERE id=$2`,
      [stage || null, invoice_id]
    );

    return NextResponse.json({ ok: true, sent: true });
  } catch (err) {
    console.error("[send-email] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
