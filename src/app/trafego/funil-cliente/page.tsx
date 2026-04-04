"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AdsMetadata, AdsPerformance, LeadAdsAttribution } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/format";
import { TrafegoFilters, useTrafegoFilters } from "@/components/trafego-filters";

const ETAPAS_FUNIL = [
  { key: "novo", label: "Lead", cor: "#94a3b8" },
  { key: "qualificado", label: "Qualificado", cor: "#6366f1" },
  { key: "reuniao", label: "Reunião", cor: "#8b5cf6" },
  { key: "proposta", label: "Proposta", cor: "#f59e0b" },
  { key: "fechado", label: "Fechado", cor: "#22c55e" },
];

function mapEstagio(e: string): string {
  if (["novo", "oportunidade"].includes(e)) return "novo";
  if (["reuniao_agendada"].includes(e)) return "reuniao";
  if (["proposta_enviada", "follow_up", "assinatura_contrato"].includes(e)) return "proposta";
  if (["comprou", "fechado"].includes(e)) return "fechado";
  if (["desistiu"].includes(e)) return "perdido";
  return "qualificado";
}

export default function FunilClientePage() {
  const filters = useTrafegoFilters();
  const [metadata, setMetadata] = useState<AdsMetadata[]>([]);
  const [performance, setPerformance] = useState<AdsPerformance[]>([]);
  const [leads, setLeads] = useState<LeadAdsAttribution[]>([]);
  const [stageHistory, setStageHistory] = useState<{ lead_id: string; estagio_anterior: string | null; estagio_novo: string; alterado_em: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [filters.dataInicio, filters.dataFim]);

  async function loadData() {
    setLoading(true);
    const [{ data: m }, { data: p }, { data: l }, { data: h }] = await Promise.all([
      supabase.from("ads_metadata").select("*"),
      supabase.from("ads_performance").select("*").gte("data_ref", filters.dataInicio).lte("data_ref", filters.dataFim),
      supabase.from("leads_ads_attribution").select("*").gte("created_at", filters.dataInicio + "T00:00:00").lte("created_at", filters.dataFim + "T23:59:59"),
      supabase.from("leads_stages_history").select("*"),
    ]);
    setMetadata((m || []) as AdsMetadata[]);
    setPerformance((p || []) as AdsPerformance[]);
    setLeads((l || []) as LeadAdsAttribution[]);
    setStageHistory((h || []) as typeof stageHistory);
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  // Contar por etapa do funil
  const funilCounts = { novo: 0, qualificado: 0, reuniao: 0, proposta: 0, fechado: 0 };
  leads.forEach((l) => {
    const stage = mapEstagio(l.estagio_crm);
    if (stage in funilCounts) funilCounts[stage as keyof typeof funilCounts]++;
  });
  // Acumular: cada lead que chegou em "proposta" também passou por "qualificado" e "reuniao"
  const totalLeads = leads.length;
  const acumulado = {
    novo: totalLeads,
    qualificado: funilCounts.qualificado + funilCounts.reuniao + funilCounts.proposta + funilCounts.fechado,
    reuniao: funilCounts.reuniao + funilCounts.proposta + funilCounts.fechado,
    proposta: funilCounts.proposta + funilCounts.fechado,
    fechado: funilCounts.fechado,
  };

  // Tempo médio entre etapas (se houver histórico)
  const tempoMedio: Record<string, number> = {};
  const transicoes = stageHistory.filter((h) => h.estagio_anterior);
  if (transicoes.length > 0) {
    const leadIds = new Set(leads.map((l) => l.lead_id));
    const relevantHistory = transicoes.filter((h) => leadIds.has(h.lead_id));
    const grouped = new Map<string, typeof transicoes>();
    relevantHistory.forEach((h) => {
      const arr = grouped.get(h.lead_id) || [];
      arr.push(h);
      grouped.set(h.lead_id, arr);
    });
    grouped.forEach((hist) => {
      hist.sort((a, b) => new Date(a.alterado_em).getTime() - new Date(b.alterado_em).getTime());
      for (let i = 1; i < hist.length; i++) {
        const key = `${hist[i - 1].estagio_novo}→${hist[i].estagio_novo}`;
        const diff = (new Date(hist[i].alterado_em).getTime() - new Date(hist[i - 1].alterado_em).getTime()) / 86400000;
        if (!tempoMedio[key]) tempoMedio[key] = diff;
        else tempoMedio[key] = (tempoMedio[key] + diff) / 2;
      }
    });
  }

  // Por anúncio: quais criativos trouxeram leads que avançaram
  const adStats = metadata.filter((ad) => leads.some((l) => l.ad_id === ad.ad_id)).map((ad) => {
    const adLeads = leads.filter((l) => l.ad_id === ad.ad_id);
    const perfs = performance.filter((p) => p.ad_id === ad.ad_id);
    const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
    const total = adLeads.length;
    const qualif = adLeads.filter((l) => !["novo", "oportunidade"].includes(mapEstagio(l.estagio_crm))).length;
    const reuniao = adLeads.filter((l) => ["reuniao", "proposta", "fechado"].includes(mapEstagio(l.estagio_crm))).length;
    const fechados = adLeads.filter((l) => mapEstagio(l.estagio_crm) === "fechado").length;
    const receita = adLeads.reduce((s, l) => s + Number(l.receita_gerada), 0);
    const cac = fechados > 0 ? spend / fechados : 0;
    return {
      ...ad, total, qualifPct: total > 0 ? (qualif / total) * 100 : 0,
      reuniaoPct: total > 0 ? (reuniao / total) * 100 : 0,
      fechPct: total > 0 ? (fechados / total) * 100 : 0,
      fechados, cac, receita, spend,
    };
  }).sort((a, b) => b.fechados - a.fechados || b.qualifPct - a.qualifPct);

  const noData = leads.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Funil por Cliente</h1>
        <TrafegoFilters periodo={filters.periodo} onPeriodoChange={filters.setPeriodo} dataInicio={filters.dataInicio} dataFim={filters.dataFim} onDataInicioChange={filters.setDataInicio} onDataFimChange={filters.setDataFim} statusFiltro={filters.statusFiltro} onStatusChange={filters.setStatusFiltro} />
      </div>

      {noData ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum lead com atribuição de anúncio no período. Os dados aparecem quando leads com ad_id chegam pelo GHL.</CardContent></Card>
      ) : (
        <>
          {/* Funil Visual */}
          <Card>
            <CardHeader><CardTitle className="text-base">Funil de Conversão ({totalLeads} leads)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ETAPAS_FUNIL.map((etapa, i, arr) => {
                  const count = acumulado[etapa.key as keyof typeof acumulado];
                  const prevCount = i > 0 ? acumulado[arr[i - 1].key as keyof typeof acumulado] : totalLeads;
                  const pct = prevCount > 0 ? (count / prevCount) * 100 : 0;
                  const w = totalLeads > 0 ? Math.max(10, (count / totalLeads) * 100) : 10;
                  return (
                    <div key={etapa.key} className="flex items-center gap-3">
                      <span className="text-xs w-24 text-right text-muted-foreground">{etapa.label}</span>
                      <div className="flex-1">
                        <div className="h-10 rounded flex items-center justify-between px-3 text-white text-sm font-medium" style={{ width: `${w}%`, backgroundColor: etapa.cor }}>
                          <span>{count}</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground w-14">{i > 0 ? `${pct.toFixed(0)}%` : ""}</span>
                    </div>
                  );
                })}
              </div>

              {/* Tempo médio entre etapas */}
              {Object.keys(tempoMedio).length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Tempo médio entre etapas</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(tempoMedio).map(([key, dias]) => (
                      <Badge key={key} variant="outline" className="text-xs">{key}: {dias.toFixed(1)} dias</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabela por anúncio */}
          {adStats.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Performance por Criativo no Funil</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium text-xs">Anúncio</th>
                      <th className="px-3 py-2 text-right font-medium text-xs">Leads</th>
                      <th className="px-3 py-2 text-right font-medium text-xs">Qualif.%</th>
                      <th className="px-3 py-2 text-right font-medium text-xs">Reunião%</th>
                      <th className="px-3 py-2 text-right font-medium text-xs">Fechamento%</th>
                      <th className="px-3 py-2 text-right font-medium text-xs">CAC</th>
                      <th className="px-3 py-2 text-right font-medium text-xs">Receita</th>
                    </tr></thead>
                    <tbody>
                      {adStats.map((ad) => (
                        <tr key={ad.ad_id} className="border-b hover:bg-muted/30">
                          <td className="px-3 py-2 text-xs font-medium max-w-[200px]"><div className="truncate">{ad.ad_name || ad.ad_id}</div><div className="text-[10px] text-muted-foreground truncate">{ad.campaign_name || ""}</div></td>
                          <td className="px-3 py-2 text-xs text-right font-bold">{ad.total}</td>
                          <td className={`px-3 py-2 text-xs text-right font-medium ${ad.qualifPct >= 40 ? "text-green-400" : ad.qualifPct >= 20 ? "text-yellow-400" : "text-red-400"}`}>{formatPercent(ad.qualifPct)}</td>
                          <td className={`px-3 py-2 text-xs text-right font-medium ${ad.reuniaoPct >= 30 ? "text-green-400" : ad.reuniaoPct >= 15 ? "text-yellow-400" : "text-red-400"}`}>{formatPercent(ad.reuniaoPct)}</td>
                          <td className={`px-3 py-2 text-xs text-right font-medium ${ad.fechPct >= 10 ? "text-green-400" : ad.fechPct >= 5 ? "text-yellow-400" : "text-muted-foreground"}`}>{ad.fechados > 0 ? formatPercent(ad.fechPct) : "—"}</td>
                          <td className="px-3 py-2 text-xs text-right">{ad.cac > 0 ? formatCurrency(ad.cac) : "—"}</td>
                          <td className="px-3 py-2 text-xs text-right text-green-400">{ad.receita > 0 ? formatCurrency(ad.receita) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
