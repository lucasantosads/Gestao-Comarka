"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AdsMetadata, AdsPerformance, LeadAdsAttribution } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { TrafegoFilters, useTrafegoFilters } from "@/components/trafego-filters";

export default function TrafegoCampanhasPage() {
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
      supabase.from("ads_performance").select("*").gte("data_ref", filters.dataInicio).lte("data_ref", filters.dataFim).order("data_ref"),
      supabase.from("leads_ads_attribution").select("*").gte("created_at", filters.dataInicio + "T00:00:00").lte("created_at", filters.dataFim + "T23:59:59"),
    ]);
    setMetadata((m || []) as AdsMetadata[]);
    setPerformance((p || []) as AdsPerformance[]);
    setLeads((l || []) as LeadAdsAttribution[]);
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  const campanhasMap = new Map<string, AdsMetadata[]>();
  metadata.forEach((m) => { if (m.campaign_id) { const arr = campanhasMap.get(m.campaign_id) || []; arr.push(m); campanhasMap.set(m.campaign_id, arr); } });

  const campanhaData = Array.from(campanhasMap, ([cid, ads]) => {
    const adIds = ads.map((a) => a.ad_id);
    const perfs = performance.filter((p) => adIds.includes(p.ad_id));
    const lds = leads.filter((l) => l.campaign_id === cid);
    const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
    const leadsCount = lds.length;
    const qualificados = lds.filter((l) => !["novo", "oportunidade"].includes(l.estagio_crm)).length;
    const reuniao = lds.filter((l) => ["reuniao_agendada", "proposta_enviada", "assinatura_contrato", "comprou"].includes(l.estagio_crm)).length;
    const fechados = lds.filter((l) => l.estagio_crm === "fechado" || l.estagio_crm === "comprou").length;
    const metaLeads = perfs.reduce((s, p) => s + p.leads, 0);
    const totalLeads = leadsCount > 0 ? leadsCount : metaLeads;
    const cpl = totalLeads > 0 ? spend / totalLeads : 0;
    const custoReuniao = reuniao > 0 ? spend / reuniao : 0;
    const custoFechamento = fechados > 0 ? spend / fechados : 0;
    const nome = ads[0]?.campaign_name || cid;
    const datas = Array.from(new Set(perfs.map((p) => p.data_ref)));
    const cplPorDia = datas.map((d) => { const dp = perfs.filter((p) => p.data_ref === d); const ds = dp.reduce((s, p) => s + Number(p.spend), 0); const dl = dp.reduce((s, p) => s + p.leads, 0); return { dia: d.slice(5), cpl: dl > 0 ? ds / dl : 0 }; });
    return { id: cid, nome, spend, leadsCount: totalLeads, qualificados, reuniao, fechados, cpl, custoReuniao, custoFechamento, cplPorDia, adsCount: ads.length };
  }).sort((a, b) => b.spend - a.spend);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Campanhas ({campanhaData.length})</h1>
        <TrafegoFilters periodo={filters.periodo} onPeriodoChange={filters.setPeriodo} dataInicio={filters.dataInicio} dataFim={filters.dataFim} onDataInicioChange={filters.setDataInicio} onDataFimChange={filters.setDataFim} statusFiltro={filters.statusFiltro} onStatusChange={filters.setStatusFiltro} />
      </div>
      {campanhaData.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma campanha com os filtros selecionados</CardContent></Card>
      ) : campanhaData.map((camp) => (
        <Card key={camp.id}>
          <CardHeader><CardTitle className="text-base">{camp.nome} <span className="text-xs text-muted-foreground font-normal ml-2">({camp.adsCount} anúncios)</span></CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[{ l: "Leads", v: String(camp.leadsCount) }, { l: "CPL", v: camp.cpl > 0 ? formatCurrency(camp.cpl) : "—" }, { l: "Reuniões", v: String(camp.reuniao) }, { l: "C/Reunião", v: camp.custoReuniao > 0 ? formatCurrency(camp.custoReuniao) : "—" }, { l: "Fechados", v: String(camp.fechados) }, { l: "C/Fechamento", v: camp.custoFechamento > 0 ? formatCurrency(camp.custoFechamento) : "—" }, { l: "Investido", v: formatCurrency(camp.spend) }].map((k) => (
                <div key={k.l} className="text-center p-3 bg-muted/50 rounded-lg"><p className="text-xl font-bold">{k.v}</p><p className="text-xs text-muted-foreground">{k.l}</p></div>
              ))}
            </div>
            <div className="space-y-1.5">
              {[{ label: "Leads", valor: camp.leadsCount, cor: "#6366f1" }, { label: "Qualificados", valor: camp.qualificados, cor: "#8b5cf6" }, { label: "Reunião", valor: camp.reuniao, cor: "#f59e0b" }, { label: "Fechados", valor: camp.fechados, cor: "#22c55e" }].map((etapa, i, arr) => {
                const w = camp.leadsCount > 0 ? Math.max(8, (etapa.valor / camp.leadsCount) * 100) : 8;
                const prev = i > 0 ? arr[i - 1].valor : 0;
                const pct = prev > 0 ? (etapa.valor / prev) * 100 : 0;
                return (<div key={etapa.label} className="flex items-center gap-2"><span className="text-xs w-24 text-right text-muted-foreground">{etapa.label}</span><div className="flex-1"><div className="h-6 rounded flex items-center px-2 text-white text-xs font-medium" style={{ width: `${w}%`, backgroundColor: etapa.cor }}>{etapa.valor}</div></div><span className="text-xs text-muted-foreground w-10">{i > 0 ? `${pct.toFixed(0)}%` : ""}</span></div>);
              })}
            </div>
            {camp.cplPorDia.length > 1 && (<div><p className="text-xs text-muted-foreground mb-2">Evolução do CPL</p><ResponsiveContainer width="100%" height={120}><LineChart data={camp.cplPorDia}><XAxis dataKey="dia" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ fontSize: 12 }} /><Line type="monotone" dataKey="cpl" stroke="#6366f1" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
