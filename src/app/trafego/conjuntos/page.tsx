"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AdsMetadata, AdsPerformance, LeadAdsAttribution } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { TrafegoFilters, useTrafegoFilters } from "@/components/trafego-filters";

export default function TrafegoConjuntosPage() {
  const filters = useTrafegoFilters();
  const [metadata, setMetadata] = useState<AdsMetadata[]>([]);
  const [performance, setPerformance] = useState<AdsPerformance[]>([]);
  const [leads, setLeads] = useState<LeadAdsAttribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [filters.dataInicio, filters.dataFim, filters.statusFiltro]);

  async function loadData() {
    setLoading(true);
    let metaQuery = supabase.from("ads_metadata").select("*");
    if (filters.statusFiltro !== "all") metaQuery = metaQuery.eq("status", filters.statusFiltro);
    const [{ data: m }, { data: p }, { data: l }] = await Promise.all([
      metaQuery,
      supabase.from("ads_performance").select("*").gte("data_ref", filters.dataInicio).lte("data_ref", filters.dataFim),
      supabase.from("leads_ads_attribution").select("*").gte("created_at", filters.dataInicio + "T00:00:00").lte("created_at", filters.dataFim + "T23:59:59"),
    ]);
    setMetadata((m || []) as AdsMetadata[]);
    setPerformance((p || []) as AdsPerformance[]);
    setLeads((l || []) as LeadAdsAttribution[]);
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  const adsetMap = new Map<string, AdsMetadata[]>();
  metadata.forEach((m) => { if (m.adset_id) { const arr = adsetMap.get(m.adset_id) || []; arr.push(m); adsetMap.set(m.adset_id, arr); } });

  const adsetData = Array.from(adsetMap, ([asid, ads]) => {
    const adIds = ads.map((a) => a.ad_id);
    const perfs = performance.filter((p) => adIds.includes(p.ad_id));
    const lds = leads.filter((l) => l.adset_id === asid);
    const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
    const impressoes = perfs.reduce((s, p) => s + p.impressoes, 0);
    const cliques = perfs.reduce((s, p) => s + p.cliques, 0);
    const leadsCount = lds.length;
    const qualificados = lds.filter((l) => !["novo", "oportunidade"].includes(l.estagio_crm)).length;
    const fechados = lds.filter((l) => l.estagio_crm === "fechado" || l.estagio_crm === "comprou").length;
    const cpl = leadsCount > 0 ? spend / leadsCount : 0;
    const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;
    const taxaQualif = leadsCount > 0 ? (qualificados / leadsCount) * 100 : 0;
    const cpa = fechados > 0 ? spend / fechados : 0;
    return { id: asid, nome: ads[0]?.adset_name || asid, campanha: ads[0]?.campaign_name || "—", spend, leadsCount, cpl, ctr, taxaQualif, cpa };
  }).sort((a, b) => b.spend - a.spend);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Conjuntos de Anúncios ({adsetData.length})</h1>
        <TrafegoFilters periodo={filters.periodo} onPeriodoChange={filters.setPeriodo} dataInicio={filters.dataInicio} dataFim={filters.dataFim} onDataInicioChange={filters.setDataInicio} onDataFimChange={filters.setDataFim} statusFiltro={filters.statusFiltro} onStatusChange={filters.setStatusFiltro} />
      </div>
      {adsetData.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum conjunto com os filtros selecionados</CardContent></Card>
      ) : (
        <Card><CardContent className="p-0"><div className="overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium text-xs">Conjunto</th>
              <th className="px-3 py-2 text-left font-medium text-xs">Campanha</th>
              <th className="px-3 py-2 text-right font-medium text-xs">Leads</th>
              <th className="px-3 py-2 text-right font-medium text-xs">CPL</th>
              <th className="px-3 py-2 text-right font-medium text-xs">CTR</th>
              <th className="px-3 py-2 text-right font-medium text-xs">Qualif.%</th>
              <th className="px-3 py-2 text-right font-medium text-xs">CPA</th>
              <th className="px-3 py-2 text-right font-medium text-xs">Investido</th>
            </tr></thead>
            <tbody>
              {adsetData.map((as) => (
                <tr key={as.id} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium max-w-[180px] truncate text-xs">{as.nome}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[140px] truncate">{as.campanha}</td>
                  <td className="px-3 py-2 text-right font-bold text-xs">{as.leadsCount}</td>
                  <td className="px-3 py-2 text-right text-xs">{as.leadsCount > 0 ? formatCurrency(as.cpl) : "—"}</td>
                  <td className="px-3 py-2 text-right text-xs">{formatPercent(as.ctr)}</td>
                  <td className={`px-3 py-2 text-right text-xs font-medium ${as.taxaQualif >= 50 ? "text-green-400" : as.taxaQualif >= 30 ? "text-yellow-400" : as.leadsCount > 0 ? "text-red-400" : "text-muted-foreground"}`}>{as.leadsCount > 0 ? formatPercent(as.taxaQualif) : "—"}</td>
                  <td className="px-3 py-2 text-right text-xs">{as.cpa > 0 ? formatCurrency(as.cpa) : "—"}</td>
                  <td className="px-3 py-2 text-right text-xs">{formatCurrency(as.spend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></CardContent></Card>
      )}
    </div>
  );
}
