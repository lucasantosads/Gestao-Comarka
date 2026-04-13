"use client";

import type { AdsMetadata } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { TrafegoFilters, useTrafegoFilters } from "@/components/trafego-filters";
import { useTrafegoData } from "@/hooks/use-trafego-data";

export default function TrafegoConjuntosPage() {
  const filters = useTrafegoFilters();
  const { data: tData, isLoading: loading } = useTrafegoData(filters.dataInicio, filters.dataFim, filters.statusFiltro);

  const metadata = tData?.metadata || [];
  const performance = tData?.performance || [];
  const leads = tData?.leads || [];

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
    const crmLeads = lds.length;
    const leadsCount = perfs.reduce((s, p) => s + p.leads, 0);
    const qualificados = lds.filter((l) => !["novo", "oportunidade"].includes(l.estagio_crm)).length;
    const fechados = lds.filter((l) => l.estagio_crm === "fechado" || l.estagio_crm === "comprou").length;
    const cpl = leadsCount > 0 ? spend / leadsCount : 0;
    const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;
    const taxaQualif = crmLeads > 0 ? (qualificados / crmLeads) * 100 : 0;
    const cpa = fechados > 0 ? spend / fechados : 0;
    return { id: asid, nome: ads[0]?.adset_name || asid, campanha: ads[0]?.campaign_name || "—", spend, leadsCount, cpl, ctr, taxaQualif, cpa };
  }).filter((as) => !filters.somenteComDados || as.spend > 0).sort((a, b) => b.spend - a.spend);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Conjuntos de Anúncios ({adsetData.length})</h1>
        <TrafegoFilters periodo={filters.periodo} onPeriodoChange={filters.setPeriodo} dataInicio={filters.dataInicio} dataFim={filters.dataFim} onDataInicioChange={filters.setDataInicio} onDataFimChange={filters.setDataFim} statusFiltro={filters.statusFiltro} onStatusChange={filters.setStatusFiltro} somenteComDados={filters.somenteComDados} onSomenteComDadosChange={filters.setSomenteComDados} />
      </div>
      {/* KPI summary — usa performance total, não apenas conjuntos agrupados */}
      {(() => {
        const totalInvest = performance.reduce((s, p) => s + Number(p.spend), 0);
        const totalLeads = performance.reduce((s, p) => s + p.leads, 0);
        const cplPond = totalLeads > 0 ? totalInvest / totalLeads : 0;
        const ativos = adsetData.filter((a) => a.spend > 0).length;
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total Investido</p><p className="text-xl font-bold">{formatCurrency(totalInvest)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">CPL Médio Ponderado</p><p className="text-xl font-bold">{cplPond > 0 ? formatCurrency(cplPond) : "—"}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Conjuntos Ativos</p><p className="text-xl font-bold">{ativos}</p></CardContent></Card>
          </div>
        );
      })()}

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
