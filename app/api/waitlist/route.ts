import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

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

  const db = await getDb();

  try {
    await db.query(
      `INSERT INTO waitlist_signups (email, name, invoice_volume, current_tool, pain, source)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [email, payload.name?.trim() || null, payload.invoice_volume || null, payload.current_tool || null, payload.pain || null, payload.source || "landing_v1"]
    );
  } catch (err: any) {
    if (err?.code === "23505") {
      // unique violation — already signed up
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

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const db = await getDb();
  const { rows } = await db.query("SELECT count(*) AS n FROM waitlist_signups");
  return NextResponse.json({ ok: true, count: parseInt(rows[0].n) });
}
