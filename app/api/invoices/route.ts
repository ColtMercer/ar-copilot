import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  const userId = session?.user?.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const client_id = url.searchParams.get("client_id");

  const where: string[] = ["user_id = $1"];
  const params: any[] = [userId];
  let i = 2;

  if (status) { where.push(`status = $${i++}`); params.push(status); }
  if (client_id) { where.push(`client_id = $${i++}`); params.push(client_id); }

  const sql = `
    SELECT id, client_id, invoice_number, description, currency, amount_cents,
           issue_date, due_date, paid_date, status,
           last_followup_at, last_followup_stage,
           created_at, updated_at
    FROM invoices
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY due_date ASC
  `;

  const { rows } = await db.query(sql, params);
  return NextResponse.json({ ok: true, invoices: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  const userId = session?.user?.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    client_id?: string;
    invoice_number?: string;
    description?: string;
    currency?: string;
    amount_cents?: number;
    issue_date?: string;
    due_date?: string;
  };

  const due_date = (body.due_date || "").trim();
  if (!due_date) {
    return NextResponse.json({ ok: false, error: "due_date required" }, { status: 400 });
  }

  const db = await getDb();
  if (body.client_id) {
    const ownsClient = await db.query(`SELECT 1 FROM clients WHERE id = $1 AND user_id = $2`, [
      body.client_id,
      userId,
    ]);
    if (ownsClient.rowCount === 0) {
      return NextResponse.json({ ok: false, error: "invalid client_id" }, { status: 400 });
    }
  }
  const { rows } = await db.query(
    `INSERT INTO invoices (user_id, client_id, invoice_number, description, currency, amount_cents, issue_date, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      body.client_id || null,
      body.invoice_number || null,
      body.description || null,
      body.currency || "USD",
      Number.isFinite(body.amount_cents) ? Math.trunc(body.amount_cents as number) : 0,
      body.issue_date || null,
      due_date,
    ]
  );

  return NextResponse.json({ ok: true, invoice: rows[0] }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  const userId = session?.user?.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    id?: string;
    status?: string;
    paid_date?: string;
    due_date?: string;
    last_followup_at?: string;
    last_followup_stage?: string;
  };

  if (!body.id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;

  if (body.status) { sets.push(`status = $${i++}`); params.push(body.status); }
  if (body.paid_date) { sets.push(`paid_date = $${i++}`); params.push(body.paid_date); }
  if (body.due_date) { sets.push(`due_date = $${i++}`); params.push(body.due_date); }
  if (body.last_followup_at) { sets.push(`last_followup_at = $${i++}`); params.push(body.last_followup_at); }
  if (body.last_followup_stage) { sets.push(`last_followup_stage = $${i++}`); params.push(body.last_followup_stage); }

  if (sets.length === 0) {
    return NextResponse.json({ ok: false, error: "nothing to update" }, { status: 400 });
  }

  sets.push(`updated_at = now()`);
  params.push(body.id);
  params.push(userId);

  const db = await getDb();
  const { rows } = await db.query(
    `UPDATE invoices SET ${sets.join(", ")} WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
    params
  );

  return NextResponse.json({ ok: true, invoice: rows[0] });
}
