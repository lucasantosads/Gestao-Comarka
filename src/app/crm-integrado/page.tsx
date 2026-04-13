"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  RefreshCw, ChevronLeft, Phone, MessageSquare, Bell, FileText, CheckSquare, Calendar, ChevronDown,
} from "lucide-react";

interface GhlStage { id: string; name: string; position?: number }
interface GhlPipeline { id: string; name: string; stages: GhlStage[] }
interface GhlOpp {
  id: string;
  name?: string;
  contact?: { id?: string; name?: string; firstName?: string; lastName?: string };
  monetaryValue?: number | null;
  pipelineStageId?: string;
  source?: string;
  status?: string;
  dateAdded?: string;
  createdAt?: string;
  customFields?: Array<{ id: string; fieldValue?: unknown }>;
}

function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getOppName(o: GhlOpp): string {
  return (
    o.contact?.name ||
    [o.contact?.firstName, o.contact?.lastName].filter(Boolean).join(" ") ||
    o.name ||
    "Sem nome"
  );
}

export default function CrmIntegradoPage() {
  const [pipelines, setPipelines] = useState<GhlPipeline[]>([]);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [opps, setOpps] = useState<GhlOpp[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOpps, setLoadingOpps] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  // Quantos cards mostrar por stage (incrementa de 10 em 10 no "Carregar mais")
  const [visibleByStage, setVisibleByStage] = useState<Record<string, number>>({});
  const STAGE_PAGE_SIZE = 10;
  const [pipelineDropdownOpen, setPipelineDropdownOpen] = useState(false);
  // Default: mês corrente (1º até último dia)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  });

  // Carrega pipelines da GHL ao montar
  const loadPipelines = useCallback(async () => {
    try {
      const res = await fetch("/api/ghl/pipelines");
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      const list = (data.pipelines || data || []) as GhlPipeline[];
      setPipelines(list);
      if (list.length > 0 && !pipelineId) setPipelineId(list[0].id);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadPipelines(); }, [loadPipelines]);

  // Carrega oportunidades quando muda pipeline ou data
  const loadOpps = useCallback(async () => {
    if (!pipelineId) return;
    setLoadingOpps(true);
    try {
      const params = new URLSearchParams({
        pipelineId,
        fetchAll: "1",
        startDate,
        endDate,
      });
      const res = await fetch(`/api/ghl/opportunities?${params}`);
      const data = await res.json();
      if (data.error) { toast.error(data.error); setOpps([]); }
      else setOpps((data.opportunities || []) as GhlOpp[]);
      setLastSync(new Date());
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoadingOpps(false);
    }
  }, [pipelineId, startDate, endDate]);

  useEffect(() => { loadOpps(); }, [loadOpps]);

  // Reseta o "carregar mais" quando pipeline ou datas mudam
  useEffect(() => { setVisibleByStage({}); }, [pipelineId, startDate, endDate]);

  const sincronizar = async () => {
    await loadPipelines();
    await loadOpps();
    toast.success("Sincronizado");
  };

  const pipelineAtual = useMemo(() => pipelines.find((p) => p.id === pipelineId) || null, [pipelines, pipelineId]);
  const stages = useMemo(() => {
    if (!pipelineAtual) return [];
    return [...(pipelineAtual.stages || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [pipelineAtual]);

  const oppsByStage = useMemo(() => {
    const map = new Map<string, GhlOpp[]>();
    for (const o of opps) {
      const k = o.pipelineStageId || "__sem_stage__";
      const arr = map.get(k) || [];
      arr.push(o);
      map.set(k, arr);
    }
    return map;
  }, [opps]);

  // Funil do mês: stages do pipeline atual com contagem + valor no período
  const funilDoMes = useMemo(() => {
    if (!pipelineAtual) return null;
    const rows = stages.map((s) => {
      const list = oppsByStage.get(s.id) || [];
      const valor = list.reduce((acc, o) => acc + Number(o.monetaryValue || 0), 0);
      return { stage: s.name, count: list.length, valor };
    });
    const totalOpps = rows.reduce((s, r) => s + r.count, 0);
    const totalValor = rows.reduce((s, r) => s + r.valor, 0);
    const maxCount = Math.max(1, ...rows.map((r) => r.count));
    return { rows, totalOpps, totalValor, maxCount };
  }, [pipelineAtual, stages, oppsByStage]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">CRM Integrado</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-muted-foreground">De</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs w-[140px]" />
            <label className="text-[10px] text-muted-foreground ml-1">Até</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-xs w-[140px]" />
          </div>
          <Button size="sm" variant="outline" onClick={sincronizar} disabled={loadingOpps}>
            <RefreshCw size={13} className={`mr-1 ${loadingOpps ? "animate-spin" : ""}`} /> Sincronizar
          </Button>
          {lastSync && (
            <span className="text-[10px] text-muted-foreground">
              Última sincronização: {lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {/* Seletor de pipeline + contador */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setPipelineDropdownOpen((v) => !v)}
            className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 text-sm font-medium min-w-[220px] justify-between hover:bg-muted/40"
          >
            <span>{pipelineAtual?.name || (loading ? "Carregando…" : "Selecione um pipeline")}</span>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>
          {pipelineDropdownOpen && pipelines.length > 0 && (
            <div className="absolute top-full left-0 mt-1 bg-card border rounded-lg shadow-lg z-20 min-w-[260px] max-h-[60vh] overflow-y-auto">
              {pipelines.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPipelineId(p.id); setPipelineDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/40 ${p.id === pipelineId ? "bg-muted/30 font-medium" : ""}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-sm text-blue-400 font-medium">{opps.length} oportunidades</span>
      </div>

      {/* Funil do Mês — agregado por stage do pipeline selecionado dentro do período */}
      {funilDoMes && !loadingOpps && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <p className="text-xs uppercase text-muted-foreground font-semibold">Funil do Mês</p>
                <p className="text-[10px] text-muted-foreground">
                  {pipelineAtual?.name} · {startDate} → {endDate}
                </p>
              </div>
              <div className="flex gap-4 text-right">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Opps</p>
                  <p className="text-xl font-bold tabular-nums">{funilDoMes.totalOpps}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Valor Total</p>
                  <p className="text-xl font-bold text-green-400 font-mono tabular-nums">{formatCurrency(funilDoMes.totalValor)}</p>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              {funilDoMes.rows.map((r) => {
                const pct = (r.count / funilDoMes.maxCount) * 100;
                return (
                  <div key={r.stage} className="flex items-center gap-2 text-xs">
                    <div className="w-[180px] truncate text-muted-foreground">{r.stage}</div>
                    <div className="flex-1 h-5 bg-muted/30 rounded relative overflow-hidden">
                      <div className="h-full bg-blue-500/40 border-r border-blue-500" style={{ width: `${pct}%` }} />
                      <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium">{r.count} opps</span>
                    </div>
                    <div className="w-[120px] text-right font-mono tabular-nums text-muted-foreground">{formatCurrency(r.valor)}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban */}
      {loading || loadingOpps ? (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[280px] bg-card border rounded-lg p-3 space-y-2">
              <div className="h-4 bg-muted/40 rounded animate-pulse w-3/4" />
              {[1, 2].map((j) => (
                <div key={j} className="h-20 bg-muted/30 rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {stages.length === 0 && (
            <Card className="min-w-[280px]"><CardContent className="py-12 text-center text-sm text-muted-foreground">Selecione um pipeline para ver o kanban.</CardContent></Card>
          )}
          {stages.map((stage) => {
            const stageOpps = oppsByStage.get(stage.id) || [];
            const total = stageOpps.reduce((s, o) => s + Number(o.monetaryValue || 0), 0);
            const isCollapsed = collapsedStages[stage.id];
            const visible = visibleByStage[stage.id] ?? STAGE_PAGE_SIZE;
            const shown = stageOpps.slice(0, visible);
            const hasMore = stageOpps.length > visible;
            return (
              <div key={stage.id} className="min-w-[280px] max-w-[280px] bg-card border rounded-lg flex flex-col">
                <div className="px-3 py-2 border-b flex items-center justify-between gap-2 bg-muted/20 rounded-t-lg">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{stage.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {stageOpps.length} {stageOpps.length === 1 ? "opp" : "opps"} · {formatCurrency(total)}
                    </p>
                  </div>
                  <button
                    onClick={() => setCollapsedStages((p) => ({ ...p, [stage.id]: !isCollapsed }))}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    title={isCollapsed ? "Expandir" : "Colapsar"}
                  >
                    <ChevronLeft size={14} className={`transition-transform ${isCollapsed ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {!isCollapsed && (
                  <div className="p-2 space-y-2 min-h-[120px]">
                    {stageOpps.length === 0 ? (
                      <div className="border border-dashed border-border/50 rounded-md py-6 text-center text-[10px] text-muted-foreground">
                        Sem oportunidades
                      </div>
                    ) : (
                      shown.map((o) => {
                        const nome = getOppName(o);
                        const valor = Number(o.monetaryValue || 0);
                        return (
                          <div key={o.id} className="border rounded-md p-2.5 bg-background hover:bg-muted/10 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-bold flex-1 min-w-0 truncate">{nome}</p>
                              <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                {initials(nome)}
                              </div>
                            </div>
                            <div className="mt-1.5 flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground">Valor da oport...</span>
                              <span className="text-muted-foreground font-mono">{formatCurrency(valor)}</span>
                            </div>
                            {o.source && (
                              <span className="inline-block mt-1.5 text-[9px] bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                                {o.source}
                              </span>
                            )}
                            <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-muted-foreground">
                              <button className="hover:text-foreground" title="Ligar"><Phone size={11} /></button>
                              <button className="hover:text-foreground" title="Mensagem"><MessageSquare size={11} /></button>
                              <button className="hover:text-foreground relative" title="Notificações">
                                <Bell size={11} />
                                <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[7px] min-w-[10px] h-2.5 px-0.5 rounded-full flex items-center justify-center font-bold">1</span>
                              </button>
                              <button className="hover:text-foreground" title="Notas"><FileText size={11} /></button>
                              <button className="hover:text-foreground" title="Tarefas"><CheckSquare size={11} /></button>
                              <button className="hover:text-foreground" title="Agendar"><Calendar size={11} /></button>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {hasMore && (
                      <button
                        onClick={() => setVisibleByStage((p) => ({ ...p, [stage.id]: (p[stage.id] ?? STAGE_PAGE_SIZE) + STAGE_PAGE_SIZE }))}
                        className="w-full text-[10px] text-primary hover:underline border border-dashed border-border/60 rounded-md py-2"
                      >
                        Carregar mais ({stageOpps.length - visible} restantes)
                      </button>
                    )}
                    {!hasMore && stageOpps.length > STAGE_PAGE_SIZE && (
                      <button
                        onClick={() => setVisibleByStage((p) => ({ ...p, [stage.id]: STAGE_PAGE_SIZE }))}
                        className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1"
                      >
                        Mostrar menos
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
