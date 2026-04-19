"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { useProjectionData } from "@/hooks/useProjectionData";
import type { HistData, HistPeriod } from "@/hooks/useProjectionData";
import { ALL_PROVIDERS, AI_LABELS, AI_CONFIG } from "@/lib/ai-config";
import type { AIProvider } from "@/lib/ai-client";
import { useProjecoesSWR } from "@/hooks/use-projecoes-data";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle, Target, TrendingUp, DollarSign,
  Users, Brain, Loader2, ChevronDown, History, RefreshCw,
  Banknote, Receipt, ArrowDownToLine, ToggleLeft, ToggleRight,
  Crosshair, SlidersHorizontal, BarChart3,
  PieChart as PieChartIcon, Gauge, Sparkles, Eye, Save, LineChart as LineChartIcon
} from "lucide-react";
import { CurrencyInput } from "@/components/currency-input";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, PieChart as RPieChart,
  Pie, Cell,
} from "recharts";
import { toast } from "sonner";

// ===== CONSTANTES E CONFIGURAÇÕES =====
const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
const MESES_PT: Record<string, string> = { "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr", "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago", "09": "Set", "10": "Out", "11": "Nov", "12": "Dez" };
const CAT_LABELS = { orcamento: "Orçamento", criativo: "Criativo", crm: "CRM", funil: "Funil" };
const CAT_FILTER = ["todas", "orcamento", "criativo", "crm", "funil"] as const;
type MetricState = "historico" | "manual" | "desativado";

// ===== INTERFACES =====
interface ProjecaoAlerta {
  id: string; tipo: "meta_inalcancavel" | "gargalo_funil" | "ritmo_insuficiente"; mensagem: string;
  acoes_sugeridas: string[] | null; visualizado: boolean; criado_em: string;
}

// ===== HELPER FUNCTIONS =====
function mesLabel(mes: string) { const [, m] = mes.split("-"); return MESES_PT[m] || mes; }

export default function ProjecoesPage() {
  const [mounted, setMounted] = useState(false);
  const { alertas, mutateAlertas, breakEven, ltv, acuracia, isLoading: loadingExtras } = useProjecoesSWR();

  // Financial goals
  const [metaMRR, setMetaMRR] = useState(0);
  const [faturamentoLTV, setFaturamentoLTV] = useState(0);
  const [entrada, setEntrada] = useState(0);
  const [histPeriod, setHistPeriod] = useState<HistPeriod>(3);

  // Metric states
  const [ticketState, setTicketState] = useState<MetricState>("historico");
  const [leadReunState, setLeadReunState] = useState<MetricState>("historico");
  const [reunFechState, setReunFechState] = useState<MetricState>("historico");
  const [noShowState, setNoShowState] = useState<MetricState>("historico");
  const [cplState, setCplState] = useState<MetricState>("historico");
  const [cacState, setCacState] = useState<MetricState>("historico");
  const [contratosState, setContratosState] = useState<MetricState>("desativado");

  // Manual values
  const [manualTicket, setManualTicket] = useState<number>(0);
  const [manualLeadReun, setManualLeadReun] = useState<number>(0);
  const [manualReunFech, setManualReunFech] = useState<number>(0);
  const [manualNoShow, setManualNoShow] = useState<number>(0);
  const [manualCpl, setManualCpl] = useState<number>(0);
  const [manualCac, setManualCac] = useState<number>(0);
  const [manualContratos, setManualContratos] = useState<number>(0);

  const [alertFilter, setAlertFilter] = useState<typeof CAT_FILTER[number]>("todas");

  // AI & Simulators
  const [aiProvider, setAiProvider] = useState<AIProvider>(AI_CONFIG.analise_closer);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showProviderSelect, setShowProviderSelect] = useState(false);
  const [aiFullResult, setAiFullResult] = useState<string | null>(null);
  const [aiFullLoading, setAiFullLoading] = useState(false);
  const [savingNotion, setSavingNotion] = useState(false);
  const [simResultado, setSimResultado] = useState<any>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simParams, setSimParams] = useState({ orcamento: 0, noshow: 20, qualificacao: 15, fechamento: 25, closers: 3 });

  const { metaData, crmData, dashData, histMeses, histAvg, effective, projection, alerts, isLoading, error, retry } =
    useProjectionData({ metaMRR, faturamentoLTV, entrada, metaContratos: contratosState === "manual" ? manualContratos : 0 },
      { ticketMedio: ticketState === "desativado" ? 0 : ticketState === "manual" ? manualTicket : null, taxaLeadReuniao: leadReunState === "desativado" ? 0 : leadReunState === "manual" ? manualLeadReun : null, taxaReuniaoFechamento: reunFechState === "desativado" ? 0 : reunFechState === "manual" ? manualReunFech : null, taxaNoShow: noShowState === "desativado" ? 0 : noShowState === "manual" ? manualNoShow : null, cpl: cplState === "desativado" ? 0 : cplState === "manual" ? manualCpl : null, cac: cacState === "desativado" ? 0 : cacState === "manual" ? manualCac : null }, histPeriod);

  // FIX S-S-R Hydration
  useEffect(() => {
    setMounted(true);
    setAiResult(localStorage.getItem("ai_analysis_cache") || null);
  }, []);

  useEffect(() => {
    if (ticketState === "manual" && manualTicket === 0) setManualTicket(histAvg.ticketMedio);
    if (leadReunState === "manual" && manualLeadReun === 0) setManualLeadReun(histAvg.taxaLeadReuniao);
    if (reunFechState === "manual" && manualReunFech === 0) setManualReunFech(histAvg.taxaReuniaoFechamento);
    if (noShowState === "manual" && manualNoShow === 0) setManualNoShow(histAvg.taxaNoShow);
    if (cplState === "manual" && manualCpl === 0) setManualCpl(histAvg.cpl);
    if (cacState === "manual" && manualCac === 0) setManualCac(histAvg.cac);
  }, [ticketState, leadReunState, reunFechState, noShowState, cplState, cacState, histAvg, manualTicket, manualLeadReun, manualReunFech, manualNoShow, manualCpl, manualCac]);

  const runSimulacao = useCallback(async () => {
    setSimLoading(true);
    try {
      const res = await fetch("/api/projecoes/funil-reverso", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta_contratos: contratosState === "manual" ? manualContratos : undefined, meta_mrr: metaMRR, usar_taxas_manuais: false, taxas_override: { taxa_lead_para_qualificado: simParams.qualificacao / 100, taxa_proposta_para_fechamento: simParams.fechamento / 100, noshow_rate: simParams.noshow / 100 } }),
      });
      const data = await res.json();
      if (!data.error) setSimResultado(data);
    } catch (e) {
      toast.error("Erro na simulação");
    } finally {
      setSimLoading(false);
    }
  }, [metaMRR, simParams, contratosState, manualContratos]);

  const runAiAnalysis = useCallback(async () => {
    setAiLoading(true);
    try {
      const t = `META MRR: ${metaMRR} | LEADS NECESSÁRIOS: ${projection.leadsNecessarios} | Reuniões: ${projection.reunioesNecessarias} | CPL: ${effective.cpl.toFixed(2)}`;
      const res = await fetch("/api/projections/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectionData: t, provider: aiProvider }) });
      const data = await res.json();
      if (!data.error) {
        setAiResult(data.analysis);
        localStorage.setItem("ai_analysis_cache", data.analysis);
        localStorage.setItem("ai_analysis_time", new Date().toLocaleString("pt-BR"));
      }
    } catch (e) { toast.error("Falha ao consultar IA."); } finally { setAiLoading(false); }
  }, [metaMRR, projection, effective, aiProvider]);

  const runFullAnalysis = useCallback(async () => {
    setAiFullLoading(true);
    try {
      const t = `ANÁLISE DE PROJEÇÃO COMPLETA: MRR: ${metaMRR} | Proj MRR: ${projection.mrrProjetado} | Leads Rec: ${projection.leadsNecessarios} | Taxa Reunião: ${(effective.taxaLeadReuniao * 100).toFixed(1)}%`;
      const res = await fetch("/api/projections/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectionData: t, provider: "anthropic" }) });
      const data = await res.json();
      if (!data.error) setAiFullResult(data.analysis);
    } catch (e) { } finally { setAiFullLoading(false); }
  }, [metaMRR, projection, effective]);

  const unseenAlertas = alertas.filter((a: any) => !a.visualizado);

  if (!mounted || isLoading || loadingExtras) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 animate-in fade-in zoom-in">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Sincronizando modelos de Projeção Neural...</p>
      </div>
    );
  }

  // Cross-Tab Linkers
  const gargaloTrafego = (metaData?.cpl ?? effective.cpl) > 50 && (metaData?.leads ?? 0) < projection.leadsNecessarios * 0.7;
  const gargaloCRM = (crmData?.completedMeetings ?? 0) >= projection.reunioesNecessarias * 0.7 && (crmData?.closedDeals ?? 0) < projection.clientesNecessarios * 0.5;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700 fade-in pb-12">
      {/* HEADER & GLOBALS */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-card/60 border border-border/50 p-6 rounded-2xl backdrop-blur-xl shadow-[0_4px_24px_-10px_rgba(0,0,0,0.1)] gap-4">
        <div className="flex flex-col">
          <h1 className="text-4xl font-black tracking-tighter flex items-center gap-2">Visão Projetiva <LineChartIcon size={28} className="text-primary opacity-50" /></h1>
          <p className="text-muted-foreground font-medium text-sm mt-1 max-w-[500px]">Simule, ajuste taxas e preveja cenários financeiros HSL atrelados ao Meta Ads e CRM.</p>
        </div>
        <div className="flex gap-2 relative z-10">
          <Button variant="outline" size="sm" onClick={runFullAnalysis} disabled={aiFullLoading} className="font-bold uppercase tracking-tight text-[10px] shadow-xl">
            {aiFullLoading ? <Loader2 size={12} className="animate-spin mr-1" /> : <Sparkles size={12} className="mr-1 text-purple-500" />}
            Dossiê Total com IA
          </Button>
          <Button variant="ghost" onClick={retry} className="text-muted-foreground"><RefreshCw size={14} /></Button>
        </div>
      </div>

      <AnimatePresence>
        {unseenAlertas.length > 0 && unseenAlertas.map((a: ProjecaoAlerta) => (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} key={a.id} className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center justify-between shadow-lg">
            <div className="flex gap-3">
              <AlertTriangle size={20} className="shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-bold">{a.mensagem}</p>
                {a.acoes_sugeridas && <div className="flex gap-2 mt-2">{a.acoes_sugeridas.map((ac, idx) => <Badge key={idx} className="bg-red-500/20 text-red-400 font-mono text-[9px] uppercase">{ac}</Badge>)}</div>}
              </div>
            </div>
            <button onClick={() => { fetch("/api/projecoes/alertas", { method: "POST", body: JSON.stringify({ id: a.id }) }); mutateAlertas(); }} className="px-2 py-1 text-[10px] border border-red-500/30 rounded hover:bg-red-500/20 uppercase font-black tracking-widest transition-all">Marcar Ciente</button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* RESULTADO DA IA PLENA */}
      <AnimatePresence>
        {aiFullResult && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card className="bg-gradient-to-r from-purple-500/10 to-transparent border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)] overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-5"><Brain size={120} /></div>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base uppercase tracking-widest font-black text-purple-400 flex items-center gap-2"><Sparkles size={16} /> Resumo Analítico Master</CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setAiFullResult(null)}><CheckCircle size={14} className="mr-1" /> Concluir</Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto relative z-10">{aiFullResult}</CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seletor de base histórica */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Base histórica:</span>
        <div className="flex bg-muted/30 rounded-lg p-0.5 border border-border/50">
          {([1, 3, 12] as const).map((p) => (
            <button key={p} onClick={() => setHistPeriod(p)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${histPeriod === p ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {p === 1 ? "Último mês" : `Últimos ${p} meses`}
            </button>
          ))}
        </div>
        {histAvg.mesesComDados < histPeriod && histAvg.mesesComDados > 0 && (
          <span className="text-[10px] text-yellow-400 font-medium">Dados insuficientes para {histPeriod} meses — usando {histAvg.mesesComDados} mês{histAvg.mesesComDados > 1 ? "es" : ""} disponível{histAvg.mesesComDados > 1 ? "is" : ""}</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ESQUERDA - Input e Funil */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="bg-card/40 backdrop-blur-xl border border-primary/20 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">MRR Meta Mensal</label>
                <CurrencyInput value={metaMRR} onChange={setMetaMRR} className="w-full text-2xl font-black bg-transparent border-b-2 border-primary/50 outline-none pb-1 focus:border-primary transition-colors text-foreground" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">LTV Absoluto Alvo</label>
                <CurrencyInput value={faturamentoLTV} onChange={setFaturamentoLTV} className="w-full text-2xl font-black bg-transparent border-b-2 border-primary/50 outline-none pb-1 focus:border-primary transition-colors text-foreground" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Entrada Direta</label>
                <CurrencyInput value={entrada} onChange={setEntrada} className="w-full text-2xl font-black bg-transparent border-b-2 border-primary/50 outline-none pb-1 focus:border-primary transition-colors text-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-md overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><TrendingUp size={100} /></div>
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-4">
              <CardTitle className="text-sm uppercase font-black tracking-widest">Mapeamento Matemático Reverso</CardTitle>
            </CardHeader>
            <CardContent className="p-6 relative z-10">
              {/* Funil visual */}
              <div className="flex flex-col md:flex-row items-center font-mono gap-4 w-full">
                <div className="flex-1 text-center bg-muted/20 p-4 rounded-xl border border-border/40">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Volumetria de Leads</p>
                  <p className="text-3xl font-black">{projection.leadsNecessarios}</p>
                </div>
                <div className="text-muted-foreground text-[10px]">{Math.round(effective.taxaAgendamento * 100)}%</div>
                <div className="flex-1 text-center bg-muted/20 p-4 rounded-xl border border-border/40">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Agendamentos</p>
                  <p className="text-3xl font-black">{projection.agendamentosNecessarios}</p>
                </div>
                <div className="text-muted-foreground text-[10px]">-{Math.round(effective.taxaNoShow * 100)}%</div>
                <div className="flex-1 text-center bg-muted/20 p-4 rounded-xl border border-border/40">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Reuniões Efetivas</p>
                  <p className="text-3xl font-black">{projection.reunioesNecessarias}</p>
                </div>
                <div className="text-muted-foreground text-[10px]">{Math.round(effective.taxaReuniaoFechamento * 100)}%</div>
                <div className="flex-1 text-center bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/30">
                  <p className="text-[9px] uppercase tracking-widest text-emerald-500 font-black mb-1">Contratos Novos</p>
                  <p className="text-3xl font-black text-emerald-400">{projection.clientesNecessarios}</p>
                </div>
              </div>

              {/* Cards projetados com referência histórica */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
                <div className="p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl flex flex-col justify-between">
                  <span className="text-[9px] uppercase text-blue-400 font-bold tracking-widest mb-1">Investimento Tráfego</span>
                  <span className="text-xl font-bold font-mono">{formatCurrency(projection.budgetViaCPL)}</span>
                  <span className="text-[9px] text-muted-foreground mt-1">Invest. médio/mês: {formatCurrency(histAvg.investimentoMedio)}</span>
                </div>
                <div className="p-3 bg-slate-500/5 border border-slate-500/15 rounded-xl flex flex-col justify-between">
                  <span className="text-[9px] uppercase text-slate-400 font-bold tracking-widest mb-1">Leads Necessários</span>
                  <span className="text-xl font-bold font-mono">{projection.leadsNecessarios}</span>
                  <span className="text-[9px] text-muted-foreground mt-1">Média/mês: {Math.round(histAvg.leadsMedio)} leads</span>
                </div>
                <div className="p-3 bg-cyan-500/5 border border-cyan-500/15 rounded-xl flex flex-col justify-between">
                  <span className="text-[9px] uppercase text-cyan-400 font-bold tracking-widest mb-1">CPL Projetado</span>
                  <span className="text-xl font-bold font-mono">{formatCurrency(projection.cplProjetado)}</span>
                  <span className="text-[9px] text-muted-foreground mt-1">CPL histórico: {formatCurrency(histAvg.cpl)}</span>
                </div>
                <div className="p-3 bg-indigo-500/5 border border-indigo-500/15 rounded-xl flex flex-col justify-between">
                  <span className="text-[9px] uppercase text-indigo-400 font-bold tracking-widest mb-1">Reuniões Agendadas</span>
                  <span className="text-xl font-bold font-mono">{projection.agendamentosNecessarios}</span>
                  <span className="text-[9px] text-muted-foreground mt-1">Média/mês: {Math.round(histAvg.reunioesMarcadasMedio)}</span>
                </div>
                <div className="p-3 bg-violet-500/5 border border-violet-500/15 rounded-xl flex flex-col justify-between">
                  <span className="text-[9px] uppercase text-violet-400 font-bold tracking-widest mb-1">Reuniões Feitas</span>
                  <span className="text-xl font-bold font-mono">{projection.reunioesNecessarias}</span>
                  <span className="text-[9px] text-muted-foreground mt-1">Média/mês: {Math.round(histAvg.reunioesFeitasMedio)}</span>
                </div>
                <div className="p-3 bg-red-500/5 border border-red-500/15 rounded-xl flex flex-col justify-between">
                  <span className="text-[9px] uppercase text-red-400 font-bold tracking-widest mb-1">No-Show Esperado</span>
                  <span className="text-xl font-bold font-mono">{Math.round(effective.taxaNoShow * 100)}% ({projection.reunioesPerdidas})</span>
                  <span className="text-[9px] text-muted-foreground mt-1">No-show hist.: {Math.round(histAvg.taxaNoShow * 100)}%</span>
                </div>
                <div className="p-3 bg-yellow-500/5 border border-yellow-500/15 rounded-xl flex flex-col justify-between">
                  <span className="text-[9px] uppercase text-yellow-400 font-bold tracking-widest mb-1">CPRF Projetado</span>
                  <span className="text-xl font-bold font-mono">{formatCurrency(projection.custoPorReuniaoProj)}</span>
                  <span className="text-[9px] text-muted-foreground mt-1">CPRF hist.: {formatCurrency(histAvg.custoPorReuniao)}</span>
                </div>
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl flex flex-col justify-between">
                  <span className="text-[9px] uppercase text-emerald-400 font-bold tracking-widest mb-1">Ticket Médio Esperado</span>
                  <span className="text-xl font-bold font-mono">{formatCurrency(effective.ticketMedio)}</span>
                  <span className="text-[9px] text-muted-foreground mt-1">Ticket hist.: {formatCurrency(histAvg.ticketMedio)}</span>
                </div>
                <div className="p-3 bg-green-500/5 border border-green-500/15 rounded-xl flex flex-col justify-between">
                  <span className="text-[9px] uppercase text-green-400 font-bold tracking-widest mb-1">Contratos Necessários</span>
                  <span className="text-xl font-bold font-mono">{projection.clientesNecessarios}</span>
                  <span className="text-[9px] text-muted-foreground mt-1">Média/mês: {Math.round(histAvg.contratosMedio)}</span>
                </div>
              </div>
              {gargaloTrafego && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase text-rose-400 tracking-tighter">Anomalia Frontal Detectada: CPL Alto vs Volume Baixo</p>
                    <p className="text-[10px] text-muted-foreground font-mono">Trafego está custando caro e não trazendo a volumetria reversa necessária.</p>
                  </div>
                  <Link href="/trafego/estrutura" className="px-3 py-1.5 bg-rose-500 text-white font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-rose-600 transition-colors shadow">Auditar Ads Ad-Sets</Link>
                </motion.div>
              )}
              {gargaloCRM && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-3 bg-orange-500/20 border border-orange-500/40 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase text-orange-400 tracking-tighter">Anomalia End-Funnel: Conversão Baixa no Fechamento</p>
                    <p className="text-[10px] text-muted-foreground font-mono">Reuniões ocorrendo com alta taxa, porém a ponta (Closers) não atinge cota.</p>
                  </div>
                  <Link href="/crm" className="px-3 py-1.5 bg-orange-500 text-white font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-orange-600 transition-colors shadow">Monitorar Pipeline e Deals</Link>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* DIREITA - Status, BreakEven e LTV */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-card/40 backdrop-blur-md">
            <CardHeader className="pb-3 border-b border-border/30"><CardTitle className="text-sm uppercase tracking-widest font-black">Break-Even & LTV Engine</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-4 pt-5">
              {breakEven ? (
                <div className="bg-muted/20 p-4 rounded-xl border border-border/40 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Ponto de Equilíbrio (MRR)</p>
                  <p className="text-3xl font-black mb-2">{formatCurrency(breakEven.break_even?.mrr_break_even || 0)}</p>
                  {breakEven.break_even?.distancia_break_even > 0 ? (
                    <Badge className="bg-red-500/15 text-red-500">Deficit {formatCurrency(breakEven.break_even.distancia_break_even)}</Badge>
                  ) : (
                    <Badge className="bg-emerald-500/15 text-emerald-400">Superavit de Cash</Badge>
                  )}
                </div>
              ) : <Loader2 className="animate-spin text-muted-foreground mx-auto my-4" />}

              {ltv ? (
                <div className="bg-muted/20 p-4 rounded-xl border border-border/40 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">LTV Estimado Total</p>
                  <p className="text-3xl font-black mb-2 text-cyan-400">{formatCurrency(ltv.ltv_total_carteira || 0)}</p>
                  <Badge variant="outline" className="text-muted-foreground">Lifespan Médio: {ltv.tempo_medio_permanencia || 0} meses</Badge>
                </div>
              ) : <Loader2 className="animate-spin text-muted-foreground mx-auto my-4" />}
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-md overflow-hidden">
            <CardHeader className="bg-primary pb-3 text-primary-foreground"><CardTitle className="text-sm uppercase tracking-widest font-black flex items-center gap-2"><SlidersHorizontal size={14} /> Simulador Dinâmico</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-4 mt-2">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest font-bold">Investimento Extra</label>
                <CurrencyInput value={simParams.orcamento} onChange={(v) => setSimParams(p => ({ ...p, orcamento: v }))} className="w-full text-sm font-mono border-b py-1" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest font-bold">Escala de Qualificação ({simParams.qualificacao}%)</label>
                <input type="range" className="w-full h-1 accent-primary" min={1} max={100} value={simParams.qualificacao} onChange={(e) => setSimParams(p => ({ ...p, qualificacao: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest font-bold">Resgatar No-show (Perda de {simParams.noshow}%)</label>
                <input type="range" className="w-full h-1 accent-red-500" min={0} max={60} value={simParams.noshow} onChange={(e) => setSimParams(p => ({ ...p, noshow: Number(e.target.value) }))} />
              </div>
              <Button className="w-full shadow-lg" onClick={runSimulacao} disabled={simLoading || metaMRR === 0}>
                {simLoading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} className="mr-1" />} Submeter ao Contexto
              </Button>
              {simResultado && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="pt-2 border-t border-border/30 mt-2">
                  <p className="text-xs text-muted-foreground text-center">Contratos Potenciais <strong className="text-foreground">{simResultado?.funil?.contratos_projetados}</strong></p>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
