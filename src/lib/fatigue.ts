/**
 * Lógica de detecção de fadiga de criativos de vídeo.
 * Analisa tendência do Hook Rate ao longo dos dias para detectar
 * quando um criativo está perdendo eficácia (fadiga de audiência).
 * Funções puras sem dependências externas.
 */

import type { DailyMetric, FatigueStatus } from "./types/metaVideo";

/**
 * Calcula média móvel simples (SMA) para um array de valores.
 *
 * Algoritmo: para cada posição i, calcula a média dos últimos `window` valores.
 * Se i < window, usa todos os valores disponíveis até i.
 *
 * @param values Array de valores numéricos
 * @param window Tamanho da janela da média móvel
 * @returns Array de médias móveis (mesmo tamanho do input)
 */
export function calculateMovingAverage(values: number[], window: number): number[] {
  if (values.length === 0) return [];
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  });
}

/**
 * Detecta o status de fadiga de um criativo baseado no histórico de Hook Rate.
 *
 * Regras (em ordem de severidade):
 *
 * 1. FADIGA CRÍTICA: últimos 3 dias consecutivos abaixo da média histórica
 *    E queda > 30% em relação ao pico histórico.
 *    → O criativo perdeu mais de 30% da sua melhor performance e não se recupera.
 *
 * 2. EM FADIGA: últimos 3 dias consecutivos abaixo da média histórica.
 *    → O criativo está consistentemente abaixo do esperado.
 *
 * 3. ATENÇÃO: pelo menos 2 dos últimos 3 dias abaixo da média histórica.
 *    → Sinais iniciais de queda, mas ainda não confirmado.
 *
 * 4. SAUDÁVEL: nenhuma das condições acima.
 *    → O criativo está performando dentro ou acima do esperado.
 *
 * @param dailyHookRates Histórico diário de Hook Rate, ordenado por data crescente
 */
export function detectFatigueStatus(dailyHookRates: DailyMetric[]): FatigueStatus {
  // Precisa de pelo menos 4 dias de dados para análise significativa
  if (dailyHookRates.length < 4) return "saudável";

  const values = dailyHookRates.map((d) => d.hookRate);

  // Média histórica geral
  const avgHistorico = values.reduce((s, v) => s + v, 0) / values.length;
  if (avgHistorico === 0) return "saudável";

  // Pico histórico (maior Hook Rate já registrado)
  const pico = Math.max(...values);

  // Últimos 3 dias
  const ultimos3 = values.slice(-3);

  // Quantos dos últimos 3 dias estão abaixo da média
  const abaixoMedia = ultimos3.filter((v) => v < avgHistorico).length;

  // Todos os 3 consecutivos abaixo da média?
  const todosAbaixo = ultimos3.every((v) => v < avgHistorico);

  // Média dos últimos 3 dias
  const mediaRecente = ultimos3.reduce((s, v) => s + v, 0) / ultimos3.length;

  // Queda percentual em relação ao pico
  const quedaDoPico = pico > 0 ? ((pico - mediaRecente) / pico) * 100 : 0;

  // Regra 1: Fadiga crítica — abaixo da média + queda > 30% do pico
  if (todosAbaixo && quedaDoPico > 30) return "fadiga_crítica";

  // Regra 2: Em fadiga — 3 dias consecutivos abaixo da média
  if (todosAbaixo) return "em_fadiga";

  // Regra 3: Atenção — pelo menos 2 de 3 dias abaixo da média
  if (abaixoMedia >= 2) return "atenção";

  // Regra 4: Saudável
  return "saudável";
}

/**
 * Retorna a data e valor do maior Hook Rate histórico de um criativo.
 * Útil para mostrar "melhor dia" e calcular queda percentual.
 */
export function getPeakMetric(dailyMetrics: DailyMetric[]): { date: string; value: number } {
  if (dailyMetrics.length === 0) return { date: "", value: 0 };
  let peak = dailyMetrics[0];
  for (const m of dailyMetrics) {
    if (m.hookRate > peak.hookRate) peak = m;
  }
  return { date: peak.date, value: peak.hookRate };
}
