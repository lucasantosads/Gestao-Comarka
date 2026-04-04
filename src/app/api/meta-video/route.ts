/**
 * Route 1 — Insights base de vídeo por anúncio.
 * GET /api/meta-video?preset=last_30d (ou ?since=YYYY-MM-DD&until=YYYY-MM-DD)
 *
 * Response shape:
 * { data: CreativeWithMetrics[], error?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { metaFetchPaginated } from "@/lib/meta-fetch";
import { filterValidVideoAds, calculateMetrics } from "@/lib/video-metrics";
import { calculateCreativeScore } from "@/lib/scoring";
import type { RawMetaInsight, CreativeWithMetrics } from "@/lib/types/metaVideo";

const FIELDS = [
  "ad_id", "ad_name", "campaign_name", "objective", "impressions", "spend",
  "video_p25_watched_actions", "video_p50_watched_actions",
  "video_p75_watched_actions", "video_p100_watched_actions",
  "video_30_sec_watched_actions", "video_avg_time_watched_actions",
  "video_play_actions", "video_thruplay_watched_actions",
].join(",");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since") || undefined;
  const until = searchParams.get("until") || undefined;
  const preset = searchParams.get("preset") || (since ? undefined : "last_30d");
  const status = searchParams.get("status") || "ALL";

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
    return NextResponse.json({ data: [], error: result.error }, { status: 500 });
  }

  // Filtrar anúncios sem vídeo
  const validAds = filterValidVideoAds(result.data);

  // Agregar por ad_id (insights diários → totais por anúncio)
  const adMap = new Map<string, { insight: RawMetaInsight; impressions: number; spend: number }>();

  for (const insight of validAds) {
    const existing = adMap.get(insight.ad_id);
    if (existing) {
      // Somar impressions e spend — métricas de vídeo serão recalculadas
      existing.impressions += parseInt(insight.impressions) || 0;
      existing.spend += parseFloat(insight.spend) || 0;
    } else {
      adMap.set(insight.ad_id, {
        insight,
        impressions: parseInt(insight.impressions) || 0,
        spend: parseFloat(insight.spend) || 0,
      });
    }
  }

  // Calcular métricas por anúncio usando todos os insights diários
  const creatives: CreativeWithMetrics[] = [];

  adMap.forEach((entry, adId) => {
    // Pegar todos os insights deste ad para agregar métricas de vídeo
    const adInsights = validAds.filter((i) => i.ad_id === adId);

    // Criar insight agregado somando os valores
    const aggregated = aggregateInsights(adInsights);
    const metrics = calculateMetrics(aggregated);
    const score = calculateCreativeScore(metrics);

    creatives.push({
      id: adId,
      name: entry.insight.ad_name,
      status: "ACTIVE",
      campaignName: entry.insight.campaign_name,
      metrics,
      score,
      fatigue: "saudável",
      trend: "estável",
      spend: entry.spend,
      impressions: entry.impressions,
    });
  });

  return NextResponse.json({ data: creatives, error: result.error });
}

/** Agrega múltiplos insights diários em um único RawMetaInsight somado */
function aggregateInsights(insights: RawMetaInsight[]): RawMetaInsight {
  if (insights.length === 1) return insights[0];

  const base = { ...insights[0] };
  let totalImpressions = 0;
  let totalSpend = 0;

  const sumActions = (field: keyof RawMetaInsight): { action_type: string; value: string }[] => {
    let total = 0;
    for (const ins of insights) {
      const actions = ins[field] as { action_type: string; value: string }[] | undefined;
      if (actions?.[0]) total += parseInt(actions[0].value) || 0;
    }
    return total > 0 ? [{ action_type: "video_view", value: String(total) }] : [];
  };

  const avgActions = (field: keyof RawMetaInsight): { action_type: string; value: string }[] => {
    let total = 0;
    let count = 0;
    for (const ins of insights) {
      const actions = ins[field] as { action_type: string; value: string }[] | undefined;
      if (actions?.[0]) { total += parseFloat(actions[0].value) || 0; count++; }
    }
    return count > 0 ? [{ action_type: "video_view", value: String(total / count) }] : [];
  };

  for (const ins of insights) {
    totalImpressions += parseInt(ins.impressions) || 0;
    totalSpend += parseFloat(ins.spend) || 0;
  }

  base.impressions = String(totalImpressions);
  base.spend = String(totalSpend);
  base.video_play_actions = sumActions("video_play_actions");
  base.video_thruplay_watched_actions = sumActions("video_thruplay_watched_actions");
  base.video_p25_watched_actions = sumActions("video_p25_watched_actions");
  base.video_p50_watched_actions = sumActions("video_p50_watched_actions");
  base.video_p75_watched_actions = sumActions("video_p75_watched_actions");
  base.video_p100_watched_actions = sumActions("video_p100_watched_actions");
  base.video_30_sec_watched_actions = sumActions("video_30_sec_watched_actions");
  base.video_avg_time_watched_actions = avgActions("video_avg_time_watched_actions");

  return base;
}
