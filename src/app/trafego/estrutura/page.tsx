"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AdsMetadata, AdsPerformance, LeadAdsAttribution } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/format";
import { ArrowUpDown, ChevronRight, ChevronLeft } from "lucide-react";
import { TrafegoFilters, useTrafegoFilters } from "@/components/trafego-filters";

type Nivel = "campanhas" | "conjuntos" | "anuncios";

export default function TrafegoEstruturaPage() {
  const filters = useTrafegoFilters();
  const [metadata, setMetadata] = useState<AdsMetadata[]>([]);
  const [performance, setPerformance] = useState<AdsPerformance[]>([]);
  const [leads, setLeads] = useState<LeadAdsAttribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [nivel, setNivel] = useState<Nivel>("campanhas");
  const [campanhaId, setCampanhaId] = useState<string | null>(null);
  const [adsetId, setAdsetId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  const toggleSort = (col: string) => { if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("desc"); } };

  function calcStats(adIds: string[]) {
    const perfs = performance.filter((p) => adIds.includes(p.ad_id));
    const lds = leads.filter((l) => adIds.includes(l.ad_id || ""));
    const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
    const impressoes = perfs.reduce((s, p) => s + p.impressoes, 0);
    const cliques = perfs.reduce((s, p) => s + p.cliques, 0);
    const metaLeads = perfs.reduce((s, p) => s + p.leads, 0);
    const crmLeads = lds.length;
    const totalLeads = crmLeads > 0 ? crmLeads : metaLeads;
    const cpl = totalLeads > 0 ? spend / totalLeads : 0;
    const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;
    return { spend, impressoes, cliques, totalLeads, metaLeads, cpl, ctr };
  }

  // Navegar
  function drillCampanha(cid: string) { setCampanhaId(cid); setAdsetId(null); setNivel("conjuntos"); setSortCol("spend"); }
  function drillAdset(asid: string) { setAdsetId(asid); setNivel("anuncios"); setSortCol("spend"); }
  function voltar() {
    if (nivel === "anuncios") { setAdsetId(null); setNivel("conjuntos"); }
    else if (nivel === "conjuntos") { setCampanhaId(null); setNivel("campanhas"); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  // Breadcrumb
  const campanhaNome = campanhaId ? metadata.find((m) => m.campaign_id === campanhaId)?.campaign_name || campanhaId : "";
  const adsetNome = adsetId ? metadata.find((m) => m.adset_id === adsetId)?.adset_name || adsetId : "";

  // Dados por nível
  let rows: { id: string; nome: string; spend: number; impressoes: number; totalLeads: number; cpl: number; ctr: number; count: number; status?: string }[] = [];

  if (nivel === "campanhas") {
    const campMap = new Map<string, string[]>();
    metadata.forEach((m) => { if (m.campaign_id) { const arr = campMap.get(m.campaign_id) || []; arr.push(m.ad_id); campMap.set(m.campaign_id, arr); } });
    rows = Array.from(campMap, ([cid, adIds]) => {
      const stats = calcStats(adIds);
      const nome = metadata.find((m) => m.campaign_id === cid)?.campaign_name || cid;
      return { id: cid, nome, ...stats, count: adIds.length };
    }).filter((r) => r.spend > 0 || r.totalLeads > 0);
  } else if (nivel === "conjuntos") {
    const adsInCamp = metadata.filter((m) => m.campaign_id === campanhaId);
    const adsetMap = new Map<string, string[]>();
    adsInCamp.forEach((m) => { if (m.adset_id) { const arr = adsetMap.get(m.adset_id) || []; arr.push(m.ad_id); adsetMap.set(m.adset_id, arr); } });
    rows = Array.from(adsetMap, ([asid, adIds]) => {
      const stats = calcStats(adIds);
      const nome = metadata.find((m) => m.adset_id === asid)?.adset_name || asid;
      return { id: asid, nome, ...stats, count: adIds.length };
    });
  } else {
    const adsInAdset = metadata.filter((m) => m.adset_id === adsetId);
    rows = adsInAdset.map((ad) => {
      const stats = calcStats([ad.ad_id]);
      // Score
      const globalSpend = performance.reduce((s, p) => s + Number(p.spend), 0);
      const globalLeads = performance.reduce((s, p) => s + p.leads, 0);
      const globalCpl = globalLeads > 0 ? globalSpend / globalLeads : 0;
      const globalCtr = performance.length > 0 ? performance.reduce((s, p) => s + p.impressoes, 0) : 1;
      const globalClk = performance.reduce((s, p) => s + p.cliques, 0);
      const gCtr = globalCtr > 0 ? (globalClk / globalCtr) * 100 : 0;
      const cplR = globalCpl > 0 && stats.cpl > 0 ? Math.max(0, Math.min(100, (1 - (stats.cpl - globalCpl) / globalCpl) * 50 + 50)) : 50;
      const ctrR = gCtr > 0 ? Math.max(0, Math.min(100, (stats.ctr / gCtr) * 50)) : 50;
      const volR = globalLeads > 0 ? Math.min(100, (stats.totalLeads / globalLeads) * 500) : 0;
      const score = Math.round(cplR * 0.35 + ctrR * 0.25 + volR * 0.20 + 50 * 0.20);
      return { id: ad.ad_id, nome: ad.ad_name || ad.ad_id, ...stats, count: score, status: ad.status };
    });
  }

  const sorted = [...rows].sort((a, b) => {
    const va = (a as unknown as Record<string, number>)[sortCol] ?? 0;
    const vb = (b as unknown as Record<string, number>)[sortCol] ?? 0;
    return sortDir === "asc" ? va - vb : vb - va;
  });

  const nivelLabel = nivel === "campanhas" ? "Campanhas" : nivel === "conjuntos" ? "Conjuntos" : "Anúncios";
  const columns = nivel === "anuncios"
    ? [{ key: "nome", label: "Anúncio" }, { key: "spend", label: "Investido" }, { key: "totalLeads", label: "Leads" }, { key: "cpl", label: "CPL" }, { key: "impressoes", label: "Impressões" }, { key: "ctr", label: "CTR" }, { key: "count", label: "Score" }]
    : [{ key: "nome", label: nivelLabel.slice(0, -1) }, { key: "spend", label: "Investido" }, { key: "totalLeads", label: "Leads" }, { key: "cpl", label: "CPL" }, { key: "impressoes", label: "Impressões" }, { key: "ctr", label: "CTR" }, { key: "count", label: nivel === "campanhas" ? "Anúncios" : "Anúncios" }];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {nivel !== "campanhas" && (
            <button onClick={voltar} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft size={16} />Voltar
            </button>
          )}
          <h1 className="text-2xl font-bold">Estrutura</h1>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <button onClick={() => { setNivel("campanhas"); setCampanhaId(null); setAdsetId(null); }} className={`hover:text-foreground ${nivel === "campanhas" ? "text-foreground font-medium" : ""}`}>Campanhas</button>
          {campanhaId && (
            <>
              <ChevronRight size={12} />
              <button onClick={() => { setNivel("conjuntos"); setAdsetId(null); }} className={`hover:text-foreground max-w-[200px] truncate ${nivel === "conjuntos" ? "text-foreground font-medium" : ""}`}>{campanhaNome}</button>
            </>
          )}
          {adsetId && (
            <>
              <ChevronRight size={12} />
              <span className="text-foreground font-medium max-w-[200px] truncate">{adsetNome}</span>
            </>
          )}
        </div>

        <TrafegoFilters periodo={filters.periodo} onPeriodoChange={filters.setPeriodo} dataInicio={filters.dataInicio} dataFim={filters.dataFim} onDataInicioChange={filters.setDataInicio} onDataFimChange={filters.setDataFim} statusFiltro={filters.statusFiltro} onStatusChange={filters.setStatusFiltro} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  {columns.map((col) => (
                    <th key={col.key} onClick={() => toggleSort(col.key)} className="px-3 py-2 font-medium text-left cursor-pointer hover:text-foreground whitespace-nowrap text-xs">
                      {col.label} {sortCol === col.key && <ArrowUpDown size={10} className="inline" />}
                    </th>
                  ))}
                  {nivel === "anuncios" && <th className="px-3 py-2 font-medium text-xs">Status</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b hover:bg-muted/30 ${nivel !== "anuncios" ? "cursor-pointer" : ""}`}
                    onClick={() => { if (nivel === "campanhas") drillCampanha(row.id); else if (nivel === "conjuntos") drillAdset(row.id); }}
                  >
                    <td className="px-3 py-2 font-medium text-xs max-w-[250px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{row.nome}</span>
                        {nivel !== "anuncios" && <ChevronRight size={12} className="text-muted-foreground shrink-0" />}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">{formatCurrency(row.spend)}</td>
                    <td className="px-3 py-2 text-xs font-bold">{row.totalLeads}</td>
                    <td className="px-3 py-2 text-xs">{row.totalLeads > 0 ? formatCurrency(row.cpl) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{row.impressoes.toLocaleString("pt-BR")}</td>
                    <td className={`px-3 py-2 text-xs font-medium ${row.ctr >= 1.5 ? "text-green-400" : row.ctr >= 0.8 ? "" : row.ctr > 0 ? "text-red-400" : "text-muted-foreground"}`}>{formatPercent(row.ctr)}</td>
                    <td className="px-3 py-2 text-xs">
                      {nivel === "anuncios" ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${row.count >= 70 ? "bg-green-500" : row.count >= 40 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${row.count}%` }} />
                          </div>
                          <span className={`text-[10px] font-bold ${row.count >= 70 ? "text-green-400" : row.count >= 40 ? "text-yellow-400" : "text-red-400"}`}>{row.count}</span>
                        </div>
                      ) : row.count}
                    </td>
                    {nivel === "anuncios" && (
                      <td className="px-3 py-2">
                        <Badge className={`text-[10px] ${row.status === "ACTIVE" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                          {row.status === "ACTIVE" ? "Ativo" : (row.status || "").replace(/_/g, " ")}
                        </Badge>
                      </td>
                    )}
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr><td colSpan={nivel === "anuncios" ? 8 : 7} className="text-center text-muted-foreground py-8">Nenhum dado com os filtros selecionados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
