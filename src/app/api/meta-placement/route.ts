/**
 * Route 3 — Breakdown por placement.
 * GET /api/meta-placement?preset=last_30d
 *
 * Response shape:
 * { data: Record<string, Array<{ placement: PlacementGroup } & CalculatedMetrics>>, error?: string }
 * Agrupado por ad_id.
 */
import { NextRequest, NextResponse } from "next/server";
import { metaFetchPaginated } from "@/lib/meta-fetch";
import { calculateMetrics } from "@/lib/video-metrics";
import { mapToPlacementGroup } from "@/lib/placement";
import type { RawMetaInsight, CalculatedMetrics, PlacementGroup } from "@/lib/types/metaVideo";

const FIELDS = [
  "ad_id", "ad_name", "impressions", "spend",
  "video_play_actions", "video_p25_watched_actions",
  "video_p50_watched_actions", "video_p75_watched_actions",
  "video_p100_watched_actions", "video_thruplay_watched_actions",
].join(",");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since") || undefined;
  const until = searchParams.get("until") || undefined;
  const preset = searchParams.get("preset") || (since ? undefined : "last_30d");
  const status = searchParams.get("status") || "ALL";

  const result = await metaFetchPaginated<RawMetaInsight>({
    endpoint: "insights",
    statusFilter: status,
    fields: FIELDS,
    params: {
      level: "ad",
      breakdowns: "publisher_platform,platform_position",
    },
    datePreset: since ? undefined : preset,
    since,
    until,
  });

  if (result.error && result.data.length === 0) {
    return NextResponse.json({ data: {}, error: result.error }, { status: 500 });
  }

  // Agrupar por ad_id → array de placements com métricas
  const grouped: Record<string, Array<{ placement: PlacementGroup } & CalculatedMetrics>> = {};

  for (const insight of result.data) {
    const adId = insight.ad_id;
    if (!adId) continue;

    const plays = extractPlays(insight.video_play_actions);
    if (plays === 0) continue;

    const placement = mapToPlacementGroup(
      insight.publisher_platform || "",
      insight.platform_position || ""
    );

    const metrics = calculateMetrics(insight);

    if (!grouped[adId]) grouped[adId] = [];
    grouped[adId].push({ placement, ...metrics });
  }

  return NextResponse.json({ data: grouped, error: result.error });
}

function extractPlays(actions: { action_type: string; value: string }[] | undefined): number {
  if (!actions || actions.length === 0) return 0;
  const videoView = actions.find((a) => a.action_type === "video_view");
  return parseInt((videoView || actions[0]).value) || 0;
}
