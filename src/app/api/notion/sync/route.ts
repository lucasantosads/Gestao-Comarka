import { NextRequest, NextResponse } from "next/server";
import { forceSync, DB_IDS } from "@/lib/data";

export async function POST(req: NextRequest) {
  const { db } = await req.json();
  const dbId = DB_IDS[db as keyof typeof DB_IDS];
  if (!dbId) return NextResponse.json({ error: "db inválido" }, { status: 400 });
  await forceSync(dbId);
  return NextResponse.json({ success: true });
}
