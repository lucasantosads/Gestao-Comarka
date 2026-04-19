"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { RefreshCw, AlertTriangle, Search, ChevronDown, ChevronRight, Bell, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { Cliente } from "@/lib/data";
import { Badge } from "@/components/ui/badge";

const STATUS_GROUP_COLORS: Record<string, string> = {
  "Ativo": "text-green-400 border-green-500/20 bg-green-500/5",
  "Planejamento": "text-blue-400 border-blue-500/20 bg-blue-500/5",
  "Pausado": "text-yellow-400 border-yellow-500/20 bg-yellow-500/5",
  "Aviso 30 dias": "text-orange-400 border-orange-500/20 bg-orange-500/5",
  "Inadimplente": "text-red-400 border-red-500/20 bg-red-500/5",
  "Finalizado": "text-slate-400 border-slate-500/20 bg-slate-500/5",
  "Não iniciado": "text-purple-400 border-purple-500/20 bg-purple-500/5",
  "Sem status": "text-muted-foreground border-border bg-muted/10",
};
const STATUS_GROUP_ORDER = ["Ativo", "Planejamento", "Pausado", "Aviso 30 dias", "Inadimplente", "Não iniciado", "Finalizado", "Sem status"];

const STATUS_OPTS = ["Ativo", "Planejamento", "Pausado", "Aviso 30 dias", "Inadimplente", "Finalizado", "Não iniciado"];
const STATUS_COLORS: Record<string, string> = {
  "Ativo": "bg-green-500/15 text-green-400",
  "Planejamento": "bg-blue-500/15 text-blue-400",
  "Pausado": "bg-yellow-500/15 text-yellow-400",
  "Aviso 30 dias": "bg-orange-500/15 text-orange-400",
  "Inadimplente": "bg-red-500/15 text-red-400",
  "Finalizado": "bg-slate-500/15 text-slate-300",
  "Não iniciado": "bg-purple-500/15 text-purple-400",
};
const SITUACAO_OPTS = ["Melhorando", "Estável", "Piorando"];
const RESULTADOS_OPTS = ["Ótimos", "Bons", "Médios", "Ruins", "Péssimos"];
const ATENCAO_OPTS = ["Ouro", "Prata", "Bronze"];

const SITUACAO_COLORS: Record<string, string> = {
  "Estável": "bg-blue-500/15 text-blue-400",
  "Melhorando": "bg-green-500/15 text-green-400",
  "Piorando": "bg-red-500/15 text-red-400",
};
const RESULTADOS_COLORS: Record<string, string> = {
  "Ótimos": "bg-green-500/15 text-green-400",
  "Bons": "bg-blue-500/15 text-blue-400",
  "Médios": "bg-yellow-500/15 text-yellow-400",
  "Ruins": "bg-orange-500/15 text-orange-400",
  "Péssimos": "bg-red-500/15 text-red-400",
};
const ATENCAO_COLORS: Record<string, string> = {
  "Ouro": "bg-yellow-500/15 text-yellow-400",
  "Prata": "bg-slate-400/15 text-slate-300",
  "Bronze": "bg-orange-500/15 text-orange-400",
};
const RISCO_CHURN_COLORS: Record<string, string> = {
  "baixo": "bg-green-500/15 text-green-400",
  "medio": "bg-yellow-500/15 text-yellow-400",
  "alto": "bg-red-500/15 text-red-400",
};
const RISCO_LABELS: Record<string, string> = { "baixo": "Baixo", "medio": "Médio", "alto": "Alto" };

function InlineSelect({ value, options, onChange, colors }: {
  value: string; options: string[]; onChange: (v: string) => void; colors?: Record<string, string>;
}) {
  const cls = colors?.[value] || "bg-muted text-muted-foreground";
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={`text-[10px] rounded-full px-2 py-0.5 border-0 cursor-pointer ${cls}`}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function InlineNumber({ value, onChange, locked }: { value: number; onChange: (v: number) => void; locked?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value || 0));
  if (locked) {
    return (
      <span className="font-mono text-muted-foreground" title="Soma das teses (editar nas teses)">
        {value > 0 ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"} 🔒
      </span>
    );
  }
  if (!editing) {
    return (
      <button onClick={() => { setVal(String(value || 0)); setEditing(true); }} className="font-mono text-muted-foreground hover:text-foreground hover:underline">
        {value > 0 ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
      </button>
    );
  }
  return (
    <input type="number" value={val} autoFocus
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => { onChange(Number(val)); setEditing(false); }}
      onKeyDown={(e) => { if (e.key === "Enter") { onChange(Number(val)); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
      className="w-24 text-xs bg-transparent border rounded px-1 py-0.5 text-right font-mono" />
  );
}

function InlineDate({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const diasAtras = value ? Math.floor((Date.now() - new Date(value).getTime()) / 86400000) : null;
  const vencido = diasAtras !== null && diasAtras > 10;
  return (
    <div className="flex items-center gap-1">
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
        className={`text-[10px] bg-transparent border rounded px-1 py-0.5 w-[110px] ${vencido ? "border-red-500/50 text-red-400" : ""}`} />
      {vencido && <span className="text-[9px] text-red-400">{diasAtras}d</span>}
    </div>
  );
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroAnalista, setFiltroAnalista] = useState("todos");
  const [filtroNicho, setFiltroNicho] = useState("todos");
  const [comAlertas, setComAlertas] = useState(false);
  const [analistasDisponiveis, setAnalistasDisponiveis] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    "Finalizado": true, "Inadimplente": true, "Sem status": true,
  });
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false);
  const [divergencia, setDivergencia] = useState<{ status: string; divergencia: number; clientes_divergentes: Record<string, string[]> | null; id?: string } | null>(null);
  const [showDivModal, setShowDivModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/dashboard/clientes");
    const data = await res.json();
    if (!data.error) setClientes(data);
    setLoading(false);
    setLastSync(new Date());
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/dashboard/analistas").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setAnalistasDisponiveis(d.map((a: { nome: string }) => a.nome).sort());
    });
    // Carregar divergência
    fetch("/api/clientes/consistencia-log").then((r) => r.json()).then((d) => {
      const pendente = (d.registros || []).find((r: { status: string; resolvido: boolean }) => r.status === "divergencia_detectada" && !r.resolvido);
      if (pendente) setDivergencia(pendente);
    }).catch(() => {});
  }, []);

  const update = async (notionId: string, field: string, value: string) => {
    // Validação de churn: só para clientes ativos
    if (field === "status" && value === "Finalizado") {
      const cliente = clientes.find((c) => c.notion_id === notionId);
      if (cliente && cliente.status !== "Ativo" && cliente.status !== "Pausado") {
        toast.error("Churn só pode ser registrado para clientes ativos ou pausados.");
        return;
      }
    }
    setClientes((prev) => prev.map((c) => c.notion_id === notionId ? { ...c, [field]: value } : c));
    const res = await fetch("/api/dashboard/clientes", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notion_id: notionId, field, value }),
    });
    const data = await res.json();
    if (!data.success) { toast.error(data.error || "Erro ao atualizar"); load(); }
    else toast.success("Atualizado");
  };

  const analistas = Array.from(new Set(clientes.map((c) => c.analista).filter(Boolean))).sort();
  const nichos = Array.from(new Set(clientes.map((c) => c.nicho).filter(Boolean))).sort();

  // Fase 7: alertas para gestores (teses, otimizações, CRM, SDR/Closer)
  // Só dispara em dias úteis — função pura usando Date atual
  const hojeDate = new Date();
  const isWeekendNow = hojeDate.getDay() === 0 || hojeDate.getDay() === 6;

  type ClienteAlerta = Cliente & {
    teses_count?: number;
    teses_ativas_count?: number;
    primeira_tese_created_at?: string | null;
    ultima_otimizacao_data?: string | null;
    ultima_otimizacao_confirmada_em?: string | null;
    ghl_subaccount_id?: string | null;
    fechamento?: { sdr_nome: string | null; closer_nome: string | null };
  };

  const alertasGestor = (c: Cliente): { tipo: string; label: string; cls: string }[] => {
    if (isWeekendNow) return [];
    const ca = c as ClienteAlerta;
    const alertas: { tipo: string; label: string; cls: string }[] = [];
    const red = "bg-red-500/15 text-red-400";
    const orange = "bg-orange-500/15 text-orange-400";

    // 1. Teses vazias ou sem Ativa há mais de 7 dias do cadastro
    const temTeseAtiva = (ca.teses_ativas_count || 0) > 0;
    if (!temTeseAtiva) {
      const primeira = ca.primeira_tese_created_at;
      // Usa primeira_tese_created_at se houver; caso contrário, usa hoje (só dispara se tiver 7+ dias de cadastro no dashboard)
      const base = primeira ? new Date(primeira) : null;
      if (!base || (Date.now() - base.getTime()) / 86400000 > 7) {
        alertas.push({ tipo: "teses", label: "Sem tese ativa há >7d", cls: orange });
      }
    }

    // 2. Nenhuma otimização nos últimos 30 dias
    const ultimaOtim = ca.ultima_otimizacao_data;
    if (!ultimaOtim) {
      alertas.push({ tipo: "otim-30d", label: "Nenhuma otimização registrada", cls: orange });
    } else {
      const dias = Math.floor((Date.now() - new Date(ultimaOtim + "T12:00:00").getTime()) / 86400000);
      if (dias > 30) alertas.push({ tipo: "otim-30d", label: `Última otimização há ${dias}d`, cls: orange });
    }

    // 3. Otimização "Pendente" há mais de 5 dias sem confirmação
    if (ultimaOtim && !ca.ultima_otimizacao_confirmada_em) {
      const dias = Math.floor((Date.now() - new Date(ultimaOtim + "T12:00:00").getTime()) / 86400000);
      if (dias > 5) alertas.push({ tipo: "otim-pendente", label: `Otimização pendente há ${dias}d`, cls: red });
    }

    // 4. CRM ausente
    if (!ca.ghl_subaccount_id) {
      alertas.push({ tipo: "crm", label: "Configuração CRM ausente", cls: orange });
    }

    // 5. SDR ou Closer não atribuído
    if (!ca.fechamento?.sdr_nome) alertas.push({ tipo: "sdr", label: "SDR não atribuído", cls: red });
    if (!ca.fechamento?.closer_nome) alertas.push({ tipo: "closer", label: "Closer não atribuído", cls: red });

    return alertas;
  };

  const [showAlertasModal, setShowAlertasModal] = useState(false);
  const [alertasExpandidos, setAlertasExpandidos] = useState<Record<string, boolean>>({});

  // helper de alertas por cliente
  const alertasDoCliente = (c: Cliente) => {
    const alertas: { tipo: "verificacao" | "briefing" | "gestor" | "reuniao"; label: string; icon: string; cls: string }[] = [];
    if (c.ultima_verificacao) {
      const dias = Math.floor((Date.now() - new Date(c.ultima_verificacao as string).getTime()) / 86400000);
      if (dias > 7) alertas.push({ tipo: "verificacao", label: `Verificação ${dias}d`, icon: "⚠️", cls: "bg-yellow-500/15 text-yellow-400" });
    } else {
      alertas.push({ tipo: "verificacao", label: "Sem verificação", icon: "⚠️", cls: "bg-yellow-500/15 text-yellow-400" });
    }
    if (!c.briefing_preenchido) alertas.push({ tipo: "briefing", label: "Briefing pendente", icon: "🔴", cls: "bg-red-500/15 text-red-400" });
    if (!c.analista) alertas.push({ tipo: "gestor", label: "Sem gestor", icon: "🔴", cls: "bg-red-500/15 text-red-400" });
    if (c.ultima_reuniao) {
      const dias = Math.floor((Date.now() - new Date(c.ultima_reuniao as string).getTime()) / 86400000);
      if (dias > 30) alertas.push({ tipo: "reuniao", label: `Reunião ${dias}d`, icon: "🟡", cls: "bg-yellow-500/15 text-yellow-400" });
    } else {
      alertas.push({ tipo: "reuniao", label: "Sem reunião", icon: "🟡", cls: "bg-yellow-500/15 text-yellow-400" });
    }
    return alertas;
  };

  let filtered = clientes;
  if (!mostrarFinalizados) filtered = filtered.filter((c) => c.status !== "Finalizado");
  if (filtroStatus !== "todos") filtered = filtered.filter((c) => c.status === filtroStatus);
  if (filtroAnalista !== "todos") filtered = filtered.filter((c) => c.analista === filtroAnalista);
  if (filtroNicho !== "todos") filtered = filtered.filter((c) => c.nicho === filtroNicho);
  if (comAlertas) filtered = filtered.filter((c) => alertasDoCliente(c).length > 0);
  if (busca) { const q = busca.toLowerCase(); filtered = filtered.filter((c) => c.nome.toLowerCase().includes(q)); }

  // Agrega alertas globais (Fase 7)
  const alertasPorCliente = clientes.map((c) => ({ cliente: c, alertas: alertasGestor(c) }));
  const totalAlertasGestor = alertasPorCliente.reduce((s, x) => s + x.alertas.length, 0);
  const clientesComAlertas = alertasPorCliente.filter((x) => x.alertas.length > 0);

  // Alertas
  const feedbackVencidos = clientes.filter((c) => {
    if (!c.ultimo_feedback || c.status !== "Ativo") return false;
    return Math.floor((Date.now() - new Date(c.ultimo_feedback).getTime()) / 86400000) > 10;
  });
  const piorando = clientes.filter((c) => c.situacao === "Piorando" || c.situacao === "Crítico");

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
            <input type="checkbox" checked={mostrarFinalizados} onChange={(e) => setMostrarFinalizados(e.target.checked)} />
            Mostrar finalizados
          </label>
          <button onClick={() => setShowAlertasModal(true)} className="relative p-1.5 rounded-lg border hover:bg-muted/20" title="Alertas de gestão">
            <Bell size={14} className={totalAlertasGestor > 0 ? "text-orange-400" : "text-muted-foreground"} />
            {totalAlertasGestor > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center font-bold">
                {totalAlertasGestor}
              </span>
            )}
          </button>
          <Link href="/dashboard/clientes/nps">
            <Button size="sm" variant="outline" title="NPS & Performance">
              ⭐ NPS
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw size={14} className="mr-1" />Atualizar
          </Button>
          {lastSync && <span className="text-[10px] text-muted-foreground">{lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
      </div>

      {/* Alertas (colapsáveis por padrão) */}
      {(feedbackVencidos.length > 0 || piorando.length > 0) && (
        <div className="space-y-2">
          {feedbackVencidos.length > 0 && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <button
                onClick={() => setAlertasExpandidos((p) => ({ ...p, feedback: !p.feedback }))}
                className="w-full p-3 flex items-center gap-2 hover:bg-red-500/5 transition-colors"
              >
                {alertasExpandidos.feedback ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <AlertTriangle size={14} className="shrink-0" />
                <strong>{feedbackVencidos.length} clientes</strong>
                <span className="text-red-400/70">com feedback vencido (&gt;10 dias)</span>
              </button>
              {alertasExpandidos.feedback && (
                <div className="px-3 pb-3 pl-11 text-red-400/80">
                  {feedbackVencidos.slice(0, 5).map((c) => c.nome).join(", ")}{feedbackVencidos.length > 5 ? "..." : ""}
                </div>
              )}
            </div>
          )}
          {piorando.length > 0 && (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
              <button
                onClick={() => setAlertasExpandidos((p) => ({ ...p, piorando: !p.piorando }))}
                className="w-full p-3 flex items-center gap-2 hover:bg-yellow-500/5 transition-colors"
              >
                {alertasExpandidos.piorando ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <AlertTriangle size={14} className="shrink-0" />
                <strong>{piorando.length} clientes</strong>
                <span className="text-yellow-400/70">com situação piorando/crítica</span>
              </button>
              {alertasExpandidos.piorando && (
                <div className="px-3 pb-3 pl-11 text-yellow-400/80">
                  {piorando.slice(0, 5).map((c) => c.nome).join(", ")}{piorando.length > 5 ? "..." : ""}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alerta de divergência Entrada vs Churn (5e) */}
      {divergencia && divergencia.divergencia > 0 && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          <button
            onClick={() => setAlertasExpandidos((p) => ({ ...p, divergencia: !p.divergencia }))}
            className="w-full p-3 flex items-center gap-2 hover:bg-red-500/5 transition-colors"
          >
            {alertasExpandidos.divergencia ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <ShieldAlert size={14} className="shrink-0" />
            <span className="font-medium">Divergência Entrada vs Churn detectada</span>
            <span className="text-red-400/70">({divergencia.divergencia} cliente{divergencia.divergencia > 1 ? "s" : ""})</span>
          </button>
          {alertasExpandidos.divergencia && (
            <div className="px-3 pb-3 pl-11 flex items-center justify-between gap-3">
              <p>{divergencia.divergencia} cliente(s) com inconsistência entre os módulos.</p>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setShowDivModal(true)} className="px-2 py-1 border border-red-500/30 rounded hover:bg-red-500/20 text-[10px]">Ver detalhes</button>
                <button onClick={async () => {
                  if (divergencia.id) {
                    await fetch("/api/clientes/consistencia-log", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: divergencia.id }) });
                    setDivergencia(null);
                    toast.success("Marcado como resolvido");
                  }
                }} className="px-2 py-1 border border-red-500/30 rounded hover:bg-red-500/20 text-[10px]">Marcar resolvido</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3 text-center">
          <p className="text-xs text-muted-foreground">Clientes na casa</p>
          <p className="text-xl font-bold">{clientes.filter((c) => ["Ativo", "Não iniciado", "Pausado", "Planejamento"].includes(c.status)).length}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">Ativos + N. Iniciado + Pausado + Plan.</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center">
          <p className="text-xs text-muted-foreground">Bons + Ótimos</p>
          <p className="text-xl font-bold text-green-400">{clientes.filter((c) => c.resultados === "Bons" || c.resultados === "Ótimos").length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center">
          <p className="text-xs text-muted-foreground">Piorando</p>
          <p className="text-xl font-bold text-yellow-400">{piorando.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center">
          <p className="text-xs text-muted-foreground">Feedback Vencido</p>
          <p className="text-xl font-bold text-red-400">{feedbackVencidos.length}</p>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
          <option value="todos">Todos os Status</option>
          {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filtroAnalista} onChange={(e) => setFiltroAnalista(e.target.value)} className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
          <option value="todos">Todos os Analistas</option>
          {analistas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filtroNicho} onChange={(e) => setFiltroNicho(e.target.value)} className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
          <option value="todos">Todos os Nichos</option>
          {nichos.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer px-2">
          <input type="checkbox" checked={comAlertas} onChange={(e) => setComAlertas(e.target.checked)} />
          Com alertas
        </label>
        <div className="relative flex-1 min-w-[150px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..."
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-transparent border rounded-lg" />
        </div>
      </div>

      {/* Grupos colapsáveis por Status */}
      <div className="space-y-3">
        {STATUS_GROUP_ORDER.map((statusKey) => {
          const grupoItens = filtered.filter((c) => (c.status || "Sem status") === statusKey);
          if (grupoItens.length === 0) return null;
          const isCollapsed = collapsedGroups[statusKey] ?? false;
          const colorCls = STATUS_GROUP_COLORS[statusKey] || STATUS_GROUP_COLORS["Sem status"];
          const totalOrcamento = grupoItens.reduce((s, c) => s + Number(c.orcamento || 0), 0);

          return (
            <div key={statusKey} className={`border rounded-lg overflow-hidden ${colorCls.split(" ").slice(1).join(" ")}`}>
              <button
                onClick={() => setCollapsedGroups((p) => ({ ...p, [statusKey]: !isCollapsed }))}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <span className={`text-sm font-medium ${colorCls.split(" ")[0]}`}>{statusKey}</span>
                  <span className="text-[10px] text-muted-foreground">({grupoItens.length})</span>
                </div>
                <span className="text-xs font-mono text-muted-foreground">{formatCurrency(totalOrcamento)}</span>
              </button>

              {!isCollapsed && (
                <div className="border-t overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b text-[10px] text-muted-foreground uppercase bg-muted/10">
                        <th className="py-2 px-2 text-left">Cliente</th>
                        <th className="py-2 px-2 text-left">Analista</th>
                        <th className="py-2 px-2 text-center">Status</th>
                        <th className="py-2 px-2 text-center">Situação</th>
                        <th className="py-2 px-2 text-center">Resultados</th>
                        <th className="py-2 px-2 text-center">Atenção</th>
                        <th className="py-2 px-2 text-center">Últ. Feedback</th>
                        <th className="py-2 px-2 text-center">Otimização</th>
                        <th className="py-2 px-2 text-right">Orçamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupoItens.map((c) => (
                        <tr key={c.notion_id} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="py-1.5 px-2 font-medium">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link href={`/dashboard/clientes/${c.notion_id}`} className="hover:underline hover:text-primary">{c.nome}</Link>
                              {(c as unknown as { fechamento?: { sdr_nome: string | null; closer_nome: string | null } }).fechamento?.sdr_nome && (
                                <span title={`SDR: ${(c as unknown as { fechamento: { sdr_nome: string } }).fechamento.sdr_nome}`}
                                  className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 text-[8px] font-bold flex items-center justify-center">
                                  {(c as unknown as { fechamento: { sdr_nome: string } }).fechamento.sdr_nome.charAt(0).toUpperCase()}
                                </span>
                              )}
                              {(c as unknown as { fechamento?: { closer_nome: string | null } }).fechamento?.closer_nome && (
                                <span title={`Closer: ${(c as unknown as { fechamento: { closer_nome: string } }).fechamento.closer_nome}`}
                                  className="w-4 h-4 rounded-full bg-green-500/20 text-green-300 text-[8px] font-bold flex items-center justify-center">
                                  {(c as unknown as { fechamento: { closer_nome: string } }).fechamento.closer_nome.charAt(0).toUpperCase()}
                                </span>
                              )}
                              {alertasDoCliente(c).map((a, i) => (
                                <span key={i} title={a.label} className={`text-[8px] px-1 py-0.5 rounded ${a.cls}`}>{a.icon}</span>
                              ))}
                              {/* Badge risco churn (5a) */}
                              {(() => {
                                const risco = (c as unknown as { risco_churn?: string }).risco_churn;
                                if (!risco) return <Badge variant="outline" className="text-[8px] px-1 py-0">Sem análise</Badge>;
                                return <Badge className={`text-[8px] px-1 py-0 ${RISCO_CHURN_COLORS[risco] || ""}`}>{RISCO_LABELS[risco] || risco}</Badge>;
                              })()}
                              {(() => {
                                const ag = alertasGestor(c);
                                if (ag.length === 0) return null;
                                return (
                                  <span title={ag.map((a) => a.label).join(" · ")}
                                    className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold border border-red-500/30">
                                    ⚠ {ag.length}
                                  </span>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="py-1.5 px-2">
                            <select value={c.analista || ""}
                              onChange={(e) => update(c.notion_id, "analista", e.target.value)}
                              className="text-[10px] bg-transparent border rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground cursor-pointer max-w-[130px]">
                              <option value="">—</option>
                              {analistasDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
                              {c.analista && !analistasDisponiveis.includes(c.analista) && (
                                <option value={c.analista}>{c.analista} (externo)</option>
                              )}
                            </select>
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <InlineSelect value={c.status} options={STATUS_OPTS} onChange={(v) => update(c.notion_id, "status", v)} colors={STATUS_COLORS} />
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <InlineSelect value={c.situacao} options={SITUACAO_OPTS} onChange={(v) => update(c.notion_id, "situacao", v)} colors={SITUACAO_COLORS} />
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <InlineSelect value={c.resultados} options={RESULTADOS_OPTS} onChange={(v) => update(c.notion_id, "resultados", v)} colors={RESULTADOS_COLORS} />
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <InlineSelect value={c.atencao} options={ATENCAO_OPTS} onChange={(v) => update(c.notion_id, "atencao", v)} colors={ATENCAO_COLORS} />
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <InlineDate value={c.ultimo_feedback} onChange={(v) => update(c.notion_id, "ultimo_feedback", v)} />
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <InlineDate value={c.ultima_otimizacao} onChange={(v) => update(c.notion_id, "ultima_otimizacao", v)} />
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <InlineNumber value={Number(c.orcamento || 0)} locked={c.tem_teses === "true"}
                              onChange={(v) => update(c.notion_id, "orcamento", String(v))} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <Card><CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
          </CardContent></Card>
        )}
      </div>

      {/* Modal: alertas globais de gestão (Fase 7) */}
      {/* Modal de divergência Entrada vs Churn (5e) */}
      {showDivModal && divergencia?.clientes_divergentes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowDivModal(false)}>
          <div className="bg-background border rounded-lg max-w-lg w-full max-h-[60vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ShieldAlert size={14} className="text-red-400" />
                Clientes divergentes ({divergencia.divergencia})
              </h2>
              <button onClick={() => setShowDivModal(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-xs">
              {Object.entries(divergencia.clientes_divergentes).map(([tipo, nomes]) => (
                (nomes as string[]).length > 0 && (
                  <div key={tipo}>
                    <p className="text-muted-foreground font-medium mb-1">{tipo.replace(/_/g, " ")}</p>
                    <div className="flex flex-wrap gap-1">
                      {(nomes as string[]).map((n, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{n}</Badge>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      )}

      {showAlertasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAlertasModal(false)}>
          <div className="bg-background border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Bell size={14} className="text-orange-400" />
                Alertas de gestão ({totalAlertasGestor})
              </h2>
              <button onClick={() => setShowAlertasModal(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {isWeekendNow && (
                <p className="text-[10px] text-muted-foreground italic">Alertas não disparam aos fins de semana.</p>
              )}
              {clientesComAlertas.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum alerta pendente 🎉</p>
              ) : (
                clientesComAlertas.map(({ cliente, alertas }) => (
                  <div key={cliente.notion_id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/dashboard/clientes/${cliente.notion_id}`} className="text-xs font-medium hover:underline hover:text-primary">
                        {cliente.nome}
                      </Link>
                      <span className="text-[10px] text-muted-foreground">{alertas.length} alerta{alertas.length > 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {alertas.map((a, i) => (
                        <span key={i} className={`text-[10px] px-2 py-0.5 rounded ${a.cls}`}>{a.label}</span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
