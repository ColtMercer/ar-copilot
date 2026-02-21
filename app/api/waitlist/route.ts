import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  let payload: Record<string, string> = {};

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as Record<string, unknown>;
    for (const [k, v] of Object.entries(body || {})) {
      if (v === undefined || v === null) continue;
      payload[k] = String(v);
    }
  } else {
    const form = await req.formData();
    for (const [k, v] of form.entries()) {
      payload[k] = typeof v === "string" ? v : v.name;
    }
  }

  const email = (payload.email || "").trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    if (!contentType.includes("application/json")) {
      return NextResponse.redirect(new URL("/#waitlist", req.url), { status: 303 });
    }
    return NextResponse.json({ ok: false, error: "Valid email is required" }, { status: 400 });
  }

  const db = getDb();
  const id = crypto.randomUUID();

  try {
    db.prepare(
      `insert into waitlist_signups (id, email, name, invoice_volume, current_tool, pain, source)
       values (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      email,
      payload.name?.trim() || null,
      payload.invoice_volume || null,
      payload.current_tool || null,
      payload.pain || null,
      payload.source || "landing_v1"
    );
  } catch (err: any) {
    if (err?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      // Already signed up — still redirect to thanks
      if (!contentType.includes("application/json")) {
        return NextResponse.redirect(new URL("/thanks", req.url), { status: 303 });
      }
      return NextResponse.json({ ok: true, message: "Already signed up" });
    }
    throw err;
  }

  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL("/thanks", req.url), { status: 303 });
  }

  return NextResponse.json({ ok: true, id });
}

export async function GET() {
  const db = getDb();
  const count = db.prepare("select count(*) as n from waitlist_signups").get() as { n: number };
  return NextResponse.json({ ok: true, count: count.n });
}
