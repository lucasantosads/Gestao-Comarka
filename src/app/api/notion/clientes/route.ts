import { NextResponse } from "next/server";
import { getClientes } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clientes = await getClientes();
    return NextResponse.json(clientes);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
