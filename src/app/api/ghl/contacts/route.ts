import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GHL_LOCATION_ID = "DlN4Ua95aZZCaR8qA5Nh";
const GHL_BASE = "https://services.leadconnectorhq.com";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");
  if (!query || query.length < 2) return NextResponse.json([]);

  const token = process.env.GHL_API_KEY;
  if (!token) return NextResponse.json({ error: "GHL_API_KEY não configurado" }, { status: 500 });

  try {
    const res = await fetch(
      `${GHL_BASE}/contacts/?locationId=${GHL_LOCATION_ID}&query=${encodeURIComponent(query)}&limit=15`,
      {
        headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28" },
        cache: "no-store",
      },
    );
    if (!res.ok) return NextResponse.json({ error: `GHL ${res.status}` }, { status: res.status });
    const data = await res.json();
    const contacts = (data.contacts || []).map((c: any) => ({
      id: c.id,
      name: c.contactName || c.name || c.firstName || "",
      phone: c.phone || "",
      email: c.email || "",
    }));
    return NextResponse.json(contacts);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
