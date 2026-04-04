/**
 * Lógica de tendências e comparativos de métricas de vídeo.
 * Compara períodos recentes vs anteriores para detectar direção.
 * Funções puras sem dependências externas.
 */

import type { RawMetaInsight, CreativeTrend, DailyMetric } from "./types/metaVideo";

/**
 * Calcula a tendência comparando média dos últimos N dias vs N dias anteriores.
 *
 * - Subindo: variação > +5%
 * - Estável: variação entre -5% e +5%
 * - Caindo: variação < -5%
 *
 * @param recentDays Valores dos dias mais recentes
 * @param previousDays Valores dos dias anteriores (mesmo tamanho idealmente)
 */
export function calculateTrend(recentDays: number[], previousDays: number[]): CreativeTrend {
  if (recentDays.length === 0 || previousDays.length === 0) return "estável";

  const avgRecent = recentDays.reduce((s, v) => s + v, 0) / recentDays.length;
  const avgPrevious = previousDays.reduce((s, v) => s + v, 0) / previousDays.length;

  if (avgPrevious === 0) return avgRecent > 0 ? "subindo" : "estável";

  const variacao = ((avgRecent - avgPrevious) / avgPrevious) * 100;

  if (variacao > 5) return "subindo";
  if (variacao < -5) return "caindo";
  return "estável";
}

/**
 * Agrupa array de insights por data (date_start).
 * Retorna um Record onde a chave é a data e o valor é o array de insights daquele dia.
 */
export function groupMetricsByDate(insights: RawMetaInsight[]): Record<string, RawMetaInsight[]> {
  const grouped: Record<string, RawMetaInsight[]> = {};
  for (const insight of insights) {
    const date = insight.date_start;
    if (!date) continue;
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(insight);
  }
  return grouped;
}

/**
 * Extrai o valor numérico de um array de actions da Meta API.
 * Retorna 0 se não encontrar ou se for undefined.
 */
function extractActionValue(actions: { action_type: string; value: string }[] | undefined): number {
  if (!actions || actions.length === 0) return 0;
  const action = actions.find((a) => a.action_type === "video_view") || actions[0];
  return parseInt(action.value) || 0;
}

/**
 * Calcula o Hook Rate diário para cada data presente nos insights.
 * Hook Rate = (video_play_actions / impressions) * 100
 *
 * @param insights Array de insights brutos (pode conter múltiplos anúncios por dia)
 * @returns Array de DailyMetric ordenado por data crescente
 */
export function calculateDailyHookRate(insights: RawMetaInsight[]): DailyMetric[] {
  const byDate = groupMetricsByDate(insights);
  const dailyMetrics: DailyMetric[] = [];

  for (const [date, dayInsights] of Object.entries(byDate)) {
    let totalPlays = 0;
    let totalImpressions = 0;

    for (const ins of dayInsights) {
      totalPlays += extractActionValue(ins.video_play_actions);
      totalImpressions += parseInt(ins.impressions) || 0;
    }

    const hookRate = totalImpressions > 0 ? (totalPlays / totalImpressions) * 100 : 0;
    const adName = dayInsights[0]?.ad_name || "";

    dailyMetrics.push({ date, hookRate, adName });
  }

  // Ordenar por data crescente
  dailyMetrics.sort((a, b) => a.date.localeCompare(b.date));

  return dailyMetrics;
}
