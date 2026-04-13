"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Play, Pause, Trash2, GripVertical, X, Clock } from "lucide-react";

interface Tarefa {
  id: string; titulo: string; descricao: string | null;
  responsavel: string; solicitante: string | null; cliente: string | null;
  setor: string | null; urgencia: string; status: string;
  data_vencimento: string | null;
  total_segundos: number; em_andamento: boolean; ultimo_inicio: string | null;
  iniciado_em: string | null; finalizado_em: string | null;
  tempo_total: number;
}

const COLUNAS = [
  { key: "a_fazer", label: "A Fazer", color: "border-slate-500/30", bg: "bg-slate-500/5" },
  { key: "fazendo", label: "Fazendo", color: "border-blue-500/30", bg: "bg-blue-500/5" },
  { key: "concluido", label: "Concluído", color: "border-green-500/30", bg: "bg-green-500/5" },
];

const URGENCIA_COLORS: Record<string, string> = {
  "Baixa": "bg-slate-500/15 text-slate-400",
  "Média": "bg-blue-500/15 text-blue-400",
  "Alta": "bg-orange-500/15 text-orange-400",
  "Crítica": "bg-red-500/15 text-red-400",
};

const URGENCIA_OPTS = ["Baixa", "Média", "Alta", "Crítica"];
const SETOR_OPTS = ["Tráfego", "Comercial", "Design", "Desenvolvimento", "Administrativo", "Outro"];

interface ClienteReceita {
  id: string; nome: string; status: string; status_financeiro: string; valor_mensal: number;
}

// Mapeia status_financeiro para grupos visuais
const STATUS_GRUPOS: { label: string; keys: string[]; color: string }[] = [
  { label: "Ativos", keys: ["ativo"], color: "text-green-400" },
  { label: "Planejamento", keys: ["planejamento", "em_analise"], color: "text-blue-400" },
  { label: "Pagou Integral", keys: ["pagou_integral"], color: "text-cyan-400" },
  { label: "Parceria", keys: ["parceria"], color: "text-purple-400" },
  { label: "Pausado", keys: ["pausado"], color: "text-yellow-400" },
  { label: "Aviso 30 dias", keys: ["aviso_30_dias", "aviso"], color: "text-orange-400" },
  { label: "Finalizados", keys: ["finalizado", "churned", "cancelado"], color: "text-red-400" },
];

function getGrupoCliente(c: ClienteReceita): string {
  const sf = (c.status_financeiro || c.status || "").toLowerCase();
  const grupo = STATUS_GRUPOS.find((g) => g.keys.some((k) => sf.includes(k)));
  return grupo?.label || "Outros";
}

function formatTempo(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function TarefasKanban({ filtroResponsavel }: { filtroResponsavel?: string } = {}) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [clientesEntrada, setClientesEntrada] = useState<ClienteReceita[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tick, setTick] = useState(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const [filtroResp, setFiltroResp] = useState(filtroResponsavel || "");
  const [form, setForm] = useState({
    titulo: "", descricao: "", responsavel: "", solicitante: "", cliente: "",
    setor: "Tráfego", urgencia: "Média", data_vencimento: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const q = filtroResp ? `?responsavel=${encodeURIComponent(filtroResp)}` : "";
    const [tRes, cRes] = await Promise.all([
      fetch(`/api/tarefas-kanban${q}`).then((r) => r.json()),
      fetch("/api/tarefas-kanban/clientes").then((r) => r.json()).catch(() => []),
    ]);
    if (Array.isArray(tRes)) setTarefas(tRes);
    if (Array.isArray(cRes)) setClientesEntrada(cRes);
    setLoading(false);
  }, [filtroResp]);

  useEffect(() => { load(); }, [load]);

  // Tick a cada segundo para atualizar o cronômetro
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const criarTarefa = async () => {
    if (!form.titulo || !form.responsavel) { toast.error("Título e responsável obrigatórios"); return; }
    const res = await fetch("/api/tarefas-kanban", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else {
      toast.success("Tarefa criada");
      setForm({ titulo: "", descricao: "", responsavel: "", solicitante: "", cliente: "", setor: "Tráfego", urgencia: "Média", data_vencimento: "" });
      setShowForm(false);
      load();
    }
  };

  const moverStatus = async (id: string, novoStatus: string) => {
    setTarefas((prev) => prev.map((t) => t.id === id ? { ...t, status: novoStatus } : t));
    const res = await fetch("/api/tarefas-kanban", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: novoStatus }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); load(); }
    else { toast.success("Status atualizado"); load(); }
  };

  const toggleTimer = async (id: string) => {
    const res = await fetch("/api/tarefas-kanban", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "toggle_timer" }),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else load();
  };

  const deletarTarefa = async (id: string) => {
    if (!confirm("Remover esta tarefa?")) return;
    await fetch(`/api/tarefas-kanban?id=${id}`, { method: "DELETE" });
    toast.success("Removida");
    load();
  };

  const handleDragStart = (id: string) => setDragging(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (status: string) => {
    if (dragging) moverStatus(dragging, status);
    setDragging(null);
  };

  // Calcula tempo em tempo real considerando tick
  const calcTempoReal = (t: Tarefa): number => {
    let total = Number(t.total_segundos || 0);
    if (t.em_andamento && t.ultimo_inicio) {
      total += Math.floor((Date.now() - new Date(t.ultimo_inicio).getTime()) / 1000);
    }
    return total;
  };

  // Força re-render quando tick muda
  void tick;

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  const responsaveisUnicos = Array.from(new Set(tarefas.map((t) => t.responsavel).filter(Boolean))).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Tarefas Kanban</h1>
        <div className="flex items-center gap-2">
          {!filtroResponsavel && (
            <select value={filtroResp} onChange={(e) => setFiltroResp(e.target.value)} className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
              <option value="">Todos Responsáveis</option>
              {responsaveisUnicos.map((r) => <option key={r}>{r}</option>)}
            </select>
          )}
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={14} className="mr-1" />Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Form nova tarefa */}
      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Nova Tarefa</p>
              <button onClick={() => setShowForm(false)}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2 space-y-1"><Label className="text-xs">Título*</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Responsável*</Label><Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} placeholder="Nome" /></div>
              <div className="space-y-1"><Label className="text-xs">Solicitante</Label><Input value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Cliente</Label>
                <select value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} className="w-full text-xs bg-transparent border rounded-lg px-3 py-2">
                  <option value="">Nenhum</option>
                  {STATUS_GRUPOS.map((grupo) => {
                    const items = clientesEntrada.filter((c) => getGrupoCliente(c) === grupo.label);
                    if (items.length === 0) return null;
                    return (
                      <optgroup key={grupo.label} label={`— ${grupo.label} (${items.length}) —`}>
                        {items.sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => (
                          <option key={c.id} value={c.nome}>{c.nome}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Setor</Label>
                <select value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} className="w-full text-xs bg-transparent border rounded-lg px-3 py-2">
                  {SETOR_OPTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Urgência</Label>
                <select value={form.urgencia} onChange={(e) => setForm({ ...form, urgencia: e.target.value })} className="w-full text-xs bg-transparent border rounded-lg px-3 py-2">
                  {URGENCIA_OPTS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Vencimento</Label><Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} /></div>
              <div className="col-span-2 md:col-span-4 space-y-1"><Label className="text-xs">Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhes..." /></div>
            </div>
            <Button onClick={criarTarefa}>Criar Tarefa</Button>
          </CardContent>
        </Card>
      )}

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {COLUNAS.map((col) => {
          const items = tarefas.filter((t) => t.status === col.key);
          return (
            <div key={col.key}
              onDragOver={handleDragOver} onDrop={() => handleDrop(col.key)}>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-sm font-medium">{col.label}</span>
                <Badge variant="outline" className="text-[9px]">{items.length}</Badge>
              </div>
              <div className={`space-y-2 min-h-[300px] p-2 rounded-lg border border-dashed ${col.color} ${col.bg}`}>
                {items.map((t) => {
                  const tempoReal = calcTempoReal(t);
                  return (
                    <div key={t.id} draggable onDragStart={() => handleDragStart(t.id)}
                      className={`p-2.5 rounded-lg border bg-card transition-colors cursor-grab active:cursor-grabbing hover:border-primary/50 ${dragging === t.id ? "opacity-50" : ""}`}>
                      <div className="flex items-start gap-1.5">
                        <GripVertical size={12} className="text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{t.titulo}</p>
                            <button onClick={(e) => { e.stopPropagation(); deletarTarefa(t.id); }} className="text-muted-foreground hover:text-red-400 shrink-0">
                              <Trash2 size={10} />
                            </button>
                          </div>
                          {t.descricao && <p className="text-[10px] text-muted-foreground line-clamp-2">{t.descricao}</p>}
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge className={`text-[8px] ${URGENCIA_COLORS[t.urgencia] || "bg-muted"}`}>{t.urgencia}</Badge>
                            {t.setor && <Badge className="text-[8px] bg-muted text-muted-foreground">{t.setor}</Badge>}
                            {t.cliente && <Badge className="text-[8px] bg-purple-500/15 text-purple-400">{t.cliente}</Badge>}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>👤 {t.responsavel}</span>
                            {t.data_vencimento && <span>📅 {new Date(t.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>}
                          </div>
                          {t.solicitante && <p className="text-[9px] text-muted-foreground">Solicitante: {t.solicitante}</p>}
                          {/* Cronômetro */}
                          {(t.status === "fazendo" || tempoReal > 0) && (
                            <div className="flex items-center gap-2 pt-1 border-t">
                              <Clock size={10} className={t.em_andamento ? "text-green-400" : "text-muted-foreground"} />
                              <span className={`text-[10px] font-mono ${t.em_andamento ? "text-green-400" : "text-muted-foreground"}`}>
                                {formatTempo(tempoReal)}
                              </span>
                              {t.status === "fazendo" && (
                                <button onClick={(e) => { e.stopPropagation(); toggleTimer(t.id); }}
                                  className="ml-auto text-[10px] hover:text-primary">
                                  {t.em_andamento ? <Pause size={12} /> : <Play size={12} />}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-8">Nenhuma tarefa</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
