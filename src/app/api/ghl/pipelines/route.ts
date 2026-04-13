/**
 * GET /api/ghl/pipelines
 * Lista todos os pipelines da location GHL com seus stages (chamada ao vivo).
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GHL_LOCATION_ID = "DlN4Ua95aZZCaR8qA5Nh";
const GHL_BASE = "https://services.leadconnectorhq.com";

export async function GET() {
  const token = process.env.GHL_API_KEY;
  if (!token) return NextResponse.json({ error: "GHL_API_KEY não configurado" }, { status: 500 });

  try {
    const res = await fetch(
      `${GHL_BASE}/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: "2021-07-28",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `GHL ${res.status}`, detail: text }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
