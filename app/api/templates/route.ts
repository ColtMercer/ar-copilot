import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const db = await getDb();
  const url = new URL(req.url);
  const stage = url.searchParams.get("stage");
  const tone = url.searchParams.get("tone");

  const where: string[] = [];
  const params: any[] = [];
  let i = 1;

  if (stage) { where.push(`stage = $${i++}`); params.push(stage); }
  if (tone) { where.push(`tone = $${i++}`); params.push(tone); }

  const { rows } = await db.query(
    `SELECT * FROM templates ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY stage, tone`,
    params
  );

  return NextResponse.json({ ok: true, templates: rows });
}
