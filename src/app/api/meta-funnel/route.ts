/**
 * Route 5 — Dados agrupados por etapa do funil.
 * GET /api/meta-funnel?preset=last_30d
 *
 * Response shape:
 * { data: Record<FunnelStage, { avgP25, avgP50, avgP75, avgP100, avgCostPerResult, adCount }>, error?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { metaFetchPaginated } from "@/lib/meta-fetch";
import { filterValidVideoAds, calculateMetrics } from "@/lib/video-metrics";
import { mapToFunnelStage } from "@/lib/placement";
import type { RawMetaInsight, FunnelStage } from "@/lib/types/metaVideo";

export const revalidate = 120; // Meta Ads data

const FIELDS = [
  "ad_id", "ad_name", "campaign_name", "objective", "impressions", "spend",
  "video_p25_watched_actions", "video_p50_watched_actions",
  "video_p75_watched_actions", "video_p100_watched_actions",
  "video_play_actions", "video_thruplay_watched_actions",
].join(",");

interface FunnelData {
  avgP25: number;
  avgP50: number;
  avgP75: number;
  avgP100: number;
  avgCostPerResult: number;
  adCount: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since") || undefined;
  const status = searchParams.get("status") || "ALL";
  const preset = searchParams.get("preset") || (since ? undefined : "last_30d");
  const until = searchParams.get("until") || undefined;

  const result = await metaFetchPaginated<RawMetaInsight>({
    endpoint: "insights",
    fields: FIELDS,
    params: { level: "ad", time_increment: "1" },
    datePreset: since ? undefined : preset,
    since,
    until,
    statusFilter: status,
  });

  if (result.error && result.data.length === 0) {
    return NextResponse.json({ data: {}, error: result.error }, { status: 500 });
  }

  const validAds = filterValidVideoAds(result.data);

  // Agregar por ad_id primeiro (para não contar o mesmo anúncio várias vezes)
  const adAggregated = new Map<string, { objective: string; p25Sum: number; p50Sum: number; p75Sum: number; p100Sum: number; costSum: number; count: number }>();

  for (const insight of validAds) {
    const adId = insight.ad_id;
    const metrics = calculateMetrics(insight);
    const existing = adAggregated.get(adId);

    if (existing) {
      existing.p25Sum += metrics.p25Rate;
      existing.p50Sum += metrics.p50Rate;
      existing.p75Sum += metrics.p75Rate;
      existing.p100Sum += metrics.p100Rate;
      existing.costSum += metrics.costPerThruPlay;
      existing.count += 1;
    } else {
      adAggregated.set(adId, {
        objective: insight.objective || "",
        p25Sum: metrics.p25Rate,
        p50Sum: metrics.p50Rate,
        p75Sum: metrics.p75Rate,
        p100Sum: metrics.p100Rate,
        costSum: metrics.costPerThruPlay,
        count: 1,
      });
    }
  }

  // Agrupar por funil
  const funnelMap: Record<FunnelStage, { p25: number[]; p50: number[]; p75: number[]; p100: number[]; cost: number[] }> = {
    "Topo": { p25: [], p50: [], p75: [], p100: [], cost: [] },
    "Meio": { p25: [], p50: [], p75: [], p100: [], cost: [] },
    "Fundo": { p25: [], p50: [], p75: [], p100: [], cost: [] },
  };

  adAggregated.forEach((ad) => {
    const stage = mapToFunnelStage(ad.objective);
    const avgP25 = ad.count > 0 ? ad.p25Sum / ad.count : 0;
    const avgP50 = ad.count > 0 ? ad.p50Sum / ad.count : 0;
    const avgP75 = ad.count > 0 ? ad.p75Sum / ad.count : 0;
    const avgP100 = ad.count > 0 ? ad.p100Sum / ad.count : 0;
    const avgCost = ad.count > 0 ? ad.costSum / ad.count : 0;

    funnelMap[stage].p25.push(avgP25);
    funnelMap[stage].p50.push(avgP50);
    funnelMap[stage].p75.push(avgP75);
    funnelMap[stage].p100.push(avgP100);
    funnelMap[stage].cost.push(avgCost);
  });

  // Calcular médias por stage
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  const data: Record<FunnelStage, FunnelData> = {
    "Topo": { avgP25: avg(funnelMap.Topo.p25), avgP50: avg(funnelMap.Topo.p50), avgP75: avg(funnelMap.Topo.p75), avgP100: avg(funnelMap.Topo.p100), avgCostPerResult: avg(funnelMap.Topo.cost), adCount: funnelMap.Topo.p25.length },
    "Meio": { avgP25: avg(funnelMap.Meio.p25), avgP50: avg(funnelMap.Meio.p50), avgP75: avg(funnelMap.Meio.p75), avgP100: avg(funnelMap.Meio.p100), avgCostPerResult: avg(funnelMap.Meio.cost), adCount: funnelMap.Meio.p25.length },
    "Fundo": { avgP25: avg(funnelMap.Fundo.p25), avgP50: avg(funnelMap.Fundo.p50), avgP75: avg(funnelMap.Fundo.p75), avgP100: avg(funnelMap.Fundo.p100), avgCostPerResult: avg(funnelMap.Fundo.cost), adCount: funnelMap.Fundo.p25.length },
  };

  return NextResponse.json({ data, error: result.error });
}
