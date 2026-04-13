"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/format";
import { AlertTriangle, TrendingUp, TrendingDown, Zap, ArrowUpDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface CreativeScore {
  ad_id: string; ad_name: string; campaign_name: string; adset_name: string;
  total_leads: number; qualified_leads: number; disqualified_leads: number;
  meetings_scheduled: number; meetings_held: number; no_shows: number;
  contracts_closed: number; total_mrr: number; spend: number;
  qualification_rate: number; meeting_rate: number; close_rate: number;
  no_show_rate: number; cac: number; composite_score: number;
  alert_status: string; alert_message: string | null;
}

interface AudiencePerf {
  adset_id: string; adset_name: string; campaign_name: string;
  total_leads: number; qualified_leads: number; meetings: number;
  contracts: number; total_mrr: number; spend: number;
  composite_score: number; alert_status: string;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  critical: { label: "Crítico", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  warning: { label: "Atenção", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  high_performer: { label: "Top", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  ok: { label: "OK", cls: "bg-muted text-muted-foreground" },
};

function ScoreGauge({ score }: { score: number }) {
  const n = Math.round(score);
  const cfg =
    n <= 30 ? { cls: "bg-red-500/15 text-red-400 border-red-500/30", label: "Crítico" } :
    n <= 60 ? { cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", label: "Atenção" } :
    n <= 80 ? { cls: "bg-blue-500/15 text-blue-400 border-blue-500/30", label: "Bom" } :
              { cls: "bg-green-500/15 text-green-400 border-green-500/30", label: "Ótimo" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-semibold ${cfg.cls}`}>
      <span className="text-sm font-bold">{n}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 0 || Number.isNaN(diffMs)) return "—";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `há ${days}d`;
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export default function AdIntelligencePage() {
  const [creatives, setCreatives] = useState<CreativeScore[]>([]);
  const [audiences, setAudiences] = useState<AudiencePerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState<string>("composite_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<"criativos" | "audiencias" | "alertas" | "sugestoes">("criativos");
  const [enriching, setEnriching] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [attrStart, setAttrStart] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/trafego/attribution-start").then((r) => r.json()).then((d) => setAttrStart(d?.attribution_start || null)).catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, []);

  async function enrich() {
    setEnriching(true);
    try {
      const res = await fetch("/api/ad-intelligence/enrich", { method: "POST" });
      const data = await res.json();
      if (data.error) { toast.error(data.error); }
      else {
        const parts = [];
        if (data.ja_com_ad_id) parts.push(`${data.ja_com_ad_id} com ad_id`);
        if (data.ad_id_encontrado) parts.push(`${data.ad_id_encontrado} novos ad_id`);
        if (data.canal_identificado) parts.push(`${data.canal_identificado} canais`);
        if (data.criativos) parts.push(`${data.criativos} criativos`);
        toast.success(`${data.total_leads} leads: ${parts.join(", ")}`);
        loadData();
      }
    } catch { toast.error("Erro ao enriquecer"); }
    setEnriching(false);
  }

  async function loadData() {
    setLoading(true);
    const [{ data: cs }, { data: ap }] = await Promise.all([
      supabase.from("creative_scores").select("*").order("composite_score", { ascending: false }),
      supabase.from("audience_performance").select("*").order("composite_score", { ascending: false }),
    ]);
    setCreatives((cs || []) as CreativeScore[]);
    setAudiences((ap || []) as AudiencePerf[]);
    setLastSync(new Date().toISOString());
    setLoading(false);
  }

  const sort = (col: string) => {
    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const sorted = [...creatives].sort((a, b) => {
    const va = (a as unknown as Record<string, number>)[sortCol] || 0;
    const vb = (b as unknown as Record<string, number>)[sortCol] || 0;
    return sortDir === "desc" ? vb - va : va - vb;
  });

  const alerts = creatives.filter((c) => c.alert_status !== "ok");
  const criticals = alerts.filter((c) => c.alert_status === "critical");
  const warnings = alerts.filter((c) => c.alert_status === "warning");
  const topPerformers = alerts.filter((c) => c.alert_status === "high_performer");

  // Sugestões de investimento
  const suggestions: { tipo: "escalar" | "pausar" | "revisar"; msg: string; impacto?: string; criativo: string }[] = [];
  topPerformers.forEach((c) => {
    suggestions.push({
      tipo: "escalar", criativo: c.ad_name || c.ad_id,
      msg: `Aumentar budget em 20-30%`,
      impacto: c.total_mrr > 0 ? `+${formatCurrency(c.total_mrr * 0.25)} MRR potencial` : undefined,
    });
  });
  criticals.forEach((c) => {
    if (c.qualification_rate < 0.20) {
      suggestions.push({ tipo: "pausar", criativo: c.ad_name || c.ad_id, msg: `Pausar — ROI negativo, qualificação ${(c.qualification_rate * 100).toFixed(0)}%` });
    } else {
      suggestions.push({ tipo: "revisar", criativo: c.ad_name || c.ad_id, msg: c.alert_message || "Revisar performance" });
    }
  });
  warnings.forEach((c) => {
    suggestions.push({ tipo: "revisar", criativo: c.ad_name || c.ad_id, msg: c.alert_message || "Revisar" });
  });

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ad Intelligence</h1>
          <p className="text-sm text-muted-foreground">Cruzamento de anúncios com resultados comerciais</p>
        </div>
        <div className="flex items-center gap-2">
          {criticals.length > 0 && <Badge className="bg-red-500/15 text-red-400">{criticals.length} crítico{criticals.length > 1 ? "s" : ""}</Badge>}
          {topPerformers.length > 0 && <Badge className="bg-green-500/15 text-green-400">{topPerformers.length} top</Badge>}
          <div className="flex flex-col items-end gap-1">
            <button onClick={enrich} disabled={enriching}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
              title="Buscar ad_id de todos os leads no GHL, identificar canais e recalcular scores">
              <RefreshCw size={12} className={enriching ? "animate-spin" : ""} />
              {enriching ? "Processando..." : "Sincronizar Leads"}
            </button>
            <p className="text-[10px] text-muted-foreground">Última sync: {formatRelativeTime(lastSync)}</p>
          </div>
        </div>
      </div>

      {attrStart && (
        <div className="text-[11px] text-muted-foreground bg-muted/30 border border-border/50 rounded-md px-3 py-2">
          Scores calculados a partir de leads criados em/após <span className="font-semibold text-foreground">{new Date(attrStart).toLocaleString("pt-BR")}</span>. Leads anteriores não tinham ad_id capturado. Rode &ldquo;Sincronizar Leads&rdquo; após qualquer mudança no GHL para atualizar.
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-muted rounded-lg p-0.5 w-fit">
        {([
          { key: "criativos", label: `Criativos (${creatives.length})` },
          { key: "audiencias", label: `Audiências (${audiences.length})` },
          { key: "alertas", label: `Alertas (${alerts.length})` },
          { key: "sugestoes", label: "Sugestões" },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${tab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
            {t.key === "sugestoes" && suggestions.length > 0 && (
              <span className="bg-orange-500/20 text-orange-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{suggestions.length}</span>
            )}
            {t.key === "sugestoes" && suggestions.length === 0 && (
              <span className="text-muted-foreground">(0)</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Criativos */}
      {tab === "criativos" && (
        <Card>
          <CardContent className="pt-4 overflow-x-auto">
            {creatives.length === 0 ? (
              <div className="text-center py-12">
                <Zap size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">Nenhum criativo com dados de funil ainda.</p>
                <p className="text-xs text-muted-foreground mt-1">Os scores são calculados conforme leads avançam no funil (qualificação → reunião → fechamento).</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    {[
                      { key: "ad_name", label: "Criativo" },
                      { key: "campaign_name", label: "Campanha" },
                      { key: "total_leads", label: "Leads" },
                      { key: "qualification_rate", label: "Qualif." },
                      { key: "meetings_held", label: "Reuniões" },
                      { key: "close_rate", label: "Fech." },
                      { key: "contracts_closed", label: "Contratos" },
                      { key: "total_mrr", label: "MRR" },
                      { key: "composite_score", label: "Score" },
                      { key: "alert_status", label: "Status" },
                    ].map((col) => (
                      <th key={col.key} className="py-2 px-2 text-left cursor-pointer hover:text-foreground" onClick={() => sort(col.key)}>
                        <span className="flex items-center gap-1">{col.label} {sortCol === col.key && <ArrowUpDown size={10} />}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => {
                    const badge = STATUS_BADGE[c.alert_status] || STATUS_BADGE.ok;
                    const isExpanded = expanded === c.ad_id;
                    return (
                      <>
                        <tr key={c.ad_id} className="border-b border-border/30 hover:bg-muted/30 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : c.ad_id)}>
                          <td className="py-2 px-2 font-medium max-w-[200px] truncate">{c.ad_name || c.ad_id}</td>
                          <td className="py-2 px-2 text-muted-foreground max-w-[150px] truncate">{c.campaign_name || "—"}</td>
                          <td className="py-2 px-2 font-mono">{c.total_leads}</td>
                          <td className="py-2 px-2 font-mono">{formatPercent(c.qualification_rate * 100)}</td>
                          <td className="py-2 px-2 font-mono">{c.meetings_held}</td>
                          <td className="py-2 px-2 font-mono">{formatPercent(c.close_rate * 100)}</td>
                          <td className="py-2 px-2 font-mono">{c.contracts_closed}</td>
                          <td className="py-2 px-2 font-mono">{c.total_mrr === 0 && c.contracts_closed === 0 ? <span className="text-muted-foreground text-[11px]">Sem dados</span> : formatCurrency(c.total_mrr)}</td>
                          <td className="py-2 px-2"><ScoreGauge score={c.composite_score} /></td>
                          <td className="py-2 px-2">
                            <Badge variant="outline" className={`text-[9px] ${badge.cls}`}>{badge.label}</Badge>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${c.ad_id}-detail`}>
                            <td colSpan={10} className="p-4 bg-muted/20">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-2">Funil</p>
                                  <FunnelBar label="Leads" value={c.total_leads} max={c.total_leads} color="bg-blue-500" />
                                  <FunnelBar label="Qualificados" value={c.qualified_leads} max={c.total_leads} color="bg-cyan-500" />
                                  <FunnelBar label="Agendadas" value={c.meetings_scheduled} max={c.total_leads} color="bg-indigo-500" />
                                  <FunnelBar label="Realizadas" value={c.meetings_held} max={c.total_leads} color="bg-purple-500" />
                                  <FunnelBar label="Contratos" value={c.contracts_closed} max={c.total_leads} color="bg-green-500" />
                                </div>
                                <div className="space-y-2">
                                  <p className="text-[10px] text-muted-foreground">Métricas</p>
                                  <div className="text-xs space-y-1">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Desqualificados</span><span>{c.disqualified_leads}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">No-shows</span><span>{c.no_shows}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">No-show rate</span><span>{formatPercent(c.no_show_rate * 100)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Propostas</span><span>{c.meetings_held - c.contracts_closed - c.no_shows}</span></div>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-[10px] text-muted-foreground">Financeiro</p>
                                  <div className="text-xs space-y-1">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Investido</span><span>{formatCurrency(c.spend)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">MRR gerado</span><span className="text-green-400">{formatCurrency(c.total_mrr)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">CAC</span><span>{c.cac > 0 ? formatCurrency(c.cac) : "—"}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">ROAS</span><span>{c.spend > 0 ? (c.total_mrr / c.spend).toFixed(2) + "x" : "—"}</span></div>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-[10px] text-muted-foreground">Score Breakdown</p>
                                  <div className="text-xs space-y-1">
                                    <div className="flex justify-between"><span className="text-muted-foreground">Qualificação (25%)</span><span>{(c.qualification_rate * 25).toFixed(1)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Agendamento (30%)</span><span>{(c.meeting_rate * 30).toFixed(1)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Fechamento (35%)</span><span>{(c.close_rate * 35).toFixed(1)}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Lead Score (10%)</span><span>5.0</span></div>
                                    <div className="flex justify-between font-medium border-t pt-1"><span>Total</span><span>{c.composite_score.toFixed(1)}</span></div>
                                  </div>
                                </div>
                              </div>
                              {c.alert_message && (
                                <div className={`mt-3 p-2 rounded text-xs ${c.alert_status === "critical" ? "bg-red-500/10 text-red-400" : c.alert_status === "warning" ? "bg-yellow-500/10 text-yellow-400" : "bg-green-500/10 text-green-400"}`}>
                                  {c.alert_message}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Audiências */}
      {tab === "audiencias" && (
        <Card>
          <CardContent className="pt-4 overflow-x-auto">
            {audiences.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">Nenhuma audiência com dados ainda.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 px-2 text-left">Audiência</th>
                    <th className="py-2 px-2 text-left">Campanha</th>
                    <th className="py-2 px-2 text-right">Leads</th>
                    <th className="py-2 px-2 text-right">Qualif.</th>
                    <th className="py-2 px-2 text-right">Reuniões</th>
                    <th className="py-2 px-2 text-right">Contratos</th>
                    <th className="py-2 px-2 text-right">MRR</th>
                    <th className="py-2 px-2 text-center">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {audiences.map((a) => (
                    <tr key={a.adset_id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">{a.adset_name || a.adset_id}</td>
                      <td className="py-2 px-2 text-muted-foreground">{a.campaign_name || "—"}</td>
                      <td className="py-2 px-2 text-right font-mono">{a.total_leads}</td>
                      <td className="py-2 px-2 text-right font-mono">{a.qualified_leads}</td>
                      <td className="py-2 px-2 text-right font-mono">{a.meetings}</td>
                      <td className="py-2 px-2 text-right font-mono">{a.contracts}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatCurrency(a.total_mrr)}</td>
                      <td className="py-2 px-2 text-center"><ScoreGauge score={a.composite_score} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Alertas */}
      {tab === "alertas" && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">Nenhum alerta ativo</p></CardContent></Card>
          ) : (
            <>
              {criticals.map((c) => (
                <Card key={c.ad_id} className="border-red-500/30">
                  <CardContent className="pt-4 pb-3 flex items-start gap-3">
                    <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium">{c.ad_name || c.ad_id}</p>
                        <Badge variant="outline" className="text-[9px] bg-red-500/15 text-red-400">Crítico</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{c.campaign_name}</p>
                      <p className="text-xs text-red-400 mt-1">{c.alert_message}</p>
                    </div>
                    <ScoreGauge score={c.composite_score} />
                  </CardContent>
                </Card>
              ))}
              {warnings.map((c) => (
                <Card key={c.ad_id} className="border-yellow-500/30">
                  <CardContent className="pt-4 pb-3 flex items-start gap-3">
                    <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{c.ad_name || c.ad_id}</p>
                      <p className="text-xs text-yellow-400 mt-1">{c.alert_message}</p>
                    </div>
                    <ScoreGauge score={c.composite_score} />
                  </CardContent>
                </Card>
              ))}
              {topPerformers.map((c) => (
                <Card key={c.ad_id} className="border-green-500/30">
                  <CardContent className="pt-4 pb-3 flex items-start gap-3">
                    <TrendingUp size={16} className="text-green-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{c.ad_name || c.ad_id}</p>
                      <p className="text-xs text-green-400 mt-1">{c.alert_message}</p>
                    </div>
                    <ScoreGauge score={c.composite_score} />
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      {/* Tab: Sugestões */}
      {tab === "sugestoes" && (
        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">Nenhuma sugestão — dados insuficientes para recomendações</p></CardContent></Card>
          ) : (
            suggestions.map((s, i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-3 flex items-start gap-3">
                  {s.tipo === "escalar" ? <TrendingUp size={16} className="text-green-400 shrink-0 mt-0.5" /> :
                   s.tipo === "pausar" ? <TrendingDown size={16} className="text-red-400 shrink-0 mt-0.5" /> :
                   <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.criativo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.msg}</p>
                    {s.impacto && <Badge className="mt-1 text-[9px] bg-green-500/10 text-green-400">{s.impacto}</Badge>}
                  </div>
                  <Badge variant="outline" className={`text-[9px] ${s.tipo === "escalar" ? "text-green-400" : s.tipo === "pausar" ? "text-red-400" : "text-yellow-400"}`}>
                    {s.tipo === "escalar" ? "Escalar" : s.tipo === "pausar" ? "Pausar" : "Revisar"}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
