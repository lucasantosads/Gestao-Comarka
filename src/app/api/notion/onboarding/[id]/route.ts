import { NextRequest, NextResponse } from "next/server";
import { getOnboardingById, getPageContent } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [item, blocks] = await Promise.all([
      getOnboardingById(params.id),
      getPageContent(params.id),
    ]);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ...item, blocks });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
