import { NextRequest, NextResponse } from "next/server";
import { getClienteById, getPageContent } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [cliente, blocks] = await Promise.all([
      getClienteById(params.id),
      getPageContent(params.id),
    ]);
    if (!cliente) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ...cliente, blocks });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
