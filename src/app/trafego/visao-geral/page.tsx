"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AdsMetadata, AdsPerformance, LeadAdsAttribution } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format";
import { TrafegoFilters, useTrafegoFilters } from "@/components/trafego-filters";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";

export default function TrafegoVisaoGeralPage() {
  const filters = useTrafegoFilters();
  const [metadata, setMetadata] = useState<AdsMetadata[]>([]);
  const [performance, setPerformance] = useState<AdsPerformance[]>([]);
  const [leads, setLeads] = useState<LeadAdsAttribution[]>([]);
  const [prevPerf, setPrevPerf] = useState<AdsPerformance[]>([]);
  const [prevLeads, setPrevLeads] = useState<LeadAdsAttribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [filters.dataInicio, filters.dataFim, filters.statusFiltro]);

  async function loadData() {
    setLoading(true);
    let metaQuery = supabase.from("ads_metadata").select("*");
    if (filters.statusFiltro !== "all") metaQuery = metaQuery.eq("status", filters.statusFiltro);

    // Período anterior
    const inicio = new Date(filters.dataInicio + "T00:00:00");
    const fim = new Date(filters.dataFim + "T23:59:59");
    const dias = Math.ceil((fim.getTime() - inicio.getTime()) / 86400000);
    const prevFimDate = new Date(inicio); prevFimDate.setDate(prevFimDate.getDate() - 1);
    const prevInicioDate = new Date(prevFimDate); prevInicioDate.setDate(prevInicioDate.getDate() - dias);
    const pi = prevInicioDate.toISOString().split("T")[0];
    const pf = prevFimDate.toISOString().split("T")[0];

    const [{ data: meta }, { data: perf }, { data: lds }, { data: pp }, { data: pl }] = await Promise.all([
      metaQuery,
      supabase.from("ads_performance").select("*").gte("data_ref", filters.dataInicio).lte("data_ref", filters.dataFim),
      supabase.from("leads_ads_attribution").select("*").gte("created_at", filters.dataInicio + "T00:00:00").lte("created_at", filters.dataFim + "T23:59:59"),
      supabase.from("ads_performance").select("*").gte("data_ref", pi).lte("data_ref", pf),
      supabase.from("leads_ads_attribution").select("*").gte("created_at", pi + "T00:00:00").lte("created_at", pf + "T23:59:59"),
    ]);

    setMetadata((meta || []) as AdsMetadata[]);
    setPerformance((perf || []) as AdsPerformance[]);
    setLeads((lds || []) as LeadAdsAttribution[]);
    setPrevPerf((pp || []) as AdsPerformance[]);
    setPrevLeads((pl || []) as LeadAdsAttribution[]);
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  // Filtrar performance apenas dos anúncios visíveis
  const adIds = new Set(metadata.map((m) => m.ad_id));
  const filteredPerf = performance.filter((p) => adIds.has(p.ad_id));

  const totalSpend = filteredPerf.reduce((s, p) => s + Number(p.spend), 0);
  const totalImpressions = filteredPerf.reduce((s, p) => s + p.impressoes, 0);
  const totalClicks = filteredPerf.reduce((s, p) => s + p.cliques, 0);
  const totalLeadsMeta = filteredPerf.reduce((s, p) => s + p.leads, 0);
  const totalLeadsCrm = leads.filter((l) => adIds.has(l.ad_id || "")).length;
  const totalLeads = totalLeadsCrm > 0 ? totalLeadsCrm : totalLeadsMeta;
  const totalFechados = leads.filter((l) => adIds.has(l.ad_id || "") && (l.estagio_crm === "fechado" || l.estagio_crm === "comprou")).length;
  const totalReceita = leads.filter((l) => adIds.has(l.ad_id || "")).reduce((s, l) => s + Number(l.receita_gerada), 0);
  const cplMedio = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const cac = totalFechados > 0 ? totalSpend / totalFechados : 0;
  const roas = totalSpend > 0 ? totalReceita / totalSpend : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // Top anúncios
  const adStats = metadata.map((ad) => {
    const perfs = filteredPerf.filter((p) => p.ad_id === ad.ad_id);
    const lds = leads.filter((l) => l.ad_id === ad.ad_id);
    const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
    const metaLeads = perfs.reduce((s, p) => s + p.leads, 0);
    const crmLeads = lds.length;
    const leadsCount = crmLeads > 0 ? crmLeads : metaLeads;
    const impressoes = perfs.reduce((s, p) => s + p.impressoes, 0);
    const cliques = perfs.reduce((s, p) => s + p.cliques, 0);
    const qualificados = lds.filter((l) => !["novo", "oportunidade"].includes(l.estagio_crm)).length;
    const taxaQualif = crmLeads > 0 ? (qualificados / crmLeads) * 100 : 0;
    const cpl = leadsCount > 0 ? spend / leadsCount : 0;
    const adCtr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;
    return { ...ad, spend, leadsCount, metaLeads, crmLeads, taxaQualif, cpl, impressoes, adCtr };
  }).filter((a) => a.spend > 0 || a.leadsCount > 0).sort((a, b) => b.spend - a.spend);

  // Alertas
  const alertas = adStats.filter((a) => a.cpl > cplMedio * 1.5 && a.leadsCount >= 3).map((a) => ({
    ad: a.ad_name || a.ad_id,
    msg: `CPL de ${formatCurrency(a.cpl)} — ${Math.round((a.cpl / cplMedio - 1) * 100)}% acima da média`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Tráfego Pago</h1>
        <TrafegoFilters
          periodo={filters.periodo} onPeriodoChange={filters.setPeriodo}
          dataInicio={filters.dataInicio} dataFim={filters.dataFim}
          onDataInicioChange={filters.setDataInicio} onDataFimChange={filters.setDataFim}
          statusFiltro={filters.statusFiltro} onStatusChange={filters.setStatusFiltro}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard title="Investido" value={formatCurrency(totalSpend)} />
        <KpiCard title="Impressões" value={formatNumber(totalImpressions)} />
        <KpiCard title="Cliques" value={formatNumber(totalClicks)} />
        <KpiCard title="CTR" value={formatPercent(ctr)} />
        <KpiCard title="Leads (Meta)" value={formatNumber(totalLeadsMeta)} />
        <KpiCard title="CPL" value={totalLeads > 0 ? formatCurrency(cplMedio) : "—"} />
        <KpiCard title="Leads (CRM)" value={formatNumber(totalLeadsCrm)} />
        {totalFechados > 0 && <KpiCard title="CAC" value={formatCurrency(cac)} />}
        {totalFechados > 0 && <KpiCard title="ROAS" value={roas.toFixed(2) + "x"} />}
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-yellow-400">
              <span>⚠️</span><span><strong>{a.ad}</strong>: {a.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top Anúncios */}
      <Card>
        <CardHeader><CardTitle className="text-base">Top Anúncios ({adStats.length} anúncios)</CardTitle></CardHeader>
        <CardContent>
          {adStats.length > 0 ? (
            <div className="space-y-3">
              {adStats.slice(0, 10).map((ad) => (
                <div key={ad.ad_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{ad.ad_name || ad.ad_id}</p>
                    <p className="text-xs text-muted-foreground truncate">{ad.campaign_name || "—"}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-sm">{formatCurrency(ad.spend)}</p>
                      <p className="text-muted-foreground">investido</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{ad.impressoes.toLocaleString("pt-BR")}</p>
                      <p className="text-muted-foreground">impressões</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{ad.metaLeads}</p>
                      <p className="text-muted-foreground">leads</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{ad.cpl > 0 ? formatCurrency(ad.cpl) : "—"}</p>
                      <p className="text-muted-foreground">CPL</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{formatPercent(ad.adCtr)}</p>
                      <p className="text-muted-foreground">CTR</p>
                    </div>
                    <Badge className={`text-[10px] ${ad.status === "ACTIVE" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {ad.status === "ACTIVE" ? "Ativo" : (ad.status || "").replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum anúncio com dados no período</p>
          )}
        </CardContent>
      </Card>
      {/* Comparativo de Período */}
      {(() => {
        const adIdsArr = Array.from(adIds);
        const prevPerfFiltered = prevPerf.filter((p) => adIdsArr.includes(p.ad_id));
        const pSpend = prevPerfFiltered.reduce((s, p) => s + Number(p.spend), 0);
        const pLeadsMeta = prevPerfFiltered.reduce((s, p) => s + p.leads, 0);
        const pLeadsCrm = prevLeads.filter((l) => adIdsArr.includes(l.ad_id || "")).length;
        const pLeads = pLeadsCrm > 0 ? pLeadsCrm : pLeadsMeta;
        const pCpl = pLeads > 0 ? pSpend / pLeads : 0;
        const delta = (cur: number, prev: number, inv = false) => {
          if (prev === 0) return null;
          const pct = ((cur - prev) / prev) * 100;
          return { pct, pos: inv ? pct < 0 : pct > 0 };
        };
        const comp = [
          { label: "Investido", atual: formatCurrency(totalSpend), anterior: formatCurrency(pSpend), d: delta(totalSpend, pSpend, true) },
          { label: "Leads", atual: String(totalLeads), anterior: String(pLeads), d: delta(totalLeads, pLeads) },
          { label: "CPL", atual: totalLeads > 0 ? formatCurrency(cplMedio) : "—", anterior: pLeads > 0 ? formatCurrency(pCpl) : "—", d: delta(cplMedio, pCpl, true) },
        ];
        // Tendência diária
        const byDay = new Map<string, { dia: string; spend: number; leads: number; cpl: number }>();
        performance.forEach((p) => {
          const d = p.data_ref.slice(5);
          const e = byDay.get(d) || { dia: d, spend: 0, leads: 0, cpl: 0 };
          e.spend += Number(p.spend); e.leads += p.leads;
          byDay.set(d, e);
        });
        const chartData = Array.from(byDay.values()).map((d) => ({ ...d, cpl: d.leads > 0 ? Math.round(d.spend / d.leads * 100) / 100 : 0 }));

        return (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Comparativo com Período Anterior</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {comp.map((m) => (
                    <div key={m.label} className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                      <p className="text-lg font-bold">{m.atual}</p>
                      <p className="text-xs text-muted-foreground">{m.anterior}</p>
                      {m.d && <p className={`text-xs font-medium mt-1 ${m.d.pos ? "text-green-400" : "text-red-400"}`}>{m.d.pos ? "↑" : "↓"} {Math.abs(m.d.pct).toFixed(0)}%</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {chartData.length > 1 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Tendência Diária</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="dia" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v, n) => [n === "CPL" ? formatCurrency(Number(v)) : formatCurrency(Number(v)), n]} contentStyle={{ fontSize: 12 }} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="spend" name="Investido" stroke="#6366f1" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="cpl" name="CPL" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </>
        );
      })()}
    </div>
  );
}
