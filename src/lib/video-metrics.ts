/**
 * Cálculo das métricas base de vídeo a partir dos dados brutos da Meta API.
 * Transforma RawMetaInsight em CalculatedMetrics.
 * Funções puras sem dependências externas.
 */

import type { RawMetaInsight, CalculatedMetrics } from "./types/metaVideo";

/**
 * Extrai o valor numérico de um array de actions da Meta API.
 * A Meta retorna ações como [{ action_type: "video_view", value: "150" }].
 * Busca primeiro por "video_view", depois usa o primeiro disponível.
 * Retorna 0 se o array for undefined ou vazio.
 */
function extractActionValue(actions: { action_type: string; value: string }[] | undefined): number {
  if (!actions || actions.length === 0) return 0;
  const videoView = actions.find((a) => a.action_type === "video_view");
  const target = videoView || actions[0];
  return parseInt(target.value) || 0;
}

/**
 * Extrai o valor float de um array de actions (usado para avg_time_watched).
 */
function extractActionFloat(actions: { action_type: string; value: string }[] | undefined): number {
  if (!actions || actions.length === 0) return 0;
  const target = actions[0];
  return parseFloat(target.value) || 0;
}

/**
 * Divisão segura que retorna 0 em vez de Infinity ou NaN.
 */
function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0 || !isFinite(numerator) || !isFinite(denominator)) return 0;
  return numerator / denominator;
}

/**
 * Calcula todas as métricas de vídeo a partir de um insight bruto da Meta API.
 *
 * Fórmulas:
 * - hookRate = (plays / impressions) × 100 — quem parou pra assistir
 * - holdRate = (30s watched / plays) × 100 — quem ficou além do hook
 * - completionRate = (p100 / plays) × 100 — quem assistiu tudo
 * - p25/50/75/100Rate = (pN / plays) × 100 — retenção por quartil
 * - costPerThruPlay = spend / thruplay — custo por visualização completa
 * - avgTimeWatched = valor direto da API (em segundos)
 * - totalPlays = video_play_actions
 * - totalThruPlays = video_thruplay_watched_actions
 */
export function calculateMetrics(insight: RawMetaInsight): CalculatedMetrics {
  const impressions = parseInt(insight.impressions) || 0;
  const spend = parseFloat(insight.spend) || 0;
  const plays = extractActionValue(insight.video_play_actions);
  const thruplay = extractActionValue(insight.video_thruplay_watched_actions);
  const p25 = extractActionValue(insight.video_p25_watched_actions);
  const p50 = extractActionValue(insight.video_p50_watched_actions);
  const p75 = extractActionValue(insight.video_p75_watched_actions);
  const p100 = extractActionValue(insight.video_p100_watched_actions);
  const sec30 = extractActionValue(insight.video_30_sec_watched_actions);
  const avgTime = extractActionFloat(insight.video_avg_time_watched_actions);

  return {
    hookRate: safeDivide(plays, impressions) * 100,
    holdRate: safeDivide(sec30, plays) * 100,
    completionRate: safeDivide(p100, plays) * 100,
    p25Rate: safeDivide(p25, plays) * 100,
    p50Rate: safeDivide(p50, plays) * 100,
    p75Rate: safeDivide(p75, plays) * 100,
    p100Rate: safeDivide(p100, plays) * 100,
    costPerThruPlay: safeDivide(spend, thruplay),
    avgTimeWatched: avgTime,
    totalPlays: plays,
    totalThruPlays: thruplay,
  };
}

/**
 * Filtra insights que possuem dados de vídeo válidos.
 * Remove anúncios sem video_play_actions ou com plays === 0.
 * Essencial para evitar divisão por zero nas métricas.
 */
export function filterValidVideoAds(insights: RawMetaInsight[]): RawMetaInsight[] {
  return insights.filter((insight) => {
    const plays = extractActionValue(insight.video_play_actions);
    return plays > 0;
  });
}
