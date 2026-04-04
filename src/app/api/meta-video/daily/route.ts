/**
 * Route 2 — Dados diários para fadiga e tendência.
 * GET /api/meta-video/daily?preset=last_30d
 *
 * Response shape:
 * { data: Record<string, DailyMetric[]>, error?: string }
 * Agrupado por ad_id. Cada array ordenado por data crescente.
 */
import { NextRequest, NextResponse } from "next/server";
import { metaFetchPaginated } from "@/lib/meta-fetch";
import type { RawMetaInsight, DailyMetric } from "@/lib/types/metaVideo";

const FIELDS = "ad_id,ad_name,impressions,video_play_actions,date_start";

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
    statusFilter: status,
    since,
    until,
  });

  if (result.error && result.data.length === 0) {
    return NextResponse.json({ data: {}, error: result.error }, { status: 500 });
  }

  // Agrupar por ad_id e calcular Hook Rate diário
  const grouped: Record<string, DailyMetric[]> = {};

  for (const insight of result.data) {
    const adId = insight.ad_id;
    if (!adId) continue;

    const impressions = parseInt(insight.impressions) || 0;
    const plays = extractPlays(insight.video_play_actions);

    if (plays === 0) continue;

    const hookRate = impressions > 0 ? (plays / impressions) * 100 : 0;

    if (!grouped[adId]) grouped[adId] = [];
    grouped[adId].push({
      date: insight.date_start,
      hookRate,
      adName: insight.ad_name,
    });
  }

  // Ordenar cada array por data crescente
  for (const adId of Object.keys(grouped)) {
    grouped[adId].sort((a, b) => a.date.localeCompare(b.date));
  }

  return NextResponse.json({ data: grouped, error: result.error });
}

function extractPlays(actions: { action_type: string; value: string }[] | undefined): number {
  if (!actions || actions.length === 0) return 0;
  const videoView = actions.find((a) => a.action_type === "video_view");
  return parseInt((videoView || actions[0]).value) || 0;
}
