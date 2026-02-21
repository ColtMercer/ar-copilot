import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `select id, name, primary_contact_name, primary_contact_email, company_domain, notes, created_at, updated_at
       from clients
       order by created_at desc`
    )
    .all();
  return NextResponse.json({ ok: true, clients: rows });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    name?: string;
    primary_contact_name?: string;
    primary_contact_email?: string;
    company_domain?: string;
    notes?: string;
  };

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  }

  const db = getDb();
  const id = crypto.randomUUID();

  db.prepare(
    `insert into clients (id, name, primary_contact_name, primary_contact_email, company_domain, notes)
     values (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    body.primary_contact_name || null,
    body.primary_contact_email || null,
    body.company_domain || null,
    body.notes || null
  );

  const client = db
    .prepare(
      `select id, name, primary_contact_name, primary_contact_email, company_domain, notes, created_at, updated_at
       from clients where id = ?`
    )
    .get(id);

  return NextResponse.json({ ok: true, client }, { status: 201 });
}
