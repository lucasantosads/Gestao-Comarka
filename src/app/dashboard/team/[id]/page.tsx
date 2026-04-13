"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, Save, AlertTriangle, ChevronDown, ChevronRight, Search, Bell, MessageSquarePlus, History, Heart, Star } from "lucide-react";
import Link from "next/link";
import type { TeamMember, Cliente, Tarefa, Reuniao } from "@/lib/data";
import { TarefasKanban } from "@/components/tarefas/tarefas-kanban";
import { PortalColaborador } from "@/components/team/portal-colaborador";
import { ComissaoCard } from "@/components/team/comissao-card";
import { UserCircle } from "lucide-react";

// Alinhado com /dashboard/clientes (fonte única: clientes_notion_mirror via /api/dashboard/clientes)
const STATUS_OPTS = ["Ativo", "Planejamento", "Pausado", "Aviso 30 dias", "Inadimplente", "Finalizado", "Não iniciado"];
const SITUACAO_OPTS = ["Melhorando", "Estável", "Piorando"];
const RESULTADOS_OPTS = ["Ótimos", "Bons", "Médios", "Ruins", "Péssimos"];
const STATUS_COLORS: Record<string, string> = {
  "Ativo": "bg-green-500/15 text-green-400",
  "Planejamento": "bg-blue-500/15 text-blue-400",
  "Pausado": "bg-yellow-500/15 text-yellow-400",
  "Aviso 30 dias": "bg-orange-500/15 text-orange-400",
  "Inadimplente": "bg-red-500/15 text-red-400",
  "Finalizado": "bg-slate-500/15 text-slate-300",
  "Não iniciado": "bg-purple-500/15 text-purple-400",
};
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

export default function TeamMemberPage() {
  const { id } = useParams();
  const [membro, setMembro] = useState<TeamMember | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [loading, setLoading] = useState(true);
  const [funcoes, setFuncoes] = useState("");
  const [savingFuncoes, setSavingFuncoes] = useState(false);
  const [clientesCollapsed, setClientesCollapsed] = useState(true);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("todos");
  const [filtroResultados, setFiltroResultados] = useState("todos");
  const [meNome, setMeNome] = useState<string>("");
  const [meRole, setMeRole] = useState<string>("");
  const [showPortal, setShowPortal] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [alertasCollapsed, setAlertasCollapsed] = useState(true);
  // map cliente_notion_id -> { ultimo: string|null; total_30d: number }
  const [feedbackAgg, setFeedbackAgg] = useState<Record<string, { ultimo: string | null; total_30d: number }>>({});
  const [comercial, setComercial] = useState<{
    tipo: "closer" | "sdr";
    id: string;
    lancamentos: { reunioes_marcadas: number; reunioes_feitas: number; ganhos: number; mrr_dia: number; ltv: number; data: string }[];
    contratos: { cliente_nome: string; mrr: number; data_fechamento: string; origem_lead: string }[];
    mes: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/notion/member/${id}`);
    const data = await res.json();
    if (!data.error) {
      setMembro(data.member);
      setFuncoes(data.member?.funcoes || "");
      setTarefas(data.tarefas || []);
      setReunioes(data.reunioes || []);

      // Puxa clientes da mesma fonte que /dashboard/clientes (mirror) e filtra por analista.
      // Garante edição bidirecional — UPDATE na mesma row de clientes_notion_mirror.
      try {
        const nomeFirst = (data.member?.nome || "").split(" ")[0].toLowerCase();
        const cRes = await fetch("/api/dashboard/clientes");
        const cData = await cRes.json();
        if (Array.isArray(cData)) {
          const meus = cData.filter((c: Cliente) => (c.analista || "").toLowerCase().includes(nomeFirst));
          setClientes(meus);
          // Carrega agregado de feedbacks dos meus clientes (último + total 30d) — uma única chamada
          if (meus.length > 0) {
            const ids = meus.map((c: Cliente) => c.notion_id).join(",");
            try {
              const fRes = await fetch(`/api/team/feedbacks?clientes=${encodeURIComponent(ids)}`);
              const fData = await fRes.json();
              if (!fData.error) setFeedbackAgg(fData);
            } catch {}
          }
        } else {
          setClientes(data.clientes || []);
        }
      } catch {
        setClientes(data.clientes || []);
      }
    }

    // Se é Closer ou SDR, carregar dados comerciais do Supabase
    const cargo = (data.member?.cargo || "").toLowerCase();
    const tipo: "closer" | "sdr" | null = cargo.includes("closer") ? "closer" : cargo.includes("sdr") ? "sdr" : null;
    if (tipo && data.member?.nome) {
      const { supabase } = await import("@/lib/supabase");
      const tabela = tipo === "closer" ? "closers" : "sdrs";
      const { data: pessoa } = await supabase.from(tabela).select("id").ilike("nome", `%${data.member.nome.split(" ")[0]}%`).maybeSingle();
      if (pessoa) {
        const hoje = new Date();
        const mesRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
        const campo = tipo === "closer" ? "closer_id" : "sdr_id";
        const [lancRes, contRes] = await Promise.all([
          supabase.from("lancamentos_diarios").select("*").eq(campo, pessoa.id).eq("mes_referencia", mesRef).order("data"),
          tipo === "closer"
            ? supabase.from("contratos").select("*").eq("closer_id", pessoa.id).eq("mes_referencia", mesRef).order("data_fechamento", { ascending: false })
            : Promise.resolve({ data: [] }),
        ]);
        setComercial({
          tipo, id: pessoa.id,
          lancamentos: lancRes.data || [],
          contratos: contRes.data || [],
          mes: mesRef,
        });
      }
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Sessão atual — usada para mostrar botão "Meu Portal" só ao próprio colaborador
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d) { setMeNome(d.nome || ""); setMeRole(d.role || ""); }
    }).catch(() => {});
  }, []);

  // Estado do accordion "Clientes Ativos" persistido por colaborador
  useEffect(() => {
    if (!id) return;
    const saved = localStorage.getItem(`team:${id}:clientesCollapsed`);
    if (saved !== null) setClientesCollapsed(saved === "1");
  }, [id]);
  const toggleClientes = () => {
    setClientesCollapsed((prev) => {
      const next = !prev;
      if (id) localStorage.setItem(`team:${id}:clientesCollapsed`, next ? "1" : "0");
      return next;
    });
  };

  const salvarFuncoes = async () => {
    if (!membro) return;
    setSavingFuncoes(true);
    const res = await fetch("/api/notion/update", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notion_id: membro.notion_id, field: "funcoes", value: funcoes }),
    });
    const data = await res.json();
    if (data.success) toast.success("Funções atualizadas");
    else toast.error(data.error || "Erro");
    setSavingFuncoes(false);
  };

  const updateCliente = async (notionId: string, field: string, value: string) => {
    setClientes((prev) => prev.map((c) => c.notion_id === notionId ? { ...c, [field]: value } : c));
    const res = await fetch("/api/dashboard/clientes", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notion_id: notionId, field, value }),
    });
    const data = await res.json();
    if (!data.success) { toast.error(data.error || "Erro"); load(); }
    else toast.success("Atualizado");
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!membro) return <div className="text-center py-12"><p className="text-muted-foreground">Membro não encontrado</p></div>;

  const ativos = clientes.filter((c) => c.status === "Ativo");
  const bons = ativos.filter((c) => c.resultados === "Bons" || c.resultados === "Ótimos").length;
  const melhorando = ativos.filter((c) => c.situacao === "Melhorando").length;
  const piorando = ativos.filter((c) => c.situacao === "Piorando");
  const feedbackVencido = ativos.filter((c) => c.ultimo_feedback && Math.floor((Date.now() - new Date(c.ultimo_feedback).getTime()) / 86400000) > 10);
  const orcTotal = ativos.reduce((s, c) => s + Number(c.orcamento || 0), 0);

  // ========================
  // Aba de Alertas (3C)
  // ========================
  const HOJE_TS = Date.now();
  // Detector de risco de churn (4D) — usado tanto na linha quanto nos alertas
  const churnRiskInfo = (c: Cliente): { atRisk: boolean; reasons: string[] } => {
    const reasons: string[] = [];
    if (c.situacao === "Piorando") reasons.push("Situação Piorando");
    if (c.ultimo_feedback) {
      const dias = Math.floor((HOJE_TS - new Date(c.ultimo_feedback).getTime()) / 86400000);
      if (dias > 10) reasons.push(`Último feedback há ${dias}d (>10d)`);
    } else {
      reasons.push("Sem último feedback registrado");
    }
    const agg = feedbackAgg[c.notion_id];
    if (agg && agg.total_30d === 0) reasons.push("Sem feedback em client_feedbacks (30d)");
    // Os 3 critérios precisam estar presentes simultaneamente
    return { atRisk: reasons.length === 3, reasons };
  };

  type Alerta = { tipo: "churn" | "critico" | "atencao" | "aviso" | "info"; cliente: Cliente; label: string };
  const alertas: Alerta[] = [];
  const HOJE = HOJE_TS;
  for (const c of clientes) {
    if (c.status === "Finalizado") continue;
    // 🔴 CRÍTICO — situação Piorando
    if (c.situacao === "Piorando") {
      alertas.push({ tipo: "critico", cliente: c, label: "Cliente piorando" });
    }
    // 🟠 ATENÇÃO — feedback vencido (>10d)
    if (c.ultimo_feedback) {
      const dias = Math.floor((HOJE_TS - new Date(c.ultimo_feedback).getTime()) / 86400000);
      if (dias > 10) alertas.push({ tipo: "atencao", cliente: c, label: `Feedback vencido há ${dias}d` });
    } else {
      alertas.push({ tipo: "atencao", cliente: c, label: "Sem feedback registrado" });
    }
    // 🟡 AVISO — nenhum registro em client_feedbacks nos últimos 30d
    const agg = feedbackAgg[c.notion_id];
    if (agg && agg.total_30d === 0) {
      alertas.push({ tipo: "aviso", cliente: c, label: "Sem feedback em client_feedbacks (30d)" });
    }
    // 🔵 INFO — orçamento sem crescimento há 60+ dias
    const ini = Number(c.orcamento_inicial || 0);
    const atu = Number(c.orcamento || 0);
    const upd = c.orcamento_atualizado_em ? new Date(c.orcamento_atualizado_em).getTime() : null;
    if (ini > 0 && atu === ini && upd && (HOJE - upd) / 86400000 >= 60) {
      alertas.push({ tipo: "info", cliente: c, label: "Orçamento estagnado há 60+ dias" });
    }
    // RISCO DE CHURN — 3 critérios simultâneos (4D)
    const risk = churnRiskInfo(c);
    if (risk.atRisk) {
      alertas.push({ tipo: "churn", cliente: c, label: `RISCO DE CHURN — ${risk.reasons.join(" · ")}` });
    }
  }
  const ALERT_STYLE: Record<Alerta["tipo"], { dot: string; cls: string; emoji: string; ord: number }> = {
    churn:   { dot: "bg-red-600", cls: "bg-red-600/15 text-red-200 border-red-600/40", emoji: "⚠️", ord: 0 },
    critico: { dot: "bg-red-500", cls: "bg-red-500/10 text-red-300 border-red-500/30", emoji: "🔴", ord: 1 },
    atencao: { dot: "bg-orange-500", cls: "bg-orange-500/10 text-orange-300 border-orange-500/30", emoji: "🟠", ord: 2 },
    aviso:   { dot: "bg-yellow-500", cls: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30", emoji: "🟡", ord: 3 },
    info:    { dot: "bg-blue-500", cls: "bg-blue-500/10 text-blue-300 border-blue-500/30", emoji: "🔵", ord: 4 },
  };
  alertas.sort((a, b) => ALERT_STYLE[a.tipo].ord - ALERT_STYLE[b.tipo].ord);
  const temAlertas = alertas.length > 0;

  // ========================
  // Saúde da Carteira (4C)
  // ========================
  const carteira = clientes.filter((c) => c.status !== "Finalizado");
  const carteiraScore = (() => {
    const n = carteira.length;
    if (n === 0) return null;
    const pct = (qty: number) => (qty / n) * 100;
    const okSituacao = carteira.filter((c) => c.situacao === "Estável" || c.situacao === "Melhorando").length;
    const okFeedback = carteira.filter((c) => {
      if (!c.ultimo_feedback) return false;
      const dias = Math.floor((HOJE - new Date(c.ultimo_feedback).getTime()) / 86400000);
      return dias <= 10;
    }).length;
    const okUpsell = carteira.filter((c) => {
      const ini = Number(c.orcamento_inicial || 0);
      const atu = Number(c.orcamento || 0);
      return ini > 0 && atu > ini;
    }).length;
    const okSemCritico = carteira.filter((c) => !churnRiskInfo(c).atRisk && c.situacao !== "Piorando").length;
    const score = pct(okSituacao) * 0.4 + pct(okFeedback) * 0.3 + pct(okUpsell) * 0.2 + pct(okSemCritico) * 0.1;
    return {
      score: Math.round(score),
      breakdown: {
        situacao: { qty: okSituacao, pct: pct(okSituacao) },
        feedback: { qty: okFeedback, pct: pct(okFeedback) },
        upsell: { qty: okUpsell, pct: pct(okUpsell) },
        semCritico: { qty: okSemCritico, pct: pct(okSemCritico) },
      },
    };
  })();
  const scoreColor = (s: number) => s >= 71 ? "text-green-400" : s >= 41 ? "text-yellow-400" : "text-red-400";
  const scoreBg = (s: number) => s >= 71 ? "border-green-500/30 bg-green-500/5" : s >= 41 ? "border-yellow-500/30 bg-yellow-500/5" : "border-red-500/30 bg-red-500/5";

  const irParaCliente = (notionId: string) => {
    setExpandedRow(notionId);
    if (clientesCollapsed) toggleClientes();
    setTimeout(() => {
      const el = document.getElementById(`cliente-row-${notionId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  // Tabela de clientes: filtragem client-side (não chama o banco novamente)
  const visiveis = clientes.filter((c) => c.status !== "Finalizado");
  const filtrados = visiveis.filter((c) => {
    if (filtroSituacao !== "todos" && c.situacao !== filtroSituacao) return false;
    if (filtroResultados !== "todos" && c.resultados !== filtroResultados) return false;
    if (buscaCliente && !c.nome.toLowerCase().includes(buscaCliente.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/team"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{membro.nome}</h1>
          <Badge className="text-xs bg-muted">{membro.cargo}</Badge>
        </div>
        {(() => {
          // "Meu Portal" só aparece para o próprio colaborador (match por primeiro nome)
          const isSelf = !!meNome && meNome.split(" ")[0].toLowerCase() === (membro.nome.split(" ")[0] || "").toLowerCase();
          const isAdmin = meRole === "admin";
          if (!isSelf && !isAdmin) return null;
          return (
            <Button size="sm" variant="outline" onClick={() => setShowPortal(true)}>
              <UserCircle size={14} className="mr-1" /> Meu Portal
            </Button>
          );
        })()}
      </div>

      {showPortal && (
        <PortalColaborador
          notionId={membro.notion_id}
          nome={membro.nome}
          cargoFallback={membro.cargo}
          onClose={() => setShowPortal(false)}
        />
      )}

      {/* Comissão do Mês (5C) — só renderiza se o membro for closer/sdr/social_seller e a sessão tiver permissão */}
      <ComissaoCard notionId={String(membro.notion_id)} />

      {/* Saúde da Carteira (4C) */}
      {carteiraScore && (
        <Card className={scoreBg(carteiraScore.score)}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Heart size={14} className={scoreColor(carteiraScore.score)} />
              Saúde da Carteira
              <span className={`ml-auto text-3xl font-bold tabular-nums ${scoreColor(carteiraScore.score)}`}>
                {carteiraScore.score}
                <span className="text-base text-muted-foreground">/100</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Situação OK <span className="text-muted-foreground/60">(40%)</span></p>
                <p className="text-lg font-bold mt-0.5">{carteiraScore.breakdown.situacao.qty}<span className="text-muted-foreground text-xs">/{carteira.length}</span></p>
                <p className="text-[10px] text-muted-foreground">{carteiraScore.breakdown.situacao.pct.toFixed(0)}% Estável/Melhorando</p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Feedback em dia <span className="text-muted-foreground/60">(30%)</span></p>
                <p className="text-lg font-bold mt-0.5">{carteiraScore.breakdown.feedback.qty}<span className="text-muted-foreground text-xs">/{carteira.length}</span></p>
                <p className="text-[10px] text-muted-foreground">{carteiraScore.breakdown.feedback.pct.toFixed(0)}% nos últimos 10d</p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Upsell positivo <span className="text-muted-foreground/60">(20%)</span></p>
                <p className="text-lg font-bold mt-0.5">{carteiraScore.breakdown.upsell.qty}<span className="text-muted-foreground text-xs">/{carteira.length}</span></p>
                <p className="text-[10px] text-muted-foreground">{carteiraScore.breakdown.upsell.pct.toFixed(0)}% acima do inicial</p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">Sem alerta crítico <span className="text-muted-foreground/60">(10%)</span></p>
                <p className="text-lg font-bold mt-0.5">{carteiraScore.breakdown.semCritico.qty}<span className="text-muted-foreground text-xs">/{carteira.length}</span></p>
                <p className="text-[10px] text-muted-foreground">{carteiraScore.breakdown.semCritico.pct.toFixed(0)}% saudáveis</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aba de Alertas (3C) */}
      <Card className={temAlertas ? "border-red-500/40" : ""}>
        <CardHeader
          className={`cursor-pointer select-none ${temAlertas ? "bg-red-500/10" : ""}`}
          onClick={() => setAlertasCollapsed((v) => !v)}
        >
          <CardTitle className="text-base flex items-center gap-2">
            {alertasCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            <Bell size={14} className={temAlertas ? "text-red-400" : "text-muted-foreground"} />
            Alertas
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${temAlertas ? "bg-red-500/20 text-red-300" : "bg-muted text-muted-foreground"}`}>
              {alertas.length}
            </span>
          </CardTitle>
        </CardHeader>
        {!alertasCollapsed && (
          <CardContent className="space-y-1.5">
            {alertas.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum alerta ativo 🎉</p>
            ) : (
              alertas.map((a, i) => {
                const st = ALERT_STYLE[a.tipo];
                return (
                  <button
                    key={`${a.cliente.notion_id}-${a.tipo}-${i}`}
                    onClick={() => irParaCliente(a.cliente.notion_id)}
                    className={`w-full flex items-center gap-3 text-left text-xs px-3 py-2 rounded-lg border ${st.cls} hover:opacity-90`}
                  >
                    <span>{st.emoji}</span>
                    <span className="font-medium">{a.cliente.nome}</span>
                    <span className="text-[10px] opacity-80">— {a.label}</span>
                  </button>
                );
              })
            )}
          </CardContent>
        )}
      </Card>

      {/* Funções editável */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2">
            <Input value={funcoes} onChange={(e) => setFuncoes(e.target.value)} placeholder="Funções e responsabilidades..."
              className="text-sm flex-1" />
            <Button size="sm" onClick={salvarFuncoes} disabled={savingFuncoes}>
              <Save size={14} className="mr-1" />{savingFuncoes ? "..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3 text-center">
          <p className="text-xs text-muted-foreground">Clientes Ativos</p>
          <p className="text-xl font-bold">{ativos.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center">
          <p className="text-xs text-muted-foreground">Orçamento Total</p>
          <p className="text-xl font-bold">{formatCurrency(orcTotal)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center">
          <p className="text-xs text-muted-foreground">% Bons+Ótimos</p>
          <p className="text-xl font-bold text-green-400">{ativos.length > 0 ? ((bons / ativos.length) * 100).toFixed(0) : 0}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center">
          <p className="text-xs text-muted-foreground">% Melhorando</p>
          <p className="text-xl font-bold text-blue-400">{ativos.length > 0 ? ((melhorando / ativos.length) * 100).toFixed(0) : 0}%</p>
        </CardContent></Card>
      </div>

      {/* Alertas */}
      {(piorando.length > 0 || feedbackVencido.length > 0) && (
        <div className="space-y-2">
          {piorando.length > 0 && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>Clientes piorando: {piorando.map((c) => c.nome).join(", ")}</span>
            </div>
          )}
          {feedbackVencido.length > 0 && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>Feedback vencido (&gt;10 dias): {feedbackVencido.map((c) => c.nome).join(", ")}</span>
            </div>
          )}
        </div>
      )}

      {/* Desempenho Comercial (Closer/SDR) */}
      {comercial && (() => {
        const totalMarcadas = comercial.lancamentos.reduce((s, l) => s + (l.reunioes_marcadas || 0), 0);
        const totalFeitas = comercial.lancamentos.reduce((s, l) => s + (l.reunioes_feitas || 0), 0);
        const totalGanhos = comercial.lancamentos.reduce((s, l) => s + (l.ganhos || 0), 0);
        const mrrTotal = comercial.lancamentos.reduce((s, l) => s + Number(l.mrr_dia || 0), 0);
        const ltvTotal = comercial.lancamentos.reduce((s, l) => s + Number(l.ltv || 0), 0);
        const taxaComp = totalMarcadas > 0 ? (totalFeitas / totalMarcadas) * 100 : 0;
        const taxaConv = totalFeitas > 0 ? (totalGanhos / totalFeitas) * 100 : 0;

        return (
          <Card className="border-blue-500/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {comercial.tipo === "closer" ? "🎯 Desempenho do Closer" : "📞 Desempenho do SDR"}
                  <Badge className="text-[9px] bg-blue-500/15 text-blue-400">{comercial.mes}</Badge>
                </CardTitle>
                <Link href={`/${comercial.tipo === "closer" ? "closer" : "relatorio-sdr"}/${comercial.id}`}>
                  <Button size="sm" variant="outline">Relatório completo</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* KPIs comerciais */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/20 text-center">
                  <p className="text-[10px] text-muted-foreground">Reuniões Marcadas</p>
                  <p className="text-xl font-bold">{totalMarcadas}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/20 text-center">
                  <p className="text-[10px] text-muted-foreground">Reuniões Feitas</p>
                  <p className="text-xl font-bold">{totalFeitas}</p>
                  {totalMarcadas > 0 && <p className="text-[9px] text-muted-foreground">{taxaComp.toFixed(0)}% comparecimento</p>}
                </div>
                {comercial.tipo === "closer" && (
                  <>
                    <div className="p-3 rounded-lg bg-muted/20 text-center">
                      <p className="text-[10px] text-muted-foreground">Contratos Fechados</p>
                      <p className="text-xl font-bold text-green-400">{totalGanhos}</p>
                      {totalFeitas > 0 && <p className="text-[9px] text-muted-foreground">{taxaConv.toFixed(0)}% conversão</p>}
                    </div>
                    <div className="p-3 rounded-lg bg-muted/20 text-center">
                      <p className="text-[10px] text-muted-foreground">MRR Gerado</p>
                      <p className="text-xl font-bold text-green-400">{formatCurrency(mrrTotal)}</p>
                      <p className="text-[9px] text-muted-foreground">LTV: {formatCurrency(ltvTotal)}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Contratos fechados no mês */}
              {comercial.contratos.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">Contratos Fechados ({comercial.contratos.length})</p>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {comercial.contratos.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-2 border rounded-lg text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.cliente_nome}</span>
                          {c.origem_lead && <Badge className="text-[8px] bg-muted">{c.origem_lead}</Badge>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{new Date(c.data_fechamento).toLocaleDateString("pt-BR")}</span>
                          <span className="font-mono text-green-400">{formatCurrency(Number(c.mrr))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Tabela de clientes (accordion + filtros client-side + edição bidirecional) */}
      <Card>
        <CardHeader className="cursor-pointer select-none" onClick={toggleClientes}>
          <CardTitle className="text-base flex items-center gap-2">
            {clientesCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            Clientes Ativos ({visiveis.length})
          </CardTitle>
        </CardHeader>
        {!clientesCollapsed && (
          <CardContent className="space-y-3">
            {/* Filtros rápidos */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[160px]">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-transparent border rounded-lg"
                />
              </div>
              <select
                value={filtroSituacao}
                onChange={(e) => setFiltroSituacao(e.target.value)}
                className="text-xs bg-transparent border rounded-lg px-3 py-1.5"
              >
                <option value="todos">Situação: todas</option>
                {SITUACAO_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={filtroResultados}
                onChange={(e) => setFiltroResultados(e.target.value)}
                className="text-xs bg-transparent border rounded-lg px-3 py-1.5"
              >
                <option value="todos">Resultados: todos</option>
                {RESULTADOS_OPTS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {(buscaCliente || filtroSituacao !== "todos" || filtroResultados !== "todos") && (
                <button
                  onClick={() => { setBuscaCliente(""); setFiltroSituacao("todos"); setFiltroResultados("todos"); }}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  limpar
                </button>
              )}
              <span className="text-[10px] text-muted-foreground ml-auto">{filtrados.length} de {visiveis.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b text-[10px] text-muted-foreground uppercase">
                    <th className="py-2 px-2 text-left">Cliente</th>
                    <th className="py-2 px-2 text-center">Status</th>
                    <th className="py-2 px-2 text-center">Situação</th>
                    <th className="py-2 px-2 text-center">Resultados</th>
                    <th className="py-2 px-2 text-center">Últ. Feedback</th>
                    <th className="py-2 px-2 text-right">Orç. Inicial</th>
                    <th className="py-2 px-2 text-right">Orç. Atual</th>
                    <th className="py-2 px-2 text-center">Upsell</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((c) => (
                    <Fragment key={c.notion_id}>
                    <tr id={`cliente-row-${c.notion_id}`} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-1.5 px-2 font-medium">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setExpandedRow((p) => p === c.notion_id ? null : c.notion_id)}
                            className="text-muted-foreground hover:text-foreground"
                            title="Registrar feedback"
                          >
                            {expandedRow === c.notion_id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>
                          <Link href={`/dashboard/clientes/${c.notion_id}`} className="hover:underline hover:text-primary">{c.nome}</Link>
                          {(() => {
                            const r = churnRiskInfo(c);
                            if (!r.atRisk) return null;
                            return (
                              <span
                                title={`RISCO DE CHURN — critérios:\n• ${r.reasons.join("\n• ")}`}
                                className="ml-0.5 text-xs"
                                aria-label="Risco de churn"
                              >
                                🔴
                              </span>
                            );
                          })()}
                          <button
                            onClick={() => setExpandedRow(c.notion_id)}
                            className="ml-1 text-muted-foreground hover:text-primary"
                            title="Registrar feedback / histórico"
                          >
                            <MessageSquarePlus size={11} />
                          </button>
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <select value={c.status} onChange={(e) => updateCliente(c.notion_id, "status", e.target.value)}
                          className={`text-[10px] rounded-full px-2 py-0.5 border-0 cursor-pointer ${STATUS_COLORS[c.status] || "bg-muted"}`}>
                          {STATUS_OPTS.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <select value={c.situacao} onChange={(e) => updateCliente(c.notion_id, "situacao", e.target.value)}
                          className={`text-[10px] rounded-full px-2 py-0.5 border-0 cursor-pointer ${SITUACAO_COLORS[c.situacao] || "bg-muted"}`}>
                          <option value="">—</option>
                          {SITUACAO_OPTS.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <select value={c.resultados} onChange={(e) => updateCliente(c.notion_id, "resultados", e.target.value)}
                          className={`text-[10px] rounded-full px-2 py-0.5 border-0 cursor-pointer ${RESULTADOS_COLORS[c.resultados] || "bg-muted"}`}>
                          <option value="">—</option>
                          {RESULTADOS_OPTS.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <input type="date" value={c.ultimo_feedback || ""} onChange={(e) => updateCliente(c.notion_id, "ultimo_feedback", e.target.value)}
                          className={`text-[10px] bg-transparent border rounded px-1 py-0.5 w-[110px] ${
                            c.ultimo_feedback && Math.floor((Date.now() - new Date(c.ultimo_feedback).getTime()) / 86400000) > 10 ? "border-red-500/50 text-red-400" : ""
                          }`} />
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
                        {c.orcamento_inicial ? formatCurrency(Number(c.orcamento_inicial)) : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <input
                          type="number"
                          defaultValue={c.orcamento ? Number(c.orcamento) : 0}
                          onBlur={(e) => {
                            const v = e.target.value;
                            if (String(Number(c.orcamento || 0)) !== String(Number(v))) {
                              updateCliente(c.notion_id, "orcamento", v);
                            }
                          }}
                          className="w-24 text-xs bg-transparent border rounded px-1 py-0.5 text-right font-mono"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        {(() => {
                          const ini = Number(c.orcamento_inicial || 0);
                          const atu = Number(c.orcamento || 0);
                          if (!ini) return <span className="text-[10px] text-muted-foreground">—</span>;
                          const delta = atu - ini;
                          const pct = ini > 0 ? (delta / ini) * 100 : 0;
                          const cls = delta > 0
                            ? "bg-green-500/15 text-green-400"
                            : delta < 0
                              ? "bg-red-500/15 text-red-400"
                              : "bg-muted text-muted-foreground";
                          const sign = delta > 0 ? "+" : "";
                          return (
                            <span className={`inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 font-mono ${cls}`}>
                              {sign}{formatCurrency(delta)} ({sign}{pct.toFixed(0)}%)
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                    {expandedRow === c.notion_id && (
                      <tr className="bg-muted/10 border-b border-border/30">
                        <td colSpan={8} className="p-3">
                          <ClienteExpansao
                            clienteNotionId={c.notion_id}
                            clienteNome={c.nome}
                            situacaoAtual={c.situacao}
                            onSavedFeedback={() => {
                              setFeedbackAgg((prev) => ({
                                ...prev,
                                [c.notion_id]: {
                                  ultimo: new Date().toISOString().slice(0, 10),
                                  total_30d: (prev[c.notion_id]?.total_30d || 0) + 1,
                                },
                              }));
                              load();
                            }}
                            onSavedSituacao={load}
                          />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                  {filtrados.length === 0 && (
                    <tr><td colSpan={8} className="py-6 text-center text-muted-foreground text-xs">Nenhum cliente</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Kanban de Tarefas filtrado pelo membro */}
      {membro && <TarefasKanban filtroResponsavel={membro.nome} />}

      {/* Tarefas do Notion (legado) */}
      {tarefas.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Tarefas ({tarefas.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {tarefas.slice(0, 10).map((t) => (
              <div key={t.notion_id} className="flex items-center justify-between p-2 border rounded-lg text-xs">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{t.nome}</p>
                  {t.solicitante && <p className="text-[10px] text-muted-foreground">Solicitante: {t.solicitante}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.data && <span className="text-[10px] text-muted-foreground">{new Date(t.data).toLocaleDateString("pt-BR")}</span>}
                  <Badge className={`text-[9px] ${t.status === "Feito" || t.status === "Done" ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"}`}>
                    {t.status || "—"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Reuniões */}
      {reunioes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Reuniões ({reunioes.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {reunioes.slice(0, 10).map((r) => (
              <div key={r.notion_id} className="flex items-center justify-between p-2 border rounded-lg text-xs">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.nome}</p>
                  {r.participantes && <p className="text-[10px] text-muted-foreground">Participantes: {r.participantes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.data && <span className="text-[10px] text-muted-foreground">{new Date(r.data).toLocaleDateString("pt-BR")}</span>}
                  {r.tipo && <Badge className="text-[9px] bg-blue-500/15 text-blue-400">{r.tipo}</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

    </div>
  );
}

// =====================================================================
// FeedbackForm — usado nas linhas expansíveis da tabela de clientes (3B)
// =====================================================================
interface FeedbackRow {
  id: string;
  data_feedback: string;
  n_contratos: number | null;
  contratos_nao_informado: boolean;
  faturamento: number | null;
  faturamento_nao_informado: boolean;
  data_envio_feedback: string | null;
  envio_nao_informado: boolean;
  observacoes: string | null;
}

function FeedbackForm({
  clienteNotionId,
  clienteNome,
  onSaved,
}: {
  clienteNotionId: string;
  clienteNome: string;
  onSaved: () => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [dataFeedback, setDataFeedback] = useState(hoje);
  const [nContratos, setNContratos] = useState<string>("");
  const [contratosNaoInformado, setContratosNaoInformado] = useState(false);
  const [faturamento, setFaturamento] = useState<string>("");
  const [faturamentoNaoInformado, setFaturamentoNaoInformado] = useState(false);
  const [dataEnvio, setDataEnvio] = useState("");
  const [envioNaoInformado, setEnvioNaoInformado] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [historico, setHistorico] = useState<FeedbackRow[]>([]);

  const carregarHistorico = useCallback(async () => {
    const res = await fetch(`/api/team/feedbacks?cliente_notion_id=${encodeURIComponent(clienteNotionId)}`);
    const data = await res.json();
    if (Array.isArray(data)) setHistorico(data);
  }, [clienteNotionId]);

  useEffect(() => { carregarHistorico(); }, [carregarHistorico]);

  const salvar = async () => {
    if (!dataFeedback) { toast.error("Informe a data do feedback"); return; }
    setSaving(true);
    const res = await fetch("/api/team/feedbacks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente_notion_id: clienteNotionId,
        data_feedback: dataFeedback,
        n_contratos: nContratos !== "" ? Number(nContratos) : null,
        contratos_nao_informado: contratosNaoInformado,
        faturamento: faturamento !== "" ? Number(faturamento) : null,
        faturamento_nao_informado: faturamentoNaoInformado,
        data_envio_feedback: dataEnvio || null,
        envio_nao_informado: envioNaoInformado,
        observacoes: observacoes || null,
      }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("Feedback registrado");
      setNContratos(""); setFaturamento(""); setDataEnvio(""); setObservacoes("");
      setContratosNaoInformado(false); setFaturamentoNaoInformado(false); setEnvioNaoInformado(false);
      carregarHistorico();
      onSaved();
    } else {
      toast.error(data.error || "Erro ao salvar");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">
        Registrar Feedback do Cliente — <span className="text-foreground">{clienteNome}</span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground">Data do feedback</label>
          <input type="date" value={dataFeedback} onChange={(e) => setDataFeedback(e.target.value)}
            className="w-full text-xs bg-transparent border rounded px-2 py-1 mt-0.5" />
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground">Nº de contratos no período</label>
          <div className="flex items-center gap-1 mt-0.5">
            <input
              type="number"
              value={nContratos}
              onChange={(e) => setNContratos(e.target.value)}
              disabled={contratosNaoInformado}
              className="flex-1 text-xs bg-transparent border rounded px-2 py-1 disabled:opacity-40"
              placeholder="0"
            />
            <button
              type="button"
              onClick={() => { setContratosNaoInformado((v) => !v); if (!contratosNaoInformado) setNContratos(""); }}
              className={`text-[9px] px-2 py-1 rounded border ${contratosNaoInformado ? "bg-muted text-foreground" : "text-muted-foreground"}`}
              title="Não informado"
            >
              🚫
            </button>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground">Faturamento (R$)</label>
          <div className="flex items-center gap-1 mt-0.5">
            <input
              type="number"
              value={faturamento}
              onChange={(e) => setFaturamento(e.target.value)}
              disabled={faturamentoNaoInformado}
              className="flex-1 text-xs bg-transparent border rounded px-2 py-1 disabled:opacity-40 font-mono"
              placeholder="0"
            />
            <button
              type="button"
              onClick={() => { setFaturamentoNaoInformado((v) => !v); if (!faturamentoNaoInformado) setFaturamento(""); }}
              className={`text-[9px] px-2 py-1 rounded border ${faturamentoNaoInformado ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            >
              🚫
            </button>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground">Data envio do feedback (cliente)</label>
          <div className="flex items-center gap-1 mt-0.5">
            <input
              type="date"
              value={dataEnvio}
              onChange={(e) => setDataEnvio(e.target.value)}
              disabled={envioNaoInformado}
              className="flex-1 text-xs bg-transparent border rounded px-2 py-1 disabled:opacity-40"
            />
            <button
              type="button"
              onClick={() => { setEnvioNaoInformado((v) => !v); if (!envioNaoInformado) setDataEnvio(""); }}
              className={`text-[9px] px-2 py-1 rounded border ${envioNaoInformado ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            >
              🚫
            </button>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="text-[10px] text-muted-foreground">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="w-full text-xs bg-transparent border rounded px-2 py-1 mt-0.5 min-h-[40px]"
            placeholder="Comentários do feedback..."
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={salvar} disabled={saving}>
          <Save size={12} className="mr-1" /> {saving ? "Salvando..." : "Salvar Feedback"}
        </Button>
      </div>

      {/* Histórico */}
      <div className="pt-2 border-t">
        <p className="text-[10px] uppercase text-muted-foreground mb-1.5">Histórico (últimos {Math.min(historico.length, 5)})</p>
        {historico.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nenhum feedback registrado.</p>
        ) : (
          <div className="space-y-1">
            {historico.slice(0, 5).map((h) => (
              <div key={h.id} className="grid grid-cols-12 gap-2 text-[11px] items-center px-2 py-1 rounded border border-border/30">
                <span className="col-span-2 font-mono text-muted-foreground">
                  {new Date(h.data_feedback + "T12:00:00").toLocaleDateString("pt-BR")}
                </span>
                <span className="col-span-2">
                  {h.contratos_nao_informado ? "🚫" : (h.n_contratos != null ? `${h.n_contratos} contr.` : "—")}
                </span>
                <span className="col-span-3 font-mono">
                  {h.faturamento_nao_informado ? "🚫" : (h.faturamento != null ? formatCurrency(Number(h.faturamento)) : "—")}
                </span>
                <span className="col-span-2 text-muted-foreground">
                  {h.envio_nao_informado ? "🚫" : (h.data_envio_feedback ? new Date(h.data_envio_feedback + "T12:00:00").toLocaleDateString("pt-BR") : "—")}
                </span>
                <span className="col-span-3 truncate text-muted-foreground" title={h.observacoes || ""}>
                  {h.observacoes || ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// ClienteExpansao — wrapper com abas Feedback / Histórico (4B)
// =====================================================================
const SITUACAO_OPTS_EXP = ["Melhorando", "Estável", "Piorando"];

function ClienteExpansao({
  clienteNotionId,
  clienteNome,
  situacaoAtual,
  onSavedFeedback,
  onSavedSituacao,
}: {
  clienteNotionId: string;
  clienteNome: string;
  situacaoAtual: string;
  onSavedFeedback: () => void;
  onSavedSituacao: () => void;
}) {
  const [tab, setTab] = useState<"feedback" | "historico" | "nps">("feedback");
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 border-b">
        <button
          onClick={() => setTab("feedback")}
          className={`text-[11px] px-3 py-1.5 border-b-2 -mb-px ${tab === "feedback" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <MessageSquarePlus size={11} className="inline mr-1" /> Registrar Feedback
        </button>
        <button
          onClick={() => setTab("historico")}
          className={`text-[11px] px-3 py-1.5 border-b-2 -mb-px ${tab === "historico" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <History size={11} className="inline mr-1" /> Histórico de Situação
        </button>
        <button
          onClick={() => setTab("nps")}
          className={`text-[11px] px-3 py-1.5 border-b-2 -mb-px ${tab === "nps" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Star size={11} className="inline mr-1" /> NPS
        </button>
      </div>

      {tab === "feedback" && (
        <FeedbackForm clienteNotionId={clienteNotionId} clienteNome={clienteNome} onSaved={onSavedFeedback} />
      )}
      {tab === "historico" && (
        <HistoricoSituacao clienteNotionId={clienteNotionId} clienteNome={clienteNome} situacaoAtual={situacaoAtual} onSaved={onSavedSituacao} />
      )}
      {tab === "nps" && (
        <NpsForm clienteNotionId={clienteNotionId} clienteNome={clienteNome} />
      )}
    </div>
  );
}

// =====================================================================
// HistoricoSituacao — timeline + form de mudança manual com contexto (4B)
// =====================================================================
interface SituacaoEvent {
  id: string;
  cliente_notion_id: string;
  situacao_anterior: string | null;
  situacao_nova: string | null;
  data_mudanca: string;
  origem: string;
  contexto: string | null;
  gestor_id: string | null;
}

interface FeedbackEntry {
  id: string;
  data_feedback: string;
  observacoes: string | null;
  n_contratos: number | null;
  faturamento: number | null;
}

const SIT_BADGE: Record<string, string> = {
  "Melhorando": "bg-green-500/15 text-green-400",
  "Estável": "bg-blue-500/15 text-blue-400",
  "Piorando": "bg-red-500/15 text-red-400",
};

function HistoricoSituacao({
  clienteNotionId,
  clienteNome,
  situacaoAtual,
  onSaved,
}: {
  clienteNotionId: string;
  clienteNome: string;
  situacaoAtual: string;
  onSaved: () => void;
}) {
  const [eventos, setEventos] = useState<SituacaoEvent[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>([]);
  const [novaSituacao, setNovaSituacao] = useState(situacaoAtual || "Estável");
  const [contexto, setContexto] = useState("");
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    const [hRes, fRes] = await Promise.all([
      fetch(`/api/team/situation-history?cliente_notion_id=${encodeURIComponent(clienteNotionId)}`),
      fetch(`/api/team/feedbacks?cliente_notion_id=${encodeURIComponent(clienteNotionId)}`),
    ]);
    const h = await hRes.json();
    const f = await fRes.json();
    if (Array.isArray(h)) setEventos(h);
    if (Array.isArray(f)) setFeedbacks(f);
  }, [clienteNotionId]);

  useEffect(() => { carregar(); }, [carregar]);

  const registrar = async () => {
    if (!novaSituacao) return;
    setSaving(true);
    const res = await fetch("/api/team/situation-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente_notion_id: clienteNotionId,
        situacao_nova: novaSituacao,
        contexto: contexto || null,
      }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("Mudança registrada");
      setContexto("");
      carregar();
      onSaved();
    } else {
      toast.error(data.error || "Erro ao registrar");
    }
    setSaving(false);
  };

  // Para cada evento, encontra feedback registrado próximo (±3 dias)
  const feedbackProximo = (data: string): FeedbackEntry | null => {
    const t = new Date(data).getTime();
    let melhor: FeedbackEntry | null = null;
    let menorDiff = Infinity;
    for (const f of feedbacks) {
      const diff = Math.abs(new Date(f.data_feedback + "T12:00:00").getTime() - t);
      if (diff <= 3 * 86400000 && diff < menorDiff) { melhor = f; menorDiff = diff; }
    }
    return melhor;
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">
        Histórico de situação — <span className="text-foreground">{clienteNome}</span>
      </p>

      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-[10px] uppercase text-muted-foreground">Registrar mudança manual</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-[10px] text-muted-foreground">De</label>
            <p className="text-xs">
              <span className={`text-[10px] rounded-full px-2 py-0.5 ${SIT_BADGE[situacaoAtual] || "bg-muted"}`}>{situacaoAtual || "—"}</span>
            </p>
          </div>
          <span className="text-muted-foreground">→</span>
          <div>
            <label className="text-[10px] text-muted-foreground">Para</label>
            <select
              value={novaSituacao}
              onChange={(e) => setNovaSituacao(e.target.value)}
              className="block text-xs bg-transparent border rounded px-2 py-1 mt-0.5"
            >
              {SITUACAO_OPTS_EXP.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">O que aconteceu nesse período?</label>
          <textarea
            value={contexto}
            onChange={(e) => setContexto(e.target.value)}
            className="w-full text-xs bg-transparent border rounded px-2 py-1 mt-0.5 min-h-[50px]"
            placeholder="Contexto da mudança..."
          />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={registrar} disabled={saving || novaSituacao === situacaoAtual}>
            <Save size={12} className="mr-1" /> {saving ? "..." : "Registrar"}
          </Button>
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase text-muted-foreground mb-2">Timeline</p>
        {eventos.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nenhuma mudança registrada.</p>
        ) : (
          <ol className="relative border-l border-border/60 ml-2 space-y-3">
            {eventos.map((e) => {
              const fb = feedbackProximo(e.data_mudanca);
              const dt = new Date(e.data_mudanca);
              return (
                <li key={e.id} className="ml-3">
                  <span className="absolute -left-[5px] mt-1 w-2.5 h-2.5 rounded-full bg-primary border border-background" />
                  <div className="text-[11px] text-muted-foreground">
                    {dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    <span className="ml-2 text-[9px] uppercase rounded px-1 py-0.5 border bg-muted/40">{e.origem}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs mt-0.5">
                    <span className={`text-[10px] rounded-full px-2 py-0.5 ${SIT_BADGE[e.situacao_anterior || ""] || "bg-muted text-muted-foreground"}`}>
                      {e.situacao_anterior || "—"}
                    </span>
                    <span>→</span>
                    <span className={`text-[10px] rounded-full px-2 py-0.5 ${SIT_BADGE[e.situacao_nova || ""] || "bg-muted text-muted-foreground"}`}>
                      {e.situacao_nova || "—"}
                    </span>
                  </div>
                  {e.contexto && <p className="text-[11px] mt-1 whitespace-pre-wrap">{e.contexto}</p>}
                  {fb && (
                    <div className="mt-1 text-[10px] rounded border border-blue-500/30 bg-blue-500/5 px-2 py-1 text-blue-200">
                      📝 Feedback próximo ({new Date(fb.data_feedback + "T12:00:00").toLocaleDateString("pt-BR")}):
                      {fb.n_contratos != null && <> {fb.n_contratos} contratos.</>}
                      {fb.faturamento != null && <> {formatCurrency(Number(fb.faturamento))}.</>}
                      {fb.observacoes && <> {fb.observacoes}</>}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// NpsForm — registrar NPS + histórico do cliente (6C)
// =====================================================================
interface NpsRow {
  id: string;
  cliente_notion_id: string;
  nps_score: number;
  nps_comentario: string | null;
  mes_referencia: string;
  created_at: string;
}

function corNps(score: number): string {
  if (score >= 9) return "bg-green-500/20 text-green-300 border-green-500/40";
  if (score >= 7) return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
  return "bg-red-500/20 text-red-300 border-red-500/40";
}
function corNpsBtn(score: number, ativo: boolean): string {
  const base = ativo ? "" : "opacity-50 hover:opacity-100";
  if (score >= 9) return `bg-green-500/${ativo ? 30 : 10} text-green-300 border-green-500/${ativo ? 60 : 30} ${base}`;
  if (score >= 7) return `bg-yellow-500/${ativo ? 30 : 10} text-yellow-300 border-yellow-500/${ativo ? 60 : 30} ${base}`;
  return `bg-red-500/${ativo ? 30 : 10} text-red-300 border-red-500/${ativo ? 60 : 30} ${base}`;
}

function NpsForm({ clienteNotionId, clienteNome }: { clienteNotionId: string; clienteNome: string }) {
  const hojeMes = new Date().toISOString().slice(0, 7);
  const [score, setScore] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [mesRef, setMesRef] = useState(hojeMes);
  const [historico, setHistorico] = useState<NpsRow[]>([]);
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/team/nps?cliente_notion_id=${encodeURIComponent(clienteNotionId)}`);
    const data = await res.json();
    if (Array.isArray(data)) setHistorico(data);
  }, [clienteNotionId]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    if (!score) { toast.error("Selecione uma nota de 1 a 10"); return; }
    setSaving(true);
    const res = await fetch("/api/team/nps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente_notion_id: clienteNotionId,
        nps_score: score,
        nps_comentario: comentario || null,
        mes_referencia: mesRef,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      toast.success("NPS registrado");
      setScore(null); setComentario("");
      carregar();
    } else {
      toast.error(data.error || "Erro ao salvar");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">
        NPS — <span className="text-foreground">{clienteNome}</span>
      </p>

      <div className="rounded-lg border p-3 space-y-3">
        <div>
          <p className="text-[10px] uppercase text-muted-foreground mb-2">Nota de 1 a 10</p>
          <div className="flex flex-wrap gap-1.5">
            {[1,2,3,4,5,6,7,8,9,10].map((n) => (
              <button
                key={n}
                onClick={() => setScore(n)}
                className={`w-9 h-9 rounded-md border text-sm font-bold tabular-nums transition ${corNpsBtn(n, score === n)}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground">Mês de referência</label>
            <input type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)}
              className="w-full text-xs bg-transparent border rounded px-2 py-1.5 mt-0.5" />
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] text-muted-foreground">Comentário</label>
            <input type="text" value={comentario} onChange={(e) => setComentario(e.target.value)}
              placeholder="O que motivou essa nota?"
              className="w-full text-xs bg-transparent border rounded px-2 py-1.5 mt-0.5" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={salvar} disabled={saving || !score}>
            <Save size={12} className="mr-1" /> {saving ? "..." : "Salvar NPS"}
          </Button>
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase text-muted-foreground mb-2">Histórico</p>
        {historico.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nenhum NPS registrado ainda.</p>
        ) : (
          <ol className="relative border-l border-border/60 ml-2 space-y-2">
            {historico.map((h) => (
              <li key={h.id} className="ml-3">
                <span className={`absolute -left-[5px] mt-1 w-2.5 h-2.5 rounded-full border ${corNps(h.nps_score)}`} />
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground font-mono">{h.mes_referencia.slice(0, 7)}</span>
                  <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${corNps(h.nps_score)}`}>{h.nps_score}/10</span>
                </div>
                {h.nps_comentario && <p className="text-[11px] mt-0.5 text-muted-foreground">{h.nps_comentario}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
