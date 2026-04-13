"use client";
import { useEffect, useState } from "react";
import { KpiCard } from "@/components/kpi-card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useDateFilter } from "@/contexts/DateFilterContext";
import type { CreativeWithMetrics } from "@/lib/types/metaVideo";

function fmtTime(s: number): string {
  if (s >= 60) return `${Math.floor(s / 60)}min ${Math.round(s % 60)}s`;
  return `${s.toFixed(1)}s`;
}

export function VideoKpiCards() {
  const { queryString } = useDateFilter();
  const [ads, setAds] = useState<CreativeWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meta-video?${queryString}`).then((r) => r.json()).then((d) => {
      setAds(d.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [queryString]);

  if (loading) return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>;

  const totalPlays = ads.reduce((s, a) => s + a.metrics.totalPlays, 0);
  const totalThru = ads.reduce((s, a) => s + a.metrics.totalThruPlays, 0);
  const totalImp = ads.reduce((s, a) => s + a.impressions, 0);
  const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
  const avgHook = totalImp > 0 ? (totalPlays / totalImp) * 100 : 0;
  const totalP100 = ads.reduce((s, a) => s + (a.metrics.p100Rate / 100 * a.metrics.totalPlays), 0);
  const avgCompletion = totalPlays > 0 ? (totalP100 / totalPlays) * 100 : 0;
  const avgCostThru = totalThru > 0 ? totalSpend / totalThru : 0;
  const avgTime = ads.length > 0 ? ads.reduce((s, a) => s + a.metrics.avgTimeWatched, 0) / ads.length : 0;

  const hookClass =
    avgHook >= 80 ? "border-l-2 border-l-green-500" :
    avgHook >= 60 ? "border-l-2 border-l-yellow-500" :
    "border-l-2 border-l-red-500";
  const completionClass =
    avgCompletion > 15 ? "border-l-2 border-l-green-500" :
    avgCompletion >= 5 ? "border-l-2 border-l-yellow-500" :
    "border-l-2 border-l-red-500";
  const costThruClass =
    avgCostThru <= 1.5 ? "border-l-2 border-l-green-500" :
    avgCostThru <= 3.0 ? "border-l-2 border-l-yellow-500" :
    "border-l-2 border-l-red-500";

  const kpis = [
    { title: "Hook Rate", value: formatPercent(avgHook), className: hookClass, info: "Percentual de pessoas que pararam para assistir o vídeo após ver no feed. Fórmula: (plays / impressões) × 100. Acima de 30% é excelente." },
    { title: "Completion Rate", value: formatPercent(avgCompletion), className: completionClass, info: "Percentual de quem assistiu o vídeo até o final. Fórmula: (P100 / plays) × 100. Acima de 40% é muito bom." },
    { title: "Custo/ThruPlay", value: formatCurrency(avgCostThru), className: costThruClass, info: "Quanto custa cada visualização completa (ou 15s). Fórmula: investido / thru-plays. Quanto menor, melhor." },
    { title: "Tempo Médio", value: fmtTime(avgTime), className: "", info: "Tempo médio que as pessoas assistem o vídeo antes de pular. Quanto maior, mais engajado está o público." },
    { title: "Total Plays", value: totalPlays.toLocaleString("pt-BR"), className: "", info: "Total de vezes que o vídeo começou a ser reproduzido no período selecionado." },
    { title: "ThruPlays", value: totalThru.toLocaleString("pt-BR"), className: "", info: "Total de visualizações completas (ou de pelo menos 15 segundos). É o que o Meta cobra no modelo ThruPlay." },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <div key={kpi.title} className={`relative ${kpi.className}`}>
          <KpiCard title={kpi.title} value={kpi.value} className={kpi.className} />
          <div className="absolute top-2 right-2 group cursor-help">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="invisible group-hover:visible absolute right-0 top-full mt-1 z-50 w-64 p-2.5 text-[11px] text-muted-foreground bg-card border rounded-lg shadow-lg leading-relaxed">
              {kpi.info}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
