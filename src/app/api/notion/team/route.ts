import { NextResponse } from "next/server";
import { getTeam } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getTeam());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
