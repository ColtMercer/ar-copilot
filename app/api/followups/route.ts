import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    invoice_id: string;
    channel?: string;
    stage?: string;
    subject?: string;
    body?: string;
    notes?: string;
  };

  if (!body.invoice_id) {
    return NextResponse.json({ ok: false, error: "invoice_id required" }, { status: 400 });
  }

  const db = await getDb();

  // Insert the follow-up event
  const { rows } = await db.query(
    `INSERT INTO followup_events (invoice_id, channel, stage, subject, body, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [body.invoice_id, body.channel || "email", body.stage || null, body.subject || null, body.body || null, body.notes || null]
  );

  // Update the invoice's last followup info
  await db.query(
    `UPDATE invoices SET last_followup_at = now(), last_followup_stage = $1, updated_at = now() WHERE id = $2`,
    [body.stage || null, body.invoice_id]
  );

  return NextResponse.json({ ok: true, followup: rows[0] }, { status: 201 });
}

export async function GET(req: Request) {
  const db = await getDb();
  const url = new URL(req.url);
  const invoice_id = url.searchParams.get("invoice_id");

  if (!invoice_id) {
    return NextResponse.json({ ok: false, error: "invoice_id required" }, { status: 400 });
  }

  const { rows } = await db.query(
    `SELECT * FROM followup_events WHERE invoice_id = $1 ORDER BY sent_at DESC`,
    [invoice_id]
  );

  return NextResponse.json({ ok: true, followups: rows });
}
