"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AdsMetadata, AdsPerformance, LeadAdsAttribution } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/format";
import { ArrowUpDown } from "lucide-react";
import { TrafegoFilters, useTrafegoFilters } from "@/components/trafego-filters";

export default function TrafegoAnunciosPage() {
  const filters = useTrafegoFilters();
  const [metadata, setMetadata] = useState<AdsMetadata[]>([]);
  const [performance, setPerformance] = useState<AdsPerformance[]>([]);
  const [leads, setLeads] = useState<LeadAdsAttribution[]>([]);
  const [campanhasLista, setCampanhasLista] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => { loadData(); }, [filters.dataInicio, filters.dataFim, filters.statusFiltro, filters.campanhaFiltro]);

  async function loadData() {
    setLoading(true);
    let metaQuery = supabase.from("ads_metadata").select("*");
    if (filters.statusFiltro !== "all") metaQuery = metaQuery.eq("status", filters.statusFiltro);
    if (filters.campanhaFiltro !== "all") metaQuery = metaQuery.eq("campaign_id", filters.campanhaFiltro);

    const [{ data: m }, { data: p }, { data: l }, { data: allMeta }] = await Promise.all([
      metaQuery,
      supabase.from("ads_performance").select("*").gte("data_ref", filters.dataInicio).lte("data_ref", filters.dataFim),
      supabase.from("leads_ads_attribution").select("*").gte("created_at", filters.dataInicio + "T00:00:00").lte("created_at", filters.dataFim + "T23:59:59"),
      supabase.from("ads_metadata").select("campaign_id,campaign_name"),
    ]);

    setMetadata((m || []) as AdsMetadata[]);
    setPerformance((p || []) as AdsPerformance[]);
    setLeads((l || []) as LeadAdsAttribution[]);
    const campanhasMap = new Map<string, string>();
    for (const a of (allMeta || []) as AdsMetadata[]) {
      if (a.campaign_id && !campanhasMap.has(a.campaign_id)) campanhasMap.set(a.campaign_id, a.campaign_name || a.campaign_id);
    }
    setCampanhasLista(Array.from(campanhasMap, ([id, name]) => ({ id, name })));
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  const adIds = new Set(metadata.map((m) => m.ad_id));
  const filteredPerf = performance.filter((p) => adIds.has(p.ad_id));

  // Calcular métricas globais para scoring relativo
  const globalSpend = filteredPerf.reduce((s, p) => s + Number(p.spend), 0);
  const globalMetaLeads = filteredPerf.reduce((s, p) => s + p.leads, 0);
  const globalCpl = globalMetaLeads > 0 ? globalSpend / globalMetaLeads : 0;
  const globalImpressions = filteredPerf.reduce((s, p) => s + p.impressoes, 0);
  const globalClicks = filteredPerf.reduce((s, p) => s + p.cliques, 0);
  const globalCtr = globalImpressions > 0 ? (globalClicks / globalImpressions) * 100 : 0;

  const adRows = metadata.map((ad) => {
    const perfs = filteredPerf.filter((p) => p.ad_id === ad.ad_id);
    const lds = leads.filter((l) => l.ad_id === ad.ad_id);
    const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
    const impressoes = perfs.reduce((s, p) => s + p.impressoes, 0);
    const cliques = perfs.reduce((s, p) => s + p.cliques, 0);
    const crmLeads = lds.length;
    const metaLeads = perfs.reduce((s, p) => s + p.leads, 0);
    const totalLeads = crmLeads > 0 ? crmLeads : metaLeads;
    const fechados = lds.filter((l) => l.estagio_crm === "fechado" || l.estagio_crm === "comprou").length;
    const qualificados = lds.filter((l) => !["novo", "oportunidade"].includes(l.estagio_crm)).length;
    const reunioes = lds.filter((l) => ["reuniao_agendada", "proposta_enviada", "assinatura_contrato", "comprou"].includes(l.estagio_crm)).length;
    const taxaQualif = crmLeads > 0 ? (qualificados / crmLeads) * 100 : 0;
    const cpl = totalLeads > 0 ? spend / totalLeads : 0;
    const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;
    const custoReuniao = reunioes > 0 ? spend / reunioes : 0;
    const custoFechamento = fechados > 0 ? spend / fechados : 0;

    // Score dinâmico (0-100)
    // CPL (35%): quanto menor que a média, melhor
    const cplRatio = globalCpl > 0 && cpl > 0 ? Math.max(0, Math.min(100, (1 - (cpl - globalCpl) / globalCpl) * 50 + 50)) : 50;
    // CTR (25%): quanto maior que a média, melhor
    const ctrRatio = globalCtr > 0 ? Math.max(0, Math.min(100, (ctr / globalCtr) * 50)) : 50;
    // Volume (20%): proporção do total de leads
    const volumeRatio = globalMetaLeads > 0 ? Math.min(100, (totalLeads / globalMetaLeads) * 500) : 0;
    // Qualificação CRM (20%): taxa de qualificação
    const qualRatio = crmLeads > 0 ? Math.min(100, taxaQualif) : 50;
    const score = Math.round(cplRatio * 0.35 + ctrRatio * 0.25 + volumeRatio * 0.20 + qualRatio * 0.20);

    return { ...ad, spend, impressoes, cliques, crmLeads, metaLeads, totalLeads, fechados, qualificados, reunioes, taxaQualif, cpl, ctr, custoReuniao, custoFechamento, score };
  });

  const toggleSort = (col: string) => { if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("desc"); } };
  const sorted = [...adRows].sort((a, b) => { const va = (a as unknown as Record<string, number>)[sortCol] ?? 0; const vb = (b as unknown as Record<string, number>)[sortCol] ?? 0; return sortDir === "asc" ? va - vb : vb - va; });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Anúncios ({metadata.length})</h1>
        <TrafegoFilters periodo={filters.periodo} onPeriodoChange={filters.setPeriodo} dataInicio={filters.dataInicio} dataFim={filters.dataFim} onDataInicioChange={filters.setDataInicio} onDataFimChange={filters.setDataFim} statusFiltro={filters.statusFiltro} onStatusChange={filters.setStatusFiltro} campanhas={campanhasLista} campanhaFiltro={filters.campanhaFiltro} onCampanhaChange={filters.setCampanhaFiltro} />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground">
                {[
                  { key: "ad_name", label: "Anúncio" },
                  { key: "spend", label: "Investido" },
                  { key: "totalLeads", label: "Leads" },
                  { key: "cpl", label: "CPL" },
                  { key: "impressoes", label: "Impressões" },
                  { key: "ctr", label: "CTR" },
                  { key: "taxaQualif", label: "Qualif.%" },
                  { key: "custoReuniao", label: "C/Reunião" },
                  { key: "custoFechamento", label: "C/Fech." },
                  { key: "score", label: "Score" },
                ].map((col) => (
                  <th key={col.key} onClick={() => toggleSort(col.key)} className="px-3 py-2 font-medium text-left cursor-pointer hover:text-foreground whitespace-nowrap text-xs">{col.label} {sortCol === col.key && <ArrowUpDown size={10} className="inline" />}</th>
                ))}
                <th className="px-3 py-2 font-medium text-xs">Status</th>
              </tr></thead>
              <tbody>
                {sorted.map((ad) => (
                  <tr key={ad.ad_id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium max-w-[220px] text-xs"><div className="truncate">{ad.ad_name || ad.ad_id}</div><div className="text-[10px] text-muted-foreground truncate">{ad.campaign_name || ""}</div></td>
                    <td className="px-3 py-2 text-xs font-medium">{formatCurrency(ad.spend)}</td>
                    <td className="px-3 py-2 text-xs font-bold">{ad.totalLeads}<span className="text-[10px] text-muted-foreground ml-1">{ad.crmLeads > 0 ? `(${ad.crmLeads} CRM)` : ""}</span></td>
                    <td className="px-3 py-2 text-xs">{ad.totalLeads > 0 ? formatCurrency(ad.cpl) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{ad.impressoes.toLocaleString("pt-BR")}</td>
                    <td className={`px-3 py-2 text-xs font-medium ${ad.ctr >= 1.5 ? "text-green-400" : ad.ctr >= 0.8 ? "text-foreground" : ad.ctr > 0 ? "text-red-400" : "text-muted-foreground"}`}>{formatPercent(ad.ctr)}</td>
                    <td className={`px-3 py-2 text-xs font-medium ${ad.taxaQualif >= 40 ? "text-green-400" : ad.taxaQualif >= 20 ? "text-yellow-400" : ad.crmLeads > 0 ? "text-red-400" : "text-muted-foreground"}`}>{ad.crmLeads > 0 ? formatPercent(ad.taxaQualif) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{ad.custoReuniao > 0 ? formatCurrency(ad.custoReuniao) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{ad.custoFechamento > 0 ? formatCurrency(ad.custoFechamento) : "—"}</td>
                    <td className="px-3 py-2"><Badge className={`text-[10px] ${ad.score >= 70 ? "bg-green-500/20 text-green-400" : ad.score >= 40 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>{ad.score}</Badge></td>
                    <td className="px-3 py-2"><Badge className={`text-[10px] ${ad.status === "ACTIVE" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>{ad.status === "ACTIVE" ? "Ativo" : (ad.status || "").replace(/_/g, " ")}</Badge></td>
                  </tr>
                ))}
                {sorted.length === 0 && <tr><td colSpan={11} className="text-center text-muted-foreground py-8">Nenhum anúncio encontrado</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
