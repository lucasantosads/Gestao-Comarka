import { NextResponse } from "next/server";
import { getOnboarding } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getOnboarding());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
