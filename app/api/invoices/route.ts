import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const client_id = url.searchParams.get("client_id");

  const where: string[] = [];
  const params: any[] = [];

  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  if (client_id) {
    where.push("client_id = ?");
    params.push(client_id);
  }

  const sql = `
    select id, client_id, invoice_number, description, currency, amount_cents,
           issue_date, due_date, paid_date, status,
           last_followup_at, last_followup_stage,
           created_at, updated_at
    from invoices
    ${where.length ? `where ${where.join(" and ")}` : ""}
    order by due_date asc
  `;

  const rows = db.prepare(sql).all(...params);
  return NextResponse.json({ ok: true, invoices: rows });
}

export async function POST(req: Request) {
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

  const db = getDb();
  const id = crypto.randomUUID();

  db.prepare(
    `insert into invoices (
        id, client_id, invoice_number, description, currency, amount_cents,
        issue_date, due_date
     ) values (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    body.client_id || null,
    body.invoice_number || null,
    body.description || null,
    body.currency || "USD",
    Number.isFinite(body.amount_cents) ? Math.trunc(body.amount_cents as number) : 0,
    body.issue_date || null,
    due_date
  );

  const invoice = db
    .prepare(
      `select id, client_id, invoice_number, description, currency, amount_cents,
              issue_date, due_date, paid_date, status,
              last_followup_at, last_followup_stage,
              created_at, updated_at
       from invoices where id = ?`
    )
    .get(id);

  return NextResponse.json({ ok: true, invoice }, { status: 201 });
}

export async function PATCH(req: Request) {
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

  const db = getDb();
  const sets: string[] = [];
  const params: any[] = [];

  if (body.status) { sets.push("status = ?"); params.push(body.status); }
  if (body.paid_date) { sets.push("paid_date = ?"); params.push(body.paid_date); }
  if (body.due_date) { sets.push("due_date = ?"); params.push(body.due_date); }
  if (body.last_followup_at) { sets.push("last_followup_at = ?"); params.push(body.last_followup_at); }
  if (body.last_followup_stage) { sets.push("last_followup_stage = ?"); params.push(body.last_followup_stage); }

  if (sets.length === 0) {
    return NextResponse.json({ ok: false, error: "nothing to update" }, { status: 400 });
  }

  sets.push("updated_at = datetime('now')");
  params.push(body.id);

  db.prepare(`update invoices set ${sets.join(", ")} where id = ?`).run(...params);

  const invoice = db.prepare(
    `select * from invoices where id = ?`
  ).get(body.id);

  return NextResponse.json({ ok: true, invoice });
}
