export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  const userId = session?.user?.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const { rows } = await db.query(
    `SELECT id, name, primary_contact_name, primary_contact_email, company_domain, notes, created_at, updated_at
     FROM clients
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return NextResponse.json({ ok: true, clients: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  const userId = session?.user?.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

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

  const db = await getDb();
  const { rows } = await db.query(
    `INSERT INTO clients (user_id, name, primary_contact_name, primary_contact_email, company_domain, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, name, body.primary_contact_name || null, body.primary_contact_email || null, body.company_domain || null, body.notes || null]
  );

  return NextResponse.json({ ok: true, client: rows[0] }, { status: 201 });
}
