/**
 * GET /api/ghl/opportunities?pipelineId=...&page=1&limit=100&fetchAll=1&startDate=...&endDate=...
 *
 * Lê oportunidades de um pipeline diretamente da GHL. Quando fetchAll=1
 * percorre todas as páginas até esgotar. startDate/endDate filtram por
 * data de criação (formato YYYY-MM-DD); usa o filtro nativo `date_added`
 * da GHL e ainda faz fallback client-side para cobrir variações no payload.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GHL_LOCATION_ID = "DlN4Ua95aZZCaR8qA5Nh";
const GHL_BASE = "https://services.leadconnectorhq.com";

interface GhlOpp {
  id?: string;
  name?: string;
  contactId?: string;
  contact?: { id?: string; name?: string; firstName?: string; lastName?: string; email?: string; phone?: string };
  monetaryValue?: number | null;
  pipelineId?: string;
  pipelineStageId?: string;
  status?: string;
  source?: string;
  createdAt?: string;
  dateAdded?: string;
  updatedAt?: string;
  customFields?: Array<{ id: string; fieldValue?: unknown }>;
  [k: string]: unknown;
}

async function fetchPage(token: string, params: URLSearchParams) {
  const url = `${GHL_BASE}/opportunities/search?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL ${res.status}: ${text}`);
  }
  return res.json() as Promise<{
    opportunities?: GhlOpp[];
    meta?: { total?: number; nextPageUrl?: string | null; startAfterId?: string | null; startAfter?: number | null; currentPage?: number; nextPage?: number | null };
  }>;
}

export async function GET(req: NextRequest) {
  const token = process.env.GHL_API_KEY;
  if (!token) return NextResponse.json({ error: "GHL_API_KEY não configurado" }, { status: 500 });

  const sp = req.nextUrl.searchParams;
  const pipelineId = sp.get("pipelineId");
  if (!pipelineId) return NextResponse.json({ error: "pipelineId obrigatório" }, { status: 400 });

  const page = Number(sp.get("page") || "1");
  const limit = Number(sp.get("limit") || "100");
  const fetchAll = sp.get("fetchAll") === "1" || sp.get("fetchAll") === "true";
  const startDate = sp.get("startDate");
  const endDate = sp.get("endDate");

  // A GHL /opportunities/search (v2021-07-28) não aceita filtros nativos de
  // `date_added_*`. Passamos só pipeline_id + paginação e filtramos por data
  // client-side em filterByDate abaixo, usando `dateAdded`/`createdAt`.
  const baseParams = new URLSearchParams();
  baseParams.set("location_id", GHL_LOCATION_ID);
  baseParams.set("pipeline_id", pipelineId);
  baseParams.set("limit", String(limit));

  try {
    if (!fetchAll) {
      const params = new URLSearchParams(baseParams);
      params.set("page", String(page));
      const data = await fetchPage(token, params);
      return NextResponse.json(filterByDate(data, startDate, endDate));
    }

    // fetchAll: itera páginas até esgotar
    const all: GhlOpp[] = [];
    let p = 1;
    while (true) {
      const params = new URLSearchParams(baseParams);
      params.set("page", String(p));
      const data = await fetchPage(token, params);
      const opps = data.opportunities || [];
      all.push(...opps);
      if (opps.length < limit) break;
      p += 1;
      if (p > 200) break; // hard cap defensivo
    }
    const result = filterByDate({ opportunities: all }, startDate, endDate);
    return NextResponse.json({ ...result, meta: { total: result.opportunities?.length || 0 } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function filterByDate(
  data: { opportunities?: GhlOpp[]; meta?: unknown },
  startDate: string | null,
  endDate: string | null,
) {
  if (!startDate && !endDate) return data;
  const startTs = startDate ? new Date(startDate + "T00:00:00").getTime() : -Infinity;
  const endTs = endDate ? new Date(endDate + "T23:59:59").getTime() : Infinity;
  const filtered = (data.opportunities || []).filter((o) => {
    const raw = o.dateAdded || o.createdAt;
    if (!raw) return true; // sem data: deixa passar (não derruba o que a GHL já filtrou)
    const t = new Date(raw).getTime();
    return t >= startTs && t <= endTs;
  });
  return { ...data, opportunities: filtered };
}
