"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { RefreshCw, GripVertical, Settings, Clock, X, ChevronRight, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { OnboardingItem } from "@/lib/data";

interface ChecklistItem {
  id: string;
  notion_id: string;
  secao: string;
  texto: string;
  ordem: number;
  checked: boolean;
}

// Cores por coluna — borda-top do header e badge do contador (Task 5 Fase A)
const ETAPAS = [
  { key: "Passagem de bastão",          border: "border-blue-500/30",   topBorder: "border-t-blue-500",   text: "text-blue-400",   badge: "bg-blue-500/15 text-blue-400" },
  { key: "Administrativo e Financeiro", border: "border-amber-500/30",  topBorder: "border-t-amber-500",  text: "text-amber-400",  badge: "bg-amber-500/15 text-amber-400" },
  { key: "Entrada",                     border: "border-purple-500/30", topBorder: "border-t-purple-500", text: "text-purple-400", badge: "bg-purple-500/15 text-purple-400" },
  { key: "Conexões do cliente",         border: "border-teal-500/30",   topBorder: "border-t-teal-500",   text: "text-teal-400",   badge: "bg-teal-500/15 text-teal-400" },
  { key: "Ações finais",                border: "border-orange-500/30", topBorder: "border-t-orange-500", text: "text-orange-400", badge: "bg-orange-500/15 text-orange-400" },
  { key: "Trabalho iniciado",           border: "border-green-500/30",  topBorder: "border-t-green-500",  text: "text-green-400",  badge: "bg-green-500/15 text-green-400" },
];

const normalizeEtapa = (etapa: string) => {
  const found = ETAPAS.find((e) => e.key.toLowerCase() === etapa.toLowerCase());
  return found ? found.key : ETAPAS[0].key;
};

interface Tracking {
  notion_id: string;
  iniciado_em: string;
  finalizado_em: string | null;
  tempo_total_segundos: number | null;
  etapa_atual: string | null;
  etapa_entrada_em: string | null;
  checklist_total: number | null;
  checklist_done: number | null;
}

// Dias úteis entre data e hoje (segunda a sexta, local)
function diasUteisDesde(dateIso: string): number {
  const start = new Date(dateIso);
  const now = new Date();
  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) count++;
  }
  return count;
}

function formatDias(segundos: number): string {
  if (!segundos) return "—";
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  if (dias === 0) return `${horas}h`;
  return `${dias}d${horas > 0 ? ` ${horas}h` : ""}`;
}

function calcTempo(t: Tracking): number {
  if (t.tempo_total_segundos) return t.tempo_total_segundos;
  if (t.iniciado_em) {
    return Math.floor((Date.now() - new Date(t.iniciado_em).getTime()) / 1000);
  }
  return 0;
}

// Task 3 (Fase A): dias decorridos na coluna atual
function diasNaColuna(t: Tracking): string {
  if (!t.etapa_entrada_em) return "—";
  const ms = Date.now() - new Date(t.etapa_entrada_em).getTime();
  const dias = Math.floor(ms / 86400000);
  return `${dias}d`;
}

export default function OnboardingPage() {
  const [items, setItems] = useState<OnboardingItem[]>([]);
  const [trackings, setTrackings] = useState<Map<string, Tracking>>(new Map());
  const [metricas, setMetricas] = useState<{ tempo_medio_dias: number; finalizados: number; em_andamento: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  // Sheet lateral de detalhes (Fase C)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<OnboardingItem | null>(null);
  const [sheetChecklist, setSheetChecklist] = useState<ChecklistItem[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  // Sheet do ranking de tempo médio (Fase F)
  const [rankingOpen, setRankingOpen] = useState(false);

  const abrirSheet = async (it: OnboardingItem) => {
    setSheetItem(it);
    setSheetOpen(true);
    setSheetLoading(true);
    const r = await fetch(`/api/onboarding/checklist/${it.notion_id}`);
    const d = await r.json();
    if (Array.isArray(d)) setSheetChecklist(d);
    setSheetLoading(false);
  };

  const toggleChecklistItem = async (item: ChecklistItem, checked: boolean) => {
    setSheetChecklist((prev) => prev.map((x) => x.id === item.id ? { ...x, checked } : x));
    // Atualiza counts localmente no tracking pra barra do kanban reagir na hora
    if (sheetItem) {
      setTrackings((prev) => {
        const copy = new Map(prev);
        const t = copy.get(sheetItem.notion_id);
        if (t) {
          const delta = checked ? 1 : -1;
          copy.set(sheetItem.notion_id, { ...t, checklist_done: (t.checklist_done || 0) + delta });
        }
        return copy;
      });
    }
    await fetch(`/api/onboarding/checklist/${item.notion_id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, checked }),
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [onbRes, trackRes] = await Promise.all([
      fetch("/api/notion/onboarding").then((r) => r.json()),
      fetch("/api/onboarding/tracking").then((r) => r.json()),
    ]);
    const itens = Array.isArray(onbRes) ? onbRes : [];
    setItems(itens);
    let trackingMap = new Map<string, Tracking>();
    if (trackRes.items) {
      for (const t of trackRes.items) trackingMap.set(t.notion_id, t);
    }

    // Auto-criar tracking para novos onboardings detectados no Notion
    const novos = itens.filter((i) => !trackingMap.has(i.notion_id));
    if (novos.length > 0) {
      await Promise.all(novos.map((i) =>
        fetch("/api/onboarding/tracking", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notion_id: i.notion_id, etapa: i.etapa, cliente_nome: i.nome }),
        })
      ));
      const trackRes2 = await fetch("/api/onboarding/tracking").then((r) => r.json());
      trackingMap = new Map<string, Tracking>();
      if (trackRes2.items) {
        for (const t of trackRes2.items) trackingMap.set(t.notion_id, t);
      }
      setMetricas(trackRes2.metricas);
    } else {
      setMetricas(trackRes.metricas);
    }
    setTrackings(trackingMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sync = async () => {
    setSyncing(true);
    await fetch("/api/notion/sync", { method: "POST", body: JSON.stringify({ db: "onboarding" }), headers: { "Content-Type": "application/json" } });
    await load();
    setSyncing(false);
    toast.success("Sincronizado");
  };

  const moverEtapa = async (notionId: string, novaEtapa: string) => {
    setItems((prev) => prev.map((i) => i.notion_id === notionId ? { ...i, etapa: novaEtapa } : i));
    const [updateRes] = await Promise.all([
      fetch("/api/notion/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notion_id: notionId, field: "etapa", value: novaEtapa }),
      }).then((r) => r.json()),
      fetch("/api/onboarding/tracking", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notion_id: notionId, etapa: novaEtapa }),
      }),
    ]);
    if (!updateRes.success) { toast.error(updateRes.error || "Erro"); load(); }
    else {
      toast.success(novaEtapa === "Trabalho iniciado" ? "Onboarding finalizado!" : "Etapa atualizada");
      load();
    }
  };

  const handleDragStart = (notionId: string) => setDragging(notionId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (etapa: string) => {
    if (dragging) moverEtapa(dragging, etapa);
    setDragging(null);
  };

  const avancarEtapa = async () => {
    if (!sheetItem) return;
    const atual = normalizeEtapa(sheetItem.etapa);
    const idx = ETAPAS.findIndex((e) => e.key === atual);
    if (idx < 0 || idx >= ETAPAS.length - 1) { toast.info("Já está na última etapa"); return; }
    const proxima = ETAPAS[idx + 1].key;
    await moverEtapa(sheetItem.notion_id, proxima);
    setSheetItem((prev) => prev ? { ...prev, etapa: proxima } : prev);
    toast.success(`Movido para ${proxima}`);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Onboarding</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/onboarding/template">
            <Button size="sm" variant="outline"><Settings size={14} className="mr-1" />Template</Button>
          </Link>
          <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
            <RefreshCw size={14} className={`mr-1 ${syncing ? "animate-spin" : ""}`} />Sincronizar
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        📝 Crie novos onboardings diretamente no Notion. Eles aparecem aqui automaticamente e o cronômetro começa a contar.
      </p>

      {/* Métricas */}
      {metricas && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setRankingOpen(true)}>
            <CardContent className="pt-4 pb-3 text-center">
              <Clock size={16} className="mx-auto mb-1 text-blue-400" />
              <p className="text-xs text-muted-foreground">Tempo médio <span className="text-[9px] text-primary">(ver ranking →)</span></p>
              <p className="text-xl font-bold">{metricas.tempo_medio_dias} dias</p>
            </CardContent>
          </Card>
          <Card><CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Em andamento</p>
            <p className="text-xl font-bold text-yellow-400">{metricas.em_andamento}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Finalizados</p>
            <p className="text-xl font-bold text-green-400">{metricas.finalizados}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {ETAPAS.map((etapa) => {
          const etapaItems = items.filter((i) => normalizeEtapa(i.etapa) === etapa.key);
          return (
            <div key={etapa.key} className="min-w-[240px] flex-1"
              onDragOver={handleDragOver} onDrop={() => handleDrop(etapa.key)}>
              <div className={`flex items-center justify-between mb-2 px-2 py-1.5 border-t-4 ${etapa.topBorder} bg-card rounded-t-lg`}>
                <span className={`text-xs font-semibold truncate ${etapa.text}`}>{etapa.key}</span>
                <Badge className={`text-[9px] ${etapa.badge}`}>{etapaItems.length}</Badge>
              </div>
              <div className={`space-y-2 min-h-[200px] p-2 rounded-b-lg border border-dashed ${etapa.border}`}>
                {etapaItems.map((item) => {
                  const tracking = trackings.get(item.notion_id);
                  const tempo = tracking ? calcTempo(tracking) : 0;
                  // Progresso do checklist (Task 2 Fase B)
                  const total = tracking?.checklist_total || 0;
                  const done = tracking?.checklist_done || 0;
                  const pct = total > 0 ? (done / total) * 100 : 0;
                  const barColor = pct > 66 ? "bg-green-500" : pct >= 33 ? "bg-yellow-500" : total > 0 ? "bg-red-500" : "bg-muted";
                  // Badge atrasado: >5 dias úteis na mesma coluna, só para não-finalizados
                  const atrasado = tracking && !tracking.finalizado_em && tracking.etapa_entrada_em
                    ? diasUteisDesde(tracking.etapa_entrada_em) > 5 : false;
                  // Task 4 Fase D: ação rápida de avanço
                  const etapaIdx = ETAPAS.findIndex((e) => e.key === normalizeEtapa(item.etapa));
                  const proximaEtapa = etapaIdx >= 0 && etapaIdx < ETAPAS.length - 1 ? ETAPAS[etapaIdx + 1].key : null;
                  return (
                    <div key={item.notion_id} onClick={() => abrirSheet(item)} className="group relative">
                      <div draggable
                        onDragStart={(e) => { e.stopPropagation(); handleDragStart(item.notion_id); }}
                        className={`relative p-2.5 rounded-lg border bg-card cursor-pointer hover:border-primary/50 transition-colors ${dragging === item.notion_id ? "opacity-50" : ""}`}>
                        {atrasado && (
                          <span className="absolute top-1 right-1 text-[8px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold border border-red-500/40">
                            Atrasado
                          </span>
                        )}
                        {proximaEtapa && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moverEtapa(item.notion_id, proximaEtapa);
                              toast.success(`${item.nome} movido para ${proximaEtapa}`);
                            }}
                            title={`Avançar para ${proximaEtapa}`}
                            className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-primary/20 hover:bg-primary/40 text-primary z-10"
                          >
                            <ArrowRight size={12} />
                          </button>
                        )}
                        <div className="flex items-start gap-1.5">
                          <GripVertical size={12} className="text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate pr-12">{item.nome}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.plataformas && item.plataformas.split(",").map((p) => (
                                <Badge key={p.trim()} className="text-[8px] bg-blue-500/15 text-blue-400">{p.trim()}</Badge>
                              ))}
                            </div>
                            <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
                              {item.orcamento && <span className="font-mono">{formatCurrency(Number(item.orcamento))}</span>}
                              {item.gestor && <span className="truncate ml-2">{item.gestor}</span>}
                            </div>
                            {tracking && (
                              <div className="flex items-center gap-2 mt-1 pt-1 border-t border-border/30">
                                <div className="flex items-center gap-1" title="Dias nesta coluna">
                                  <Clock size={9} className={tracking.finalizado_em ? "text-green-400" : "text-blue-400"} />
                                  <span className={`text-[10px] font-mono ${tracking.finalizado_em ? "text-green-400" : "text-blue-400"}`}>
                                    {tracking.finalizado_em ? formatDias(tempo) : diasNaColuna(tracking)}
                                  </span>
                                </div>
                                {tracking.finalizado_em && <span className="text-[9px] text-green-400">✓</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Progresso do checklist — barra 4px na parte de baixo */}
                        <div className="mt-1.5">
                          <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-0.5">
                            <span>{total > 0 ? `${done}/${total}` : "—"}</span>
                            {total > 0 && <span>{Math.round(pct)}%</span>}
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {etapaItems.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-8">Nenhum</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sheet lateral — Task 1 Fase C */}
      {sheetOpen && sheetItem && (() => {
        const t = trackings.get(sheetItem.notion_id);
        const total = sheetChecklist.length;
        const done = sheetChecklist.filter((i) => i.checked).length;
        const pct = total > 0 ? (done / total) * 100 : 0;
        // Agrupa por seção
        const porSecao = new Map<string, ChecklistItem[]>();
        for (const it of sheetChecklist) {
          const arr = porSecao.get(it.secao) || [];
          arr.push(it);
          porSecao.set(it.secao, arr);
        }
        // Preserva ordem das ETAPAS (secao = etapa key)
        const ordemSecoes = Array.from(porSecao.keys()).sort((a, b) => {
          const ia = ETAPAS.findIndex((e) => e.key === a);
          const ib = ETAPAS.findIndex((e) => e.key === b);
          return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
        });
        const etapaAtual = normalizeEtapa(sheetItem.etapa);
        const idxEtapa = ETAPAS.findIndex((e) => e.key === etapaAtual);
        const isUltima = idxEtapa === ETAPAS.length - 1;
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSheetOpen(false)} />
            <aside className="fixed top-0 right-0 z-50 h-full w-full max-w-2xl bg-background border-l shadow-2xl flex flex-col">
              {/* Header */}
              <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold truncate">{sheetItem.nome}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="text-[10px] bg-indigo-500/15 text-indigo-400">{etapaAtual}</Badge>
                    {t?.etapa_entrada_em && (
                      <span className="text-[10px] text-muted-foreground">
                        Nesta coluna há {diasNaColuna(t)}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSheetOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>

              {/* Barra de progresso */}
              <div className="px-5 py-3 border-b shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium">Progresso</span>
                  <span className="text-xs font-mono">{done}/{total} itens ({Math.round(pct)}%)</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${pct > 66 ? "bg-green-500" : pct >= 33 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Checklist */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {sheetLoading && <p className="text-xs text-muted-foreground">Carregando checklist...</p>}
                {!sheetLoading && ordemSecoes.map((secao) => {
                  const items = porSecao.get(secao) || [];
                  const secDone = items.filter((i) => i.checked).length;
                  const etapaCfg = ETAPAS.find((e) => e.key === secao);
                  return (
                    <div key={secao}>
                      <div className={`flex items-center justify-between mb-2 pb-1 border-b ${etapaCfg?.border || ""}`}>
                        <h3 className={`text-xs font-semibold ${etapaCfg?.text || ""}`}>{secao}</h3>
                        <Badge className={`text-[9px] ${etapaCfg?.badge || ""}`}>{secDone}/{items.length}</Badge>
                      </div>
                      <div className="space-y-1">
                        {items.map((ci) => (
                          <label key={ci.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-muted/30 cursor-pointer">
                            <input type="checkbox" checked={ci.checked}
                              onChange={(e) => toggleChecklistItem(ci, e.target.checked)}
                              className="rounded w-4 h-4" />
                            <span className={`text-sm ${ci.checked ? "line-through text-muted-foreground" : ""}`}>{ci.texto}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!sheetLoading && sheetChecklist.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Nenhum item no template. Adicione em <Link href="/dashboard/onboarding/template" className="text-primary hover:underline">Template</Link>.
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t shrink-0 flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground">Sheet permanece aberto após mover.</span>
                <Button size="sm" onClick={avancarEtapa} disabled={isUltima}>
                  {isUltima ? "Última etapa" : (<>Mover para próxima <ChevronRight size={14} className="ml-1" /></>)}
                </Button>
              </div>
            </aside>
          </>
        );
      })()}

      {/* Sheet lateral — ranking de tempo médio (Task 8 Fase F) */}
      {rankingOpen && (() => {
        const finalizados = Array.from(trackings.values())
          .filter((t) => t.etapa_atual === "Trabalho iniciado" && t.tempo_total_segundos)
          .sort((a, b) => (a.tempo_total_segundos || 0) - (b.tempo_total_segundos || 0));
        const clienteNome = (notionId: string) => items.find((i) => i.notion_id === notionId)?.nome || notionId;
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setRankingOpen(false)} />
            <aside className="fixed top-0 right-0 z-50 h-full w-full max-w-2xl bg-background border-l shadow-2xl flex flex-col">
              <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Clock size={18} className="text-blue-400" />
                    Ranking de tempo de onboarding
                  </h2>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {finalizados.length} finalizados · mais rápido ao mais lento · média {metricas?.tempo_medio_dias || 0} dias
                  </p>
                </div>
                <button onClick={() => setRankingOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {finalizados.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-12">
                    Nenhum onboarding finalizado ainda. Quando um card chegar em &quot;Trabalho iniciado&quot;, entra no ranking.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {finalizados.map((t, i) => {
                      const dias = Math.floor((t.tempo_total_segundos || 0) / 86400);
                      const horas = Math.floor(((t.tempo_total_segundos || 0) % 86400) / 3600);
                      const isTop3 = i < 3;
                      const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                      return (
                        <div key={t.notion_id} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${isTop3 ? "bg-muted/20" : ""}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[11px] text-muted-foreground font-mono w-6 shrink-0">
                              {medalha || `#${i + 1}`}
                            </span>
                            <span className="text-sm font-medium truncate">{clienteNome(t.notion_id)}</span>
                          </div>
                          <span className="text-xs font-mono text-muted-foreground shrink-0 ml-2">
                            {dias}d{horas > 0 ? ` ${horas}h` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
          </>
        );
      })()}
    </div>
  );
}
