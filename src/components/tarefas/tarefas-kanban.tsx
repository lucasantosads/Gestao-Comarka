"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Play, Pause, Trash2, GripVertical, X, Clock, User, Search, AlertCircle, RotateCcw, Archive } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";

interface Tarefa {
  id: string; titulo: string; descricao: string | null;
  responsavel: string; solicitante: string | null; cliente: string | null;
  responsavel_id: string | null; solicitante_id: string | null; cliente_id: string | null;
  setor: string | null; urgencia: string; status: string;
  data_vencimento: string | null;
  total_segundos: number; em_andamento: boolean; ultimo_inicio: string | null;
  iniciado_em: string | null; finalizado_em: string | null;
  tempo_total: number;
  tipo_tarefa: string | null;
  cronometro_encerrado?: boolean;
}

interface TipoTarefaOpcao {
  id: string; nome: string; cor: string;
}

interface Employee {
  id: string; nome: string; role: string; cargo: string | null; foto_url: string | null;
}

interface ClienteReceita {
  id: string; nome: string; status: string; status_financeiro: string; valor_mensal: number;
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
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function formatTempoHMS(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ===== Cliente Search Dropdown =====
function ClienteSearchDropdown({ clientes, value, onChange }: {
  clientes: ClienteReceita[];
  value: string;
  onChange: (clienteId: string, clienteNome: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = clientes.filter((c) => c.nome.toLowerCase().includes(search.toLowerCase()));
  const grouped = STATUS_GRUPOS.map((g) => ({
    ...g,
    items: filtered.filter((c) => getGrupoCliente(c) === g.label),
  })).filter((g) => g.items.length > 0);

  const selectedNome = value ? clientes.find((c) => c.id === value)?.nome || "" : "";

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={open ? search : selectedNome}
          onChange={(e) => { setSearch(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar cliente..."
          className="text-xs pl-7"
        />
        {value && (
          <button onClick={() => { onChange("", ""); setSearch(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={12} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {grouped.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum cliente encontrado</p>}
          {grouped.map((g) => (
            <div key={g.label}>
              <p className={`text-[9px] uppercase tracking-widest font-bold px-3 pt-2 pb-1 ${g.color}`}>{g.label} ({g.items.length})</p>
              {g.items.sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => (
                <button key={c.id} onClick={() => { onChange(c.id, c.nome); setSearch(""); setOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between">
                  <span>{c.nome}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Modal de criação de tarefa =====
function NovaTarefaModal({ employees, clientes, tipoTarefaOpcoes, session, defaultStatus, onClose, onSaved }: {
  employees: Employee[];
  clientes: ClienteReceita[];
  tipoTarefaOpcoes: TipoTarefaOpcao[];
  session: { employeeId: string; nome: string } | null;
  defaultStatus: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    titulo: "", descricao: "",
    responsavel_id: session?.employeeId || "",
    solicitante_id: session?.employeeId || "",
    cliente_id: "",
    setor: "Tráfego", urgencia: "Média", data_vencimento: "",
    status: defaultStatus,
    tipo_tarefa: "",
  });

  const criarTarefa = async () => {
    if (!form.titulo) { toast.error("Título obrigatório"); return; }
    if (!form.responsavel_id) { toast.error("Responsável obrigatório"); return; }

    const res = await fetch("/api/tarefas-kanban", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else { toast.success("Tarefa criada"); onSaved(); }
  };

  const solicitanteNome = session?.nome || "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border rounded-xl shadow-2xl p-6 w-full max-w-lg space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Nova Tarefa</h3>
          <button onClick={onClose}><X size={16} className="text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Título *</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descrição</Label>
            <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhes..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Solicitante — read-only */}
            <div className="space-y-1">
              <Label className="text-xs">Solicitante</Label>
              <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-muted/30 text-sm text-muted-foreground">
                <User size={14} className="shrink-0" />
                <span className="truncate">{solicitanteNome}</span>
              </div>
            </div>
            {/* Responsável — select com employees */}
            <div className="space-y-1">
              <Label className="text-xs">Responsável *</Label>
              <select
                value={form.responsavel_id}
                onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })}
                className="w-full text-sm bg-transparent border rounded-lg px-3 py-2"
              >
                <option value="">Selecione...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.nome}{emp.cargo ? ` (${emp.cargo})` : ""}</option>
                ))}
              </select>
            </div>
            {/* Cliente — search dropdown */}
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <ClienteSearchDropdown
                clientes={clientes}
                value={form.cliente_id}
                onChange={(id) => setForm({ ...form, cliente_id: id })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Setor</Label>
              <select value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} className="w-full text-xs bg-transparent border rounded-lg px-3 py-2">
                {SETOR_OPTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Urgência</Label>
              <select value={form.urgencia} onChange={(e) => setForm({ ...form, urgencia: e.target.value })} className="w-full text-xs bg-transparent border rounded-lg px-3 py-2">
                {URGENCIA_OPTS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vencimento</Label>
              <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <select value={form.tipo_tarefa} onChange={(e) => setForm({ ...form, tipo_tarefa: e.target.value })} className="w-full text-xs bg-transparent border rounded-lg px-3 py-2">
                <option value="">Sem tipo</option>
                {tipoTarefaOpcoes.map((t) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={criarTarefa}>Criar Tarefa</Button>
        </div>
      </div>
    </div>
  );
}

function isAtrasada(t: Tarefa): boolean {
  if (!t.data_vencimento || t.status === "concluido") return false;
  const venc = new Date(t.data_vencimento + "T23:59:59");
  return Date.now() > venc.getTime();
}

// ===== Modal de detalhe da tarefa =====
function TarefaDetalheModal({ tarefa, employees, clientes, tipoTarefaOpcoes, onClose, onSaved }: {
  tarefa: Tarefa; employees: Employee[]; clientes: ClienteReceita[]; tipoTarefaOpcoes: TipoTarefaOpcao[];
  onClose: () => void; onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState(tarefa.titulo);
  const [descricao, setDescricao] = useState(tarefa.descricao || "");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const autoSave = useCallback((field: string, value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await fetch("/api/tarefas-kanban", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tarefa.id, [field]: value }),
      });
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else onSaved();
    }, 1000);
  }, [tarefa.id, onSaved]);

  const saveField = async (field: string, value: string) => {
    const res = await fetch("/api/tarefas-kanban", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tarefa.id, [field]: value }),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else onSaved();
  };

  const atrasada = isAtrasada(tarefa);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-[80vw] max-w-5xl h-[85vh] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            {atrasada && <Badge className="bg-red-500/15 text-red-400 border-0 text-[10px]"><AlertCircle size={10} className="mr-0.5" />Atrasada</Badge>}
            <Badge className={`text-[9px] ${URGENCIA_COLORS[tarefa.urgencia] || "bg-muted"}`}>{tarefa.urgencia}</Badge>
            {tarefa.setor && <Badge className="text-[9px] bg-muted text-muted-foreground">{tarefa.setor}</Badge>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left — 60% */}
          <div className="flex-[3] p-6 overflow-y-auto space-y-4 border-r border-border">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Título</label>
              <Input value={titulo} onChange={(e) => { setTitulo(e.target.value); autoSave("titulo", e.target.value); }}
                className="text-lg font-semibold bg-transparent border-0 px-0 focus-visible:ring-0 h-auto mt-1" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Descrição</label>
              <Textarea value={descricao} onChange={(e) => { setDescricao(e.target.value); autoSave("descricao", e.target.value); }}
                placeholder="Detalhes da tarefa..." className="mt-1 bg-card/30 border-border/50 min-h-[200px] resize-none" />
            </div>
          </div>

          {/* Right — 40% */}
          <div className="flex-[2] p-6 overflow-y-auto space-y-4 bg-muted/5">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</label>
              <select value={tarefa.status} onChange={(e) => saveField("status", e.target.value)}
                className="mt-1 w-full text-sm bg-card/50 border border-border rounded-lg px-3 py-2">
                {COLUNAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Responsável</label>
              <select value={tarefa.responsavel_id || ""} onChange={(e) => saveField("responsavel_id", e.target.value)}
                className="mt-1 w-full text-sm bg-card/50 border border-border rounded-lg px-3 py-2">
                <option value="">—</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Solicitante</label>
              <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1"><User size={12} />{tarefa.solicitante || "—"}</p>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Cliente</label>
              <ClienteSearchDropdown clientes={clientes} value={tarefa.cliente_id || ""}
                onChange={(id) => saveField("cliente_id", id)} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Data de Vencimento</label>
              <Input type="date" value={tarefa.data_vencimento || ""} onChange={(e) => saveField("data_vencimento", e.target.value)}
                className="mt-1 bg-card/50" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo</label>
              <select value={tarefa.tipo_tarefa || ""} onChange={(e) => saveField("tipo_tarefa", e.target.value)}
                className="mt-1 w-full text-sm bg-card/50 border border-border rounded-lg px-3 py-2">
                <option value="">Sem tipo</option>
                {tipoTarefaOpcoes.map((t) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Criada em</label>
              <p className="mt-1 text-sm text-muted-foreground">{tarefa.iniciado_em ? new Date(tarefa.iniciado_em).toLocaleString("pt-BR") : "—"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Histórico de Excluídas =====
interface TarefaExcluida extends Tarefa {
  deleted_at: string;
  deleted_by: string | null;
  deleted_by_nome: string;
}

function HistoricoExcluidas({ onRestored }: { onRestored: () => void }) {
  const [excluidas, setExcluidas] = useState<TarefaExcluida[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExcluidas = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/tarefas-kanban/excluidas").then((r) => r.json()).catch(() => []);
    if (Array.isArray(res)) setExcluidas(res);
    setLoading(false);
  }, []);

  useEffect(() => { loadExcluidas(); }, [loadExcluidas]);

  const restaurar = async (id: string) => {
    const res = await fetch("/api/tarefas-kanban/excluidas", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else { toast.success("Tarefa restaurada"); loadExcluidas(); onRestored(); }
  };

  const excluirPermanente = async (id: string) => {
    if (!confirm("Excluir permanentemente? Esta ação não pode ser desfeita.")) return;
    const res = await fetch(`/api/tarefas-kanban/excluidas?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else { toast.success("Excluída permanentemente"); loadExcluidas(); }
  };

  const STATUS_LABELS: Record<string, string> = { a_fazer: "A Fazer", fazendo: "Fazendo", concluido: "Concluído" };

  if (loading) return <p className="text-xs text-muted-foreground text-center py-8">Carregando...</p>;

  if (excluidas.length === 0) {
    return (
      <div className="text-center py-12">
        <Archive size={32} className="mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma tarefa excluída</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">Tarefas excluídas ficam aqui por 30 dias antes da remoção automática</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground mb-3">Tarefas excluídas são removidas permanentemente após 30 dias.</p>
      {excluidas.map((t) => (
        <div key={t.id} className="p-3 rounded-lg border border-border/50 bg-card/50 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{t.titulo}</p>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><User size={9} /> {t.responsavel || "—"}</span>
              <span>|</span>
              <span>Status: {STATUS_LABELS[t.status] || t.status}</span>
              {t.cliente && <><span>|</span><span className="text-purple-400">{t.cliente}</span></>}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground/60">
              <span>Excluída em {new Date(t.deleted_at).toLocaleString("pt-BR")}</span>
              <span>por {t.deleted_by_nome}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => restaurar(t.id)}>
              <RotateCcw size={10} /> Restaurar
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1" onClick={() => excluirPermanente(t.id)}>
              <Trash2 size={10} /> Excluir
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== Componente principal =====
export function TarefasKanban({ filtroResponsavel, filtroResponsavelId }: { filtroResponsavel?: string; filtroResponsavelId?: string } = {}) {
  const { user } = useAuth();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clientesEntrada, setClientesEntrada] = useState<ClienteReceita[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formDefaultStatus, setFormDefaultStatus] = useState("a_fazer");
  const [tick, setTick] = useState(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const [detalheTarefa, setDetalheTarefa] = useState<Tarefa | null>(null);
  const [filtroResp, setFiltroResp] = useState(filtroResponsavel || "");
  const [filtroRespId, setFiltroRespId] = useState(filtroResponsavelId || "");
  const [showExcluidas, setShowExcluidas] = useState(false);
  const [tipoTarefaOpcoes, setTipoTarefaOpcoes] = useState<TipoTarefaOpcao[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroRespId) params.set("responsavel_id", filtroRespId);
    else if (filtroResp) params.set("responsavel", filtroResp);
    const q = params.toString() ? `?${params.toString()}` : "";

    const [tRes, cRes, eRes, tiposRes] = await Promise.all([
      fetch(`/api/tarefas-kanban${q}`).then((r) => r.json()),
      fetch("/api/tarefas-kanban/clientes").then((r) => r.json()).catch(() => []),
      fetch("/api/tarefas-kanban/employees").then((r) => r.json()).catch(() => []),
      fetch("/api/tarefas-kanban/tipo-tarefa-opcoes").then((r) => r.json()).catch(() => []),
    ]);
    if (Array.isArray(tRes)) setTarefas(tRes);
    if (Array.isArray(cRes)) setClientesEntrada(cRes);
    if (Array.isArray(eRes)) setEmployees(eRes);
    if (Array.isArray(tiposRes)) setTipoTarefaOpcoes(tiposRes);
    setLoading(false);
  }, [filtroResp, filtroRespId]);

  useEffect(() => { load(); }, [load]);

  // Tick a cada segundo para atualizar o cronômetro
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const openFormWithStatus = (status: string) => {
    setFormDefaultStatus(status);
    setShowForm(true);
  };

  const moverStatus = async (id: string, novoStatus: string) => {
    setTarefas((prev) => prev.map((t) => t.id === id ? { ...t, status: novoStatus } : t));
    const res = await fetch("/api/tarefas-kanban", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: novoStatus }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); load(); }
    else load();
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

  // Resolve nome do responsável a partir de employees (fallback para campo texto)
  const getResponsavelNome = (t: Tarefa) => {
    if (t.responsavel_id) {
      const emp = employees.find((e) => e.id === t.responsavel_id);
      if (emp) return emp.nome;
    }
    return t.responsavel || "—";
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  const responsaveisUnicos = Array.from(new Set(tarefas.map((t) => t.responsavel).filter(Boolean))).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Tarefas Kanban</h1>
        <div className="flex items-center gap-2">
          {!filtroResponsavel && !filtroResponsavelId && (
            <select value={filtroRespId || filtroResp} onChange={(e) => {
              const val = e.target.value;
              // Check if it's a UUID (employee id) or name
              const emp = employees.find((emp) => emp.id === val);
              if (emp) { setFiltroRespId(val); setFiltroResp(""); }
              else { setFiltroResp(val); setFiltroRespId(""); }
            }} className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
              <option value="">Todos Responsáveis</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              {/* Fallback: responsáveis de texto que não têm employee match */}
              {responsaveisUnicos
                .filter((r) => !employees.some((e) => e.nome === r))
                .map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          <Button size="sm" variant={showExcluidas ? "secondary" : "ghost"} onClick={() => setShowExcluidas(!showExcluidas)}>
            <Archive size={14} className="mr-1" />{showExcluidas ? "Voltar" : "Lixeira"}
          </Button>
          <Button size="sm" onClick={() => openFormWithStatus("a_fazer")}>
            <Plus size={14} className="mr-1" />Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Modal nova tarefa */}
      {showForm && (
        <NovaTarefaModal
          employees={employees}
          clientes={clientesEntrada}
          tipoTarefaOpcoes={tipoTarefaOpcoes}
          session={user ? { employeeId: user.employeeId, nome: user.nome } : null}
          defaultStatus={formDefaultStatus}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {/* Histórico de excluídas */}
      {showExcluidas && <HistoricoExcluidas onRestored={load} />}

      {/* Kanban */}
      {!showExcluidas && <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                  const atrasada = isAtrasada(t);
                  return (
                    <div key={t.id} draggable onDragStart={() => handleDragStart(t.id)}
                      onClick={() => setDetalheTarefa(t)}
                      className={`p-2.5 rounded-lg border bg-card transition-colors cursor-grab active:cursor-grabbing hover:border-primary/50 ${dragging === t.id ? "opacity-50" : ""} ${atrasada ? "border-red-500/50" : ""}`}>
                      <div className="flex items-start gap-1.5">
                        <GripVertical size={12} className="text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{t.titulo}</p>
                            <div className="flex items-center gap-1 shrink-0">
                              {atrasada && <Badge className="bg-red-500/15 text-red-400 border-0 text-[8px]">Atrasada</Badge>}
                              <button onClick={(e) => { e.stopPropagation(); deletarTarefa(t.id); }} className="text-muted-foreground hover:text-red-400">
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                          {t.cliente && (
                            <p className="text-[10px] text-purple-400 truncate">{t.cliente}</p>
                          )}
                          {t.descricao && <p className="text-[10px] text-muted-foreground line-clamp-2">{t.descricao}</p>}
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge className={`text-[8px] ${URGENCIA_COLORS[t.urgencia] || "bg-muted"}`}>{t.urgencia}</Badge>
                            {t.setor && <Badge className="text-[8px] bg-muted text-muted-foreground">{t.setor}</Badge>}
                            {t.tipo_tarefa && (() => {
                              const tipo = tipoTarefaOpcoes.find((o) => o.nome === t.tipo_tarefa);
                              const cor = tipo?.cor || "#6366f1";
                              return <Badge className="text-[8px] border-0" style={{ backgroundColor: cor + "26", color: cor }}>{t.tipo_tarefa}</Badge>;
                            })()}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><User size={9} /> {getResponsavelNome(t)}</span>
                            {t.data_vencimento && <span>{new Date(t.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>}
                          </div>
                          {t.solicitante && <p className="text-[9px] text-muted-foreground">Solicitante: {t.solicitante}</p>}
                          {/* Cronômetro */}
                          {(t.em_andamento || tempoReal > 0) && (
                            <div className="flex items-center gap-2 pt-1 border-t">
                              <Clock size={10} className={t.em_andamento ? "text-green-400" : "text-muted-foreground"} />
                              <span className={`text-[10px] font-mono ${t.em_andamento ? "text-green-400" : "text-muted-foreground"}`}>
                                {t.em_andamento ? formatTempoHMS(tempoReal) : formatTempo(tempoReal)}
                              </span>
                              {t.em_andamento && t.status !== "concluido" && (
                                <button onClick={(e) => { e.stopPropagation(); toggleTimer(t.id); }}
                                  className="ml-auto text-muted-foreground hover:text-primary">
                                  <Pause size={12} />
                                </button>
                              )}
                              {!t.em_andamento && t.status === "fazendo" && !t.cronometro_encerrado && (
                                <button onClick={(e) => { e.stopPropagation(); toggleTimer(t.id); }}
                                  className="ml-auto text-muted-foreground hover:text-primary">
                                  <Play size={12} />
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
                {/* Botão inline + Adicionar tarefa */}
                <button
                  onClick={() => openFormWithStatus(col.key)}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg border border-dashed border-transparent hover:border-border transition-all flex items-center justify-center gap-1"
                >
                  <Plus size={12} /> Adicionar tarefa
                </button>
              </div>
            </div>
          );
        })}
      </div>}

      {detalheTarefa && (
        <TarefaDetalheModal
          tarefa={detalheTarefa}
          employees={employees}
          clientes={clientesEntrada}
          tipoTarefaOpcoes={tipoTarefaOpcoes}
          onClose={() => setDetalheTarefa(null)}
          onSaved={() => { setDetalheTarefa(null); load(); }}
        />
      )}
    </div>
  );
}
