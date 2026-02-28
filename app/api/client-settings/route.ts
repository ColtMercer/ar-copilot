import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const ALLOWED_TONES = new Set(["friendly", "neutral", "firm"]);

type ClientSettings = {
  client_id: string;
  tone: "friendly" | "neutral" | "firm";
  include_payment_methods: boolean;
  include_late_fee: boolean;
  late_fee_text: string | null;
  payment_link: string | null;
  signature_name: string | null;
  signature_company: string | null;
  signature_phone: string | null;
  signature_email: string | null;
  updated_at: string | null;
};

function emptyToNull(v: unknown) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function defaults(client_id: string): ClientSettings {
  return {
    client_id,
    tone: "friendly",
    include_payment_methods: true,
    include_late_fee: false,
    late_fee_text: null,
    payment_link: null,
    signature_name: null,
    signature_company: null,
    signature_phone: null,
    signature_email: null,
    updated_at: null,
  };
}

export async function GET(req: Request) {
  const session = await getSession();
  const userId = session?.user?.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const client_id = url.searchParams.get("client_id");

  if (!client_id) {
    return NextResponse.json({ ok: false, error: "client_id required" }, { status: 400 });
  }

  const db = await getDb();
  const ownsClient = await db.query(`SELECT 1 FROM clients WHERE id = $1 AND user_id = $2`, [
    client_id,
    userId,
  ]);
  if (ownsClient.rowCount === 0) {
    return NextResponse.json({ ok: false, error: "invalid client_id" }, { status: 400 });
  }
  const { rows } = await db.query(
    `SELECT client_id, tone, include_payment_methods, include_late_fee, late_fee_text,
            payment_link, signature_name, signature_company, signature_phone, signature_email,
            updated_at
     FROM client_settings
     WHERE client_id = $1 AND user_id = $2`,
    [client_id, userId]
  );

  const settings = (rows?.[0] as ClientSettings | undefined) || defaults(client_id);
  return NextResponse.json({ ok: true, settings });
}

export async function PUT(req: Request) {
  const session = await getSession();
  const userId = session?.user?.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Partial<ClientSettings> & { client_id?: string; tone?: string };

  const client_id = (body.client_id || "").trim();
  if (!client_id) {
    return NextResponse.json({ ok: false, error: "client_id required" }, { status: 400 });
  }

  let tone = body.tone;
  if (tone && !ALLOWED_TONES.has(tone)) {
    return NextResponse.json({ ok: false, error: "invalid tone" }, { status: 400 });
  }

  const db = await getDb();
  const ownsClient = await db.query(`SELECT 1 FROM clients WHERE id = $1 AND user_id = $2`, [
    client_id,
    userId,
  ]);
  if (ownsClient.rowCount === 0) {
    return NextResponse.json({ ok: false, error: "invalid client_id" }, { status: 400 });
  }

  const existing = await db.query(
    `SELECT client_id, tone, include_payment_methods, include_late_fee, late_fee_text,
            payment_link, signature_name, signature_company, signature_phone, signature_email,
            updated_at
     FROM client_settings
     WHERE client_id = $1 AND user_id = $2`,
    [client_id, userId]
  );

  const merged: ClientSettings = {
    ...defaults(client_id),
    ...(existing.rows?.[0] as any),
    // Only overwrite if provided; allow empty string to clear.
    tone: (tone as any) ?? ((existing.rows?.[0] as any)?.tone ?? "friendly"),
    include_payment_methods:
      typeof body.include_payment_methods === "boolean"
        ? body.include_payment_methods
        : ((existing.rows?.[0] as any)?.include_payment_methods ?? true),
    include_late_fee:
      typeof body.include_late_fee === "boolean"
        ? body.include_late_fee
        : ((existing.rows?.[0] as any)?.include_late_fee ?? false),
    late_fee_text: body.late_fee_text !== undefined ? emptyToNull(body.late_fee_text) : ((existing.rows?.[0] as any)?.late_fee_text ?? null),
    payment_link: body.payment_link !== undefined ? emptyToNull(body.payment_link) : ((existing.rows?.[0] as any)?.payment_link ?? null),
    signature_name: body.signature_name !== undefined ? emptyToNull(body.signature_name) : ((existing.rows?.[0] as any)?.signature_name ?? null),
    signature_company: body.signature_company !== undefined ? emptyToNull(body.signature_company) : ((existing.rows?.[0] as any)?.signature_company ?? null),
    signature_phone: body.signature_phone !== undefined ? emptyToNull(body.signature_phone) : ((existing.rows?.[0] as any)?.signature_phone ?? null),
    signature_email: body.signature_email !== undefined ? emptyToNull(body.signature_email) : ((existing.rows?.[0] as any)?.signature_email ?? null),
    updated_at: null,
  };

  // If late fees are disabled, wipe the text so templates don't accidentally include it.
  if (!merged.include_late_fee) {
    merged.late_fee_text = null;
  }

  const { rows } = await db.query(
    `INSERT INTO client_settings (
        client_id, user_id, tone, include_payment_methods, include_late_fee, late_fee_text,
        payment_link, signature_name, signature_company, signature_phone, signature_email,
        updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
      ON CONFLICT (client_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        tone = EXCLUDED.tone,
        include_payment_methods = EXCLUDED.include_payment_methods,
        include_late_fee = EXCLUDED.include_late_fee,
        late_fee_text = EXCLUDED.late_fee_text,
        payment_link = EXCLUDED.payment_link,
        signature_name = EXCLUDED.signature_name,
        signature_company = EXCLUDED.signature_company,
        signature_phone = EXCLUDED.signature_phone,
        signature_email = EXCLUDED.signature_email,
        updated_at = now()
      RETURNING *`,
    [
      merged.client_id,
      userId,
      merged.tone,
      merged.include_payment_methods,
      merged.include_late_fee,
      merged.late_fee_text,
      merged.payment_link,
      merged.signature_name,
      merged.signature_company,
      merged.signature_phone,
      merged.signature_email,
    ]
  );

  return NextResponse.json({ ok: true, settings: rows[0] });
}
