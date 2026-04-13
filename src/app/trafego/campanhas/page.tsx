"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import type { AdsMetadata, AdsPerformance, LeadAdsAttribution } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { TrafegoFilters, useTrafegoFilters } from "@/components/trafego-filters";
import { ChevronDown, ChevronRight, Trophy } from "lucide-react";

import { useTrafegoData } from "@/hooks/use-trafego-data";

export default function TrafegoCampanhasPage() {
  const filters = useTrafegoFilters();
  const { data, isLoading: loading } = useTrafegoData(filters.dataInicio, filters.dataFim, filters.statusFiltro);
  const [expanded, setExpanded] = useState<string | null>(null);

  const metadata = data?.metadata || [];
  const performance = data?.performance || [];
  const leads = data?.leads || [];


  const { campanhaData, topPerformer } = useMemo(() => {
    const campanhasMap = new Map<string, typeof metadata>();
    metadata.forEach((m) => {
      if (m.campaign_id) {
        const arr = campanhasMap.get(m.campaign_id) || [];
        arr.push(m);
        campanhasMap.set(m.campaign_id, arr);
      }
    });

    const cData = Array.from(campanhasMap, ([cid, ads]) => {
      const adIds = ads.map((a) => a.ad_id);
      const perfs = performance.filter((p) => adIds.includes(p.ad_id));
      const lds = leads.filter((l) => l.campaign_id === cid);
      const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
      const qualificados = lds.filter((l) => !["novo", "oportunidade"].includes(l.estagio_crm)).length;
      const reuniao = lds.filter((l) => ["reuniao_agendada", "proposta_enviada", "assinatura_contrato", "comprou"].includes(l.estagio_crm)).length;
      const fechados = lds.filter((l) => l.estagio_crm === "fechado" || l.estagio_crm === "comprou").length;
      const totalLeads = perfs.reduce((s, p) => s + p.leads, 0);
      const crmLeads = lds.length;
      const taxaQualif = crmLeads > 0 ? (qualificados / crmLeads) * 100 : 0;
      const cpl = totalLeads > 0 ? spend / totalLeads : 0;
      const custoReuniao = reuniao > 0 ? spend / reuniao : 0;
      const custoFechamento = fechados > 0 ? spend / fechados : 0;
      const nome = ads[0]?.campaign_name || cid;
      const status = ads[0]?.status || "";
      const datas = Array.from(new Set(perfs.map((p) => p.data_ref)));
      const cplPorDia = datas.map((d) => { const dp = perfs.filter((p) => p.data_ref === d); const ds = dp.reduce((s, p) => s + Number(p.spend), 0); const dl = dp.reduce((s, p) => s + p.leads, 0); return { dia: d.slice(5), cpl: dl > 0 ? ds / dl : 0 }; });
      return { id: cid, nome, status, spend, leadsCount: totalLeads, qualificados, reuniao, fechados, taxaQualif, cpl, custoReuniao, custoFechamento, cplPorDia, adsCount: ads.length };
    }).filter((c) => !filters.somenteComDados || c.spend > 0).sort((a, b) => b.spend - a.spend);

    let tPerf: typeof cData[0] | null = null;
    for (const c of cData) {
      if (c.leadsCount < 1 || c.cpl <= 0) continue;
      if (!tPerf || c.cpl < tPerf.cpl) tPerf = c;
    }

    return { campanhaData: cData, topPerformer: tPerf };
  }, [metadata, performance, leads, filters.somenteComDados]);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Campanhas ({campanhaData.length})</h1>
        <TrafegoFilters periodo={filters.periodo} onPeriodoChange={filters.setPeriodo} dataInicio={filters.dataInicio} dataFim={filters.dataFim} onDataInicioChange={filters.setDataInicio} onDataFimChange={filters.setDataFim} statusFiltro={filters.statusFiltro} onStatusChange={filters.setStatusFiltro} somenteComDados={filters.somenteComDados} onSomenteComDadosChange={filters.setSomenteComDados} />
      </div>

      {/* Top performer destacado */}
      {topPerformer && (
        <Card className="border-blue-500/40 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
          <CardContent className="py-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-yellow-500/15 flex items-center justify-center shrink-0">
              <Trophy size={18} className="text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Melhor CPL do período</p>
              <p className="text-sm font-semibold truncate" title={topPerformer.nome}>{topPerformer.nome}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">CPL</p>
                <p className="text-lg font-bold text-blue-400">{formatCurrency(topPerformer.cpl)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Leads</p>
                <p className="text-lg font-bold">{topPerformer.leadsCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {campanhaData.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma campanha com os filtros selecionados</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium text-xs w-6"></th>
                    <th className="px-3 py-2 text-left font-medium text-xs">Campanha</th>
                    <th className="px-3 py-2 text-right font-medium text-xs">Leads</th>
                    <th className="px-3 py-2 text-right font-medium text-xs">CPL</th>
                    <th className="px-3 py-2 text-right font-medium text-xs">Investido</th>
                    <th className="px-3 py-2 text-right font-medium text-xs">Qualif.%</th>
                    <th className="px-3 py-2 text-right font-medium text-xs">Reuniões</th>
                    <th className="px-3 py-2 text-right font-medium text-xs">Fechados</th>
                    <th className="px-3 py-2 text-center font-medium text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {campanhaData.map((camp) => {
                    const isOpen = expanded === camp.id;
                    return (
                      <Fragment key={camp.id}>
                        <tr
                          className="border-b hover:bg-muted/30 cursor-pointer"
                          onClick={() => setExpanded(isOpen ? null : camp.id)}
                        >
                          <td className="px-3 py-2 text-muted-foreground">
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td className="px-3 py-2 text-xs font-medium max-w-[260px] truncate" title={camp.nome}>
                            {camp.nome}
                            <span className="ml-2 text-[10px] text-muted-foreground font-normal">({camp.adsCount} ads)</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-right font-bold">{camp.leadsCount}</td>
                          <td className="px-3 py-2 text-xs text-right">{camp.cpl > 0 ? formatCurrency(camp.cpl) : "—"}</td>
                          <td className="px-3 py-2 text-xs text-right font-medium">{formatCurrency(camp.spend)}</td>
                          <td className={`px-3 py-2 text-xs text-right font-medium ${camp.taxaQualif >= 40 ? "text-green-400" : camp.taxaQualif >= 20 ? "text-yellow-400" : camp.qualificados > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                            {camp.qualificados > 0 ? camp.taxaQualif.toFixed(0) + "%" : "—"}
                          </td>
                          <td className="px-3 py-2 text-xs text-right">{camp.reuniao || <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-3 py-2 text-xs text-right">{camp.fechados || <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-3 py-2 text-center">
                            <Badge className={`text-[10px] ${camp.status === "ACTIVE" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                              {camp.status === "ACTIVE" ? "Ativo" : (camp.status || "—").replace(/_/g, " ")}
                            </Badge>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b">
                            <td colSpan={9} className="p-4 bg-muted/20">
                              <div className="space-y-4">
                                {/* Funil em barras com escala relativa ao total de leads */}
                                <div className="space-y-1.5">
                                  <p className="text-xs text-muted-foreground mb-1">Funil</p>
                                  {[
                                    { label: "Leads", valor: camp.leadsCount, cor: "#6366f1" },
                                    { label: "Qualificados", valor: camp.qualificados, cor: "#8b5cf6" },
                                    { label: "Reunião", valor: camp.reuniao, cor: "#f59e0b" },
                                    { label: "Fechados", valor: camp.fechados, cor: "#22c55e" },
                                  ].map((etapa) => {
                                    const pct = camp.leadsCount > 0 ? (etapa.valor / camp.leadsCount) * 100 : 0;
                                    return (
                                      <div key={etapa.label} className="flex items-center gap-2">
                                        <span className="text-xs w-24 text-right text-muted-foreground">{etapa.label}</span>
                                        <div className="flex-1 h-6 bg-muted/40 rounded overflow-hidden">
                                          <div
                                            className="h-full rounded flex items-center px-2 text-white text-xs font-medium transition-all"
                                            style={{ width: `${Math.max(pct, etapa.valor > 0 ? 4 : 0)}%`, backgroundColor: etapa.cor }}
                                          >
                                            {etapa.valor > 0 && etapa.valor}
                                          </div>
                                        </div>
                                        <span className="text-[11px] text-muted-foreground w-12 text-right">{pct.toFixed(0)}%</span>
                                      </div>
                                    );
                                  })}
                                </div>
                                {/* Métricas extras */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                  <div className="bg-muted/30 rounded p-2">
                                    <p className="text-muted-foreground text-[10px]">C/Reunião</p>
                                    <p className="font-semibold">{camp.custoReuniao > 0 ? formatCurrency(camp.custoReuniao) : "—"}</p>
                                  </div>
                                  <div className="bg-muted/30 rounded p-2">
                                    <p className="text-muted-foreground text-[10px]">C/Fechamento</p>
                                    <p className="font-semibold">{camp.custoFechamento > 0 ? formatCurrency(camp.custoFechamento) : "—"}</p>
                                  </div>
                                </div>
                                {/* Evolução do CPL */}
                                {camp.cplPorDia.length > 1 && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-2">Evolução do CPL</p>
                                    <ResponsiveContainer width="100%" height={140}>
                                      <LineChart data={camp.cplPorDia}>
                                        <XAxis dataKey="dia" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                        <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ fontSize: 12 }} />
                                        <Line type="monotone" dataKey="cpl" stroke="#6366f1" strokeWidth={2} dot={false} />
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
