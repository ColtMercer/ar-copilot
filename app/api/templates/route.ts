export const dynamic = "force-dynamic";
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
  const stage = url.searchParams.get("stage");
  const tone = url.searchParams.get("tone");

  const where: string[] = ["(is_system = true OR user_id = $1)"];
  const params: any[] = [userId];
  let i = 2;

  if (stage) { where.push(`stage = $${i++}`); params.push(stage); }
  if (tone) { where.push(`tone = $${i++}`); params.push(tone); }

  const { rows } = await db.query(
    `SELECT * FROM templates ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY stage, tone`,
    params
  );

  return NextResponse.json({ ok: true, templates: rows });
}
