/**
 * Faixas de comissão (5B). Fonte: regras de negócio Comarka Ads.
 *
 * SDR / Social Seller — prêmio por COMPARECIMENTO (reunião feita)
 * Closer — % sobre vendas (OTE)
 *
 * `pct` é o atingimento da meta (0..100+). Cada faixa é o valor MÍNIMO de pct.
 */

export type CargoComissao = "closer" | "sdr" | "social_seller";

export interface FaixaSdr { min: number; valorPorReuniao: number; label: string }
export interface FaixaCloser { min: number; pctComissao: number; label: string }

export const FAIXAS_SDR: FaixaSdr[] = [
  { min: 0,  valorPorReuniao: 0,  label: "0% – 49%" },
  { min: 50, valorPorReuniao: 4,  label: "50% – 65%" },
  { min: 66, valorPorReuniao: 6,  label: "66% – 79%" },
  { min: 80, valorPorReuniao: 8,  label: "80% – 89%" },
  { min: 90, valorPorReuniao: 12, label: "90% – 100%+" },
];

export const FAIXAS_CLOSER: FaixaCloser[] = [
  { min: 0,  pctComissao: 0,    label: "0% – 49%" },
  { min: 50, pctComissao: 0.02, label: "50% – 65%" },
  { min: 66, pctComissao: 0.04, label: "66% – 79%" },
  { min: 80, pctComissao: 0.07, label: "80% – 89%" },
  { min: 90, pctComissao: 0.10, label: "90% – 100%+" },
];

function pickFaixa<T extends { min: number }>(faixas: T[], pct: number): { atual: T; proxima: T | null } {
  let atual = faixas[0];
  for (const f of faixas) if (pct >= f.min) atual = f;
  const idx = faixas.indexOf(atual);
  const proxima = idx < faixas.length - 1 ? faixas[idx + 1] : null;
  return { atual, proxima };
}

export interface ComissaoResultado {
  cargo: CargoComissao;
  meta: number;
  realizado: number;
  pctAtingido: number;
  comissao: number;
  faixaAtualLabel: string;
  proximaFaixa: { label: string; min: number; faltaParaAtingir: number } | null;
  // Para exibir o "como foi calculado"
  detalhe: string;
}

export function calcularComissaoSdr(opts: {
  comparecimentos: number;
  metaReunioes: number;
}): ComissaoResultado {
  const { comparecimentos, metaReunioes } = opts;
  const pct = metaReunioes > 0 ? (comparecimentos / metaReunioes) * 100 : 0;
  const { atual, proxima } = pickFaixa(FAIXAS_SDR, pct);
  const comissao = comparecimentos * atual.valorPorReuniao;
  return {
    cargo: "sdr",
    meta: metaReunioes,
    realizado: comparecimentos,
    pctAtingido: pct,
    comissao,
    faixaAtualLabel: atual.label,
    proximaFaixa: proxima
      ? {
          label: proxima.label,
          min: proxima.min,
          // Quantas reuniões faltam para atingir o min da próxima faixa
          faltaParaAtingir: Math.max(0, Math.ceil((proxima.min / 100) * metaReunioes) - comparecimentos),
        }
      : null,
    detalhe: `${comparecimentos} comparecimentos × R$${atual.valorPorReuniao.toFixed(2)} = R$${comissao.toFixed(2)}`,
  };
}

export function calcularComissaoCloser(opts: {
  totalVendido: number;
  metaVendas: number;
}): ComissaoResultado {
  const { totalVendido, metaVendas } = opts;
  const pct = metaVendas > 0 ? (totalVendido / metaVendas) * 100 : 0;
  const { atual, proxima } = pickFaixa(FAIXAS_CLOSER, pct);
  const comissao = totalVendido * atual.pctComissao;
  return {
    cargo: "closer",
    meta: metaVendas,
    realizado: totalVendido,
    pctAtingido: pct,
    comissao,
    faixaAtualLabel: atual.label,
    proximaFaixa: proxima
      ? {
          label: proxima.label,
          min: proxima.min,
          faltaParaAtingir: Math.max(0, (proxima.min / 100) * metaVendas - totalVendido),
        }
      : null,
    detalhe: `R$${totalVendido.toFixed(2)} × ${(atual.pctComissao * 100).toFixed(0)}% = R$${comissao.toFixed(2)}`,
  };
}

export function corDaFaixa(pct: number): "red" | "yellow" | "green" {
  if (pct >= 80) return "green";
  if (pct >= 50) return "yellow";
  return "red";
}
