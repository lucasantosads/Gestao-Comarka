"use client";

import { useEffect, useState, useMemo } from "react";
import type { AdsMetadata } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/format";
import { ArrowUpDown, Plus, Image as ImageIcon, ExternalLink, TrendingUp, TrendingDown, Eye, MousePointerClick, DollarSign, Users } from "lucide-react";
import { TrafegoFilters, useTrafegoFilters } from "@/components/trafego-filters";
import { truncateAdName } from "@/lib/trafego-ui";
import { cn } from "@/lib/utils";
import { useTrafegoData } from "@/hooks/use-trafego-data";

export default function TrafegoAnunciosPage() {
  const filters = useTrafegoFilters();
  const { data: tData, isLoading: loading } = useTrafegoData(filters.dataInicio, filters.dataFim, filters.statusFiltro);

  const metadata = tData?.metadata || [];
  const performance = tData?.performance || [];
  const leads = tData?.leads || [];

  const [sortCol, setSortCol] = useState("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Real-time creatives from Meta API (for thumbnail/copy)
  const [creatives, setCreatives] = useState<Record<string, { thumbnail_url?: string; image_url?: string; body?: string; title?: string; link_url?: string; call_to_action_type?: string }>>({});

  useEffect(() => {
    async function loadCreatives() {
      const creativesMap: typeof creatives = {};
      try {
        const apiRes = await fetch("/api/meta-creatives");
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          for (const c of (apiData.data || [])) {
            creativesMap[c.id] = {
              thumbnail_url: c.thumbnail_url,
              image_url: c.image_url,
              body: c.body,
              title: c.title,
              link_url: c.link_url,
              call_to_action_type: c.call_to_action_type,
            };
          }
        }
      } catch { /* ignore — page still works without creatives */ }
      setCreatives(creativesMap);
    }
    loadCreatives();
  }, []);

  // Campanhas list derived from metadata
  const campanhasLista = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of metadata) {
      if (a.campaign_id && !map.has(a.campaign_id)) map.set(a.campaign_id, a.campaign_name || a.campaign_id);
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [metadata]);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando anúncios...</p></div>;

  // Client-side campaign filter (hook fetches all metadata, we filter here)
  const filteredMetadata = filters.campanhaFiltro !== "all"
    ? metadata.filter((m) => m.campaign_id === filters.campanhaFiltro)
    : metadata;

  const adIds = new Set(filteredMetadata.map((m) => m.ad_id));
  const filteredPerf = performance.filter((p) => adIds.has(p.ad_id));

  const globalSpend = filteredPerf.reduce((s, p) => s + Number(p.spend), 0);
  const globalMetaLeads = filteredPerf.reduce((s, p) => s + p.leads, 0);
  const globalCpl = globalMetaLeads > 0 ? globalSpend / globalMetaLeads : 0;
  const globalImpressions = filteredPerf.reduce((s, p) => s + p.impressoes, 0);
  const globalClicks = filteredPerf.reduce((s, p) => s + p.cliques, 0);
  const globalCtr = globalImpressions > 0 ? (globalClicks / globalImpressions) * 100 : 0;

  const adRows = filteredMetadata.map((ad) => {
    const perfs = filteredPerf.filter((p) => p.ad_id === ad.ad_id);
    const lds = leads.filter((l) => l.ad_id === ad.ad_id);
    const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
    const impressoes = perfs.reduce((s, p) => s + p.impressoes, 0);
    const cliques = perfs.reduce((s, p) => s + p.cliques, 0);
    const crmLeads = lds.length;
    const metaLeads = perfs.reduce((s, p) => s + p.leads, 0);
    const totalLeads = metaLeads;
    const fechados = lds.filter((l) => l.estagio_crm === "fechado" || l.estagio_crm === "comprou").length;
    const qualificados = lds.filter((l) => !["novo", "oportunidade"].includes(l.estagio_crm)).length;
    const reunioes = lds.filter((l) => ["reuniao_agendada", "proposta_enviada", "assinatura_contrato", "comprou"].includes(l.estagio_crm)).length;
    const taxaQualif = crmLeads > 0 ? (qualificados / crmLeads) * 100 : 0;
    const cpl = totalLeads > 0 ? spend / totalLeads : 0;
    const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;

    const cplRatio = globalCpl > 0 && cpl > 0 ? Math.max(0, Math.min(100, (1 - (cpl - globalCpl) / globalCpl) * 50 + 50)) : 50;
    const ctrRatio = globalCtr > 0 ? Math.max(0, Math.min(100, (ctr / globalCtr) * 50)) : 50;
    const volumeRatio = globalMetaLeads > 0 ? Math.min(100, (totalLeads / globalMetaLeads) * 500) : 0;
    const qualRatio = crmLeads > 0 ? Math.min(100, taxaQualif) : 50;
    const score = Math.round(cplRatio * 0.35 + ctrRatio * 0.25 + volumeRatio * 0.20 + qualRatio * 0.20);

    const creative = creatives[ad.ad_id];

    return { ...ad, spend, impressoes, cliques, crmLeads, metaLeads, totalLeads, fechados, qualificados, reunioes, taxaQualif, cpl, ctr, score, creative };
  }).filter((ad) => !filters.somenteComDados || ad.spend > 0 || ad.impressoes > 0);

  const toggleSort = (col: string) => { if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("desc"); } };
  const sorted = [...adRows].sort((a, b) => { const va = (a as unknown as Record<string, number>)[sortCol] ?? 0; const vb = (b as unknown as Record<string, number>)[sortCol] ?? 0; return sortDir === "asc" ? va - vb : vb - va; });

  const scoreColor = (s: number) => s >= 70 ? "text-emerald-500 dark:text-emerald-400" : s >= 40 ? "text-amber-500 dark:text-amber-400" : "text-red-500 dark:text-red-400";
  const scoreBg = (s: number) => s >= 70 ? "bg-emerald-500/10" : s >= 40 ? "bg-amber-500/10" : "bg-red-500/10";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Anúncios <span className="text-lg font-normal text-muted-foreground">({metadata.length})</span></h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("cards")}
              className={cn("px-3 py-1.5 text-xs rounded-lg transition-all", viewMode === "cards" ? "gradient-primary text-white" : "border border-border dark:border-white/[0.08] text-muted-foreground hover:text-foreground")}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn("px-3 py-1.5 text-xs rounded-lg transition-all", viewMode === "table" ? "gradient-primary text-white" : "border border-border dark:border-white/[0.08] text-muted-foreground hover:text-foreground")}
            >
              Tabela
            </button>
          </div>
        </div>
        <TrafegoFilters periodo={filters.periodo} onPeriodoChange={filters.setPeriodo} dataInicio={filters.dataInicio} dataFim={filters.dataFim} onDataInicioChange={filters.setDataInicio} onDataFimChange={filters.setDataFim} statusFiltro={filters.statusFiltro} onStatusChange={filters.setStatusFiltro} campanhas={campanhasLista} campanhaFiltro={filters.campanhaFiltro} onCampanhaChange={filters.setCampanhaFiltro} somenteComDados={filters.somenteComDados} onSomenteComDadosChange={filters.setSomenteComDados} />
      </div>

      {/* Cards View */}
      {viewMode === "cards" && (
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((ad) => {
            const c = ad.creative;
            const thumb = c?.image_url || c?.thumbnail_url;
            return (
              <Card key={ad.ad_id} className="overflow-hidden group/card">
                {/* Gradient accent top */}
                <div className="h-[2px] w-full gradient-primary opacity-30 group-hover/card:opacity-70 transition-opacity duration-300" />

                <CardContent className="p-0">
                  <div className="flex gap-0">
                    {/* Thumbnail / Image */}
                    <div className="w-[120px] min-h-[140px] shrink-0 bg-muted/30 dark:bg-white/[0.03] flex items-center justify-center overflow-hidden border-r border-border dark:border-white/[0.06]">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={ad.ad_name || ""}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <ImageIcon size={24} className="text-muted-foreground/30" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4 min-w-0">
                      {/* Header: Name + Score */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" title={ad.ad_name || ad.ad_id}>
                            {truncateAdName(ad.ad_name || ad.ad_id)}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={ad.campaign_name || ""}>
                            {ad.campaign_name || ""}
                          </p>
                        </div>
                        <Badge className={cn("text-[10px] shrink-0 font-bold", scoreBg(ad.score), scoreColor(ad.score))}>
                          {ad.score}
                        </Badge>
                      </div>

                      {/* Copy / Body text */}
                      {c?.body && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2.5 leading-relaxed" title={c.body}>
                          {c.body}
                        </p>
                      )}

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <DollarSign size={10} className="text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground">Invest.</span>
                          <span className="text-[11px] font-semibold ml-auto">{formatCurrency(ad.spend)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users size={10} className="text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground">Leads</span>
                          <span className="text-[11px] font-bold ml-auto">{ad.totalLeads}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <TrendingDown size={10} className="text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground">CPL</span>
                          <span className={cn("text-[11px] font-medium ml-auto", ad.cpl > 0 && ad.cpl < globalCpl ? "text-emerald-500 dark:text-emerald-400" : ad.cpl > globalCpl * 1.3 ? "text-red-500 dark:text-red-400" : "")}>
                            {ad.totalLeads > 0 ? formatCurrency(ad.cpl) : "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MousePointerClick size={10} className="text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground">CTR</span>
                          <span className={cn("text-[11px] font-medium ml-auto", ad.ctr >= 1.5 ? "text-emerald-500 dark:text-emerald-400" : ad.ctr > 0 && ad.ctr < 0.8 ? "text-red-500 dark:text-red-400" : "")}>
                            {formatPercent(ad.ctr)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Eye size={10} className="text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground">Impr.</span>
                          <span className="text-[11px] ml-auto">{ad.impressoes.toLocaleString("pt-BR")}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <TrendingUp size={10} className="text-muted-foreground/50" />
                          <span className="text-[11px] text-muted-foreground">Qualif.</span>
                          <span className={cn("text-[11px] font-medium ml-auto", ad.taxaQualif >= 40 ? "text-emerald-500 dark:text-emerald-400" : ad.taxaQualif >= 20 ? "text-amber-500 dark:text-amber-400" : ad.crmLeads > 0 ? "text-red-500 dark:text-red-400" : "text-muted-foreground")}>
                            {ad.crmLeads > 0 ? formatPercent(ad.taxaQualif) : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Footer: Status + CTA */}
                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border dark:border-white/[0.06]">
                        <Badge className={cn("text-[9px]", ad.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                          {ad.status === "ACTIVE" ? "Ativo" : (ad.status || "").replace(/_/g, " ")}
                        </Badge>
                        {c?.call_to_action_type && (
                          <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">
                            {c.call_to_action_type.replace(/_/g, " ")}
                          </span>
                        )}
                        {c?.link_url && (
                          <a href={c.link_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors" title="Abrir link">
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Table View (original, condensed) */}
      {viewMode === "table" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border dark:border-white/[0.06] text-muted-foreground">
                  {[
                    { key: "ad_name", label: "Anúncio" },
                    { key: "score", label: "Score" },
                    { key: "spend", label: "Investido" },
                    { key: "totalLeads", label: "Leads" },
                    { key: "cpl", label: "CPL" },
                    { key: "impressoes", label: "Impressões" },
                    { key: "ctr", label: "CTR" },
                    { key: "taxaQualif", label: "Qualif.%" },
                  ].map((col) => (
                    <th key={col.key} onClick={() => toggleSort(col.key)} className="px-3 py-2.5 font-medium text-left cursor-pointer hover:text-foreground whitespace-nowrap text-xs">{col.label} {sortCol === col.key && <ArrowUpDown size={10} className="inline" />}</th>
                  ))}
                  <th className="px-3 py-2.5 font-medium text-xs">Status</th>
                </tr></thead>
                <tbody>
                  {sorted.map((ad) => (
                    <tr key={ad.ad_id} className="border-b border-border dark:border-white/[0.06] hover:bg-muted/30 dark:hover:bg-white/[0.02]">
                      <td className="px-3 py-2 max-w-[220px]">
                        <div className="flex items-center gap-2.5">
                          {ad.creative?.thumbnail_url || ad.creative?.image_url ? (
                            <img src={ad.creative.image_url || ad.creative.thumbnail_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-muted/50 dark:bg-white/[0.04] flex items-center justify-center shrink-0"><ImageIcon size={12} className="text-muted-foreground/30" /></div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium" title={ad.ad_name || ad.ad_id}>{truncateAdName(ad.ad_name || ad.ad_id)}</div>
                            <div className="text-[10px] text-muted-foreground truncate" title={ad.campaign_name || undefined}>{ad.campaign_name || ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2"><Badge className={cn("text-[10px]", scoreBg(ad.score), scoreColor(ad.score))}>{ad.score}</Badge></td>
                      <td className="px-3 py-2 text-xs font-medium">{formatCurrency(ad.spend)}</td>
                      <td className="px-3 py-2 text-xs font-bold">{ad.totalLeads}<span className="text-[10px] text-muted-foreground ml-1">{ad.crmLeads > 0 ? `(${ad.crmLeads} CRM)` : ""}</span></td>
                      <td className="px-3 py-2 text-xs">{ad.totalLeads > 0 ? formatCurrency(ad.cpl) : "—"}</td>
                      <td className="px-3 py-2 text-xs">{ad.impressoes.toLocaleString("pt-BR")}</td>
                      <td className={cn("px-3 py-2 text-xs font-medium", ad.ctr >= 1.5 ? "text-emerald-500 dark:text-emerald-400" : ad.ctr >= 0.8 ? "" : ad.ctr > 0 ? "text-red-500 dark:text-red-400" : "text-muted-foreground")}>{formatPercent(ad.ctr)}</td>
                      <td className={cn("px-3 py-2 text-xs font-medium", ad.taxaQualif >= 40 ? "text-emerald-500 dark:text-emerald-400" : ad.taxaQualif >= 20 ? "text-amber-500 dark:text-amber-400" : ad.crmLeads > 0 ? "text-red-500 dark:text-red-400" : "text-muted-foreground")}>{ad.crmLeads > 0 ? formatPercent(ad.taxaQualif) : "—"}</td>
                      <td className="px-3 py-2"><Badge className={cn("text-[10px]", ad.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>{ad.status === "ACTIVE" ? "Ativo" : (ad.status || "").replace(/_/g, " ")}</Badge></td>
                    </tr>
                  ))}
                  {sorted.length === 0 && <tr><td colSpan={9} className="text-center text-muted-foreground py-8">Nenhum anúncio encontrado</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {sorted.length === 0 && viewMode === "cards" && (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Nenhum anúncio encontrado para o período selecionado.</p>
        </div>
      )}
    </div>
  );
}
