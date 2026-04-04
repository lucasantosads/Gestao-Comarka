"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useProjectionData } from "@/hooks/useProjectionData";
import { ALL_PROVIDERS, AI_LABELS, AI_CONFIG } from "@/lib/ai-config";
import type { AIProvider } from "@/lib/ai-client";
import {
  AlertTriangle, CheckCircle, Target, TrendingUp, DollarSign,
  Users, Brain, Loader2, ChevronDown, History,
} from "lucide-react";

const ALERT_COLORS = { critico: "bg-red-500/10 border-red-500/30 text-red-400", atencao: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400", ok: "bg-green-500/10 border-green-500/30 text-green-400" };
const CAT_LABELS = { orcamento: "Orçamento", criativo: "Criativo", crm: "CRM", funil: "Funil" };
const CAT_FILTER = ["todas", "orcamento", "criativo", "crm", "funil"] as const;

const MESES_PT: Record<string, string> = {
  "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
  "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
  "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
};

function mesLabel(mes: string) {
  const [, m] = mes.split("-");
  return MESES_PT[m] || mes;
}

function BenchmarkCard({ label, value, benchmark, fonte, unit }: { label: string; value: number | null; benchmark: string; fonte: string; unit?: string }) {
  const display = value !== null ? (unit === "R$" ? formatCurrency(value) : unit === "%" ? formatPercent(value) : unit === "min" ? `${value.toFixed(0)} min` : `${value.toFixed(1)}x`) : "—";
  return (
    <div className="p-3 border rounded-lg space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Badge variant="outline" className="text-[9px]">{fonte}</Badge>
      </div>
      <p className="text-lg font-bold">{display}</p>
      <p className="text-[10px] text-muted-foreground">Ideal: {benchmark}</p>
    </div>
  );
}

function FunnelBar({ label, atual, necessario }: { label: string; atual: number; necessario: number }) {
  const gap = necessario - atual;
  const pct = necessario > 0 ? Math.min((atual / necessario) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {atual} / {necessario}
          {gap > 0 && <span className="text-red-400 ml-1">(+{gap})</span>}
        </span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface HistData {
  mes: string; leads: number; investimento: number; reunioesAgendadas: number;
  reunioesFeitas: number; noShow: number; contratos: number; mrr: number;
  ltv: number; ticketMedio: number; cpl: number; taxaNoShow: number;
  taxaFechamento: number; taxaLeadReuniao: number;
}

function HistRow({ label, values, format }: { label: string; values: (number | null)[]; format: "currency" | "percent" | "number" }) {
  const fmt = (v: number | null) => {
    if (v === null || v === undefined) return "—";
    if (format === "currency") return formatCurrency(v);
    if (format === "percent") return `${(v * 100).toFixed(1)}%`;
    return v.toLocaleString("pt-BR");
  };

  return (
    <tr className="border-b border-border/50 hover:bg-muted/30">
      <td className="py-2 px-3 text-xs text-muted-foreground font-medium">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="py-2 px-3 text-xs text-right font-mono">{fmt(v)}</td>
      ))}
    </tr>
  );
}

export default function ProjecoesPage() {
  const [metaReunioes, setMetaReunioes] = useState(15);
  const [ticketMedio, setTicketMedio] = useState(1800);
  const [taxaFechamento, setTaxaFechamento] = useState(0.20);
  const [alertFilter, setAlertFilter] = useState<typeof CAT_FILTER[number]>("todas");

  // AI analysis state
  const [aiProvider, setAiProvider] = useState<AIProvider>(AI_CONFIG.analise_closer);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showProviderSelect, setShowProviderSelect] = useState(false);

  // Histórico
  const [historico, setHistorico] = useState<{ mesAnterior: HistData | null; mes2: HistData | null; mes3: HistData | null } | null>(null);

  const { metaData, crmData, dashData, projection, alerts, isLoading, error } = useProjectionData({ metaReunioes, ticketMedio, taxaFechamento });

  // Fetch historico along with projection data
  useEffect(() => {
    fetch("/api/projections/summary")
      .then((r) => r.json())
      .then((data) => {
        if (data.historico) setHistorico(data.historico);
      })
      .catch(() => {});
  }, []);

  // Pre-fill com dados reais
  useEffect(() => {
    if (dashData?.ticketMedio && dashData.ticketMedio > 0) setTicketMedio(Math.round(dashData.ticketMedio));
    if (crmData?.taxaFechamento && crmData.taxaFechamento > 0) setTaxaFechamento(crmData.taxaFechamento);
  }, [dashData, crmData]);

  const runAiAnalysis = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);

    const projectionText = `
DADOS ATUAIS DO MÊS:
- Meta de reuniões: ${metaReunioes}
- Ticket médio: R$ ${ticketMedio.toLocaleString("pt-BR")}
- Taxa de fechamento: ${(taxaFechamento * 100).toFixed(0)}%

META ADS:
- Investimento: R$ ${metaData?.spend?.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || "N/A"}
- Leads Meta: ${metaData?.leads ?? "N/A"}
- CPL: R$ ${metaData?.cpl?.toFixed(2) || "N/A"}
- CTR: ${metaData?.ctr?.toFixed(2) || "N/A"}%
- Frequência: ${metaData?.frequency?.toFixed(1) || "N/A"}x

CRM:
- Total leads: ${crmData?.totalLeads ?? "N/A"}
- Qualificados: ${crmData?.qualifiedLeads ?? "N/A"} (${crmData ? (crmData.taxaQualificacao * 100).toFixed(0) : "N/A"}%)
- Reuniões agendadas: ${crmData?.scheduledMeetings ?? "N/A"}
- Reuniões realizadas: ${crmData?.completedMeetings ?? "N/A"}
- No-show: ${crmData?.noShowCount ?? "N/A"} (${crmData ? (crmData.taxaNoShow * 100).toFixed(0) : "N/A"}%)
- Contratos fechados: ${crmData?.closedDeals ?? "N/A"}
- Taxa fechamento: ${crmData ? (crmData.taxaFechamento * 100).toFixed(0) : "N/A"}%

PROJEÇÃO:
- Leads necessários: ${projection.leadsNecessarios}
- Budget necessário: R$ ${projection.budgetNecessario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Gap de budget: R$ ${projection.budgetGap.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Clientes projetados: ${projection.clientesFechados.toFixed(1)}
- Faturamento projetado: R$ ${projection.faturamentoProjetado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Reuniões perdidas por no-show: ${projection.reunioesPerdidas}

ALERTAS ATIVOS:
${alerts.map((a) => `- [${a.severidade.toUpperCase()}] ${a.titulo}: ${a.descricao}`).join("\n")}

${historico ? `HISTÓRICO:
${historico.mes3 ? `- ${mesLabel(historico.mes3.mes)}: ${historico.mes3.leads} leads, ${historico.mes3.contratos} contratos, R$ ${historico.mes3.mrr.toLocaleString("pt-BR")} MRR` : ""}
${historico.mes2 ? `- ${mesLabel(historico.mes2.mes)}: ${historico.mes2.leads} leads, ${historico.mes2.contratos} contratos, R$ ${historico.mes2.mrr.toLocaleString("pt-BR")} MRR` : ""}
${historico.mesAnterior ? `- ${mesLabel(historico.mesAnterior.mes)}: ${historico.mesAnterior.leads} leads, ${historico.mesAnterior.contratos} contratos, R$ ${historico.mesAnterior.mrr.toLocaleString("pt-BR")} MRR` : ""}` : ""}
`.trim();

    try {
      const res = await fetch("/api/projections/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectionData: projectionText, provider: aiProvider }),
      });
      const data = await res.json();
      if (data.error) setAiError(data.error);
      else setAiResult(data.analysis);
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAiLoading(false);
    }
  }, [metaReunioes, ticketMedio, taxaFechamento, metaData, crmData, projection, alerts, historico, aiProvider]);

  if (isLoading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Projeção de Meta</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>
    </div>
  );

  const filteredAlerts = alertFilter === "todas" ? alerts : alerts.filter((a) => a.categoria === alertFilter);

  const hist = historico;
  const histMeses = [hist?.mes3, hist?.mes2, hist?.mesAnterior].filter(Boolean) as HistData[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projeção de Meta</h1>
          <p className="text-sm text-muted-foreground">Simulação baseada em dados reais do Meta Ads e CRM</p>
        </div>
        {error && <Badge className="bg-red-500/20 text-red-400">Erro parcial nos dados</Badge>}
      </div>

      {/* Bloco 1 — Meta do usuário */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target size={16} />Defina sua meta</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Reuniões que quero realizar</label>
              <input type="number" min={1} value={metaReunioes} onChange={(e) => setMetaReunioes(Number(e.target.value) || 1)}
                className="w-full text-lg font-bold bg-transparent border rounded-lg px-3 py-2 text-center" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Ticket médio (R$)</label>
              <input type="number" min={100} value={ticketMedio} onChange={(e) => setTicketMedio(Number(e.target.value) || 100)}
                className="w-full text-lg font-bold bg-transparent border rounded-lg px-3 py-2 text-center" />
              {dashData?.ticketMedio ? <p className="text-[10px] text-muted-foreground text-center">Real: {formatCurrency(dashData.ticketMedio)}</p> : null}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Taxa de fechamento (%)</label>
              <input type="number" min={1} max={100} value={Math.round(taxaFechamento * 100)} onChange={(e) => setTaxaFechamento((Number(e.target.value) || 1) / 100)}
                className="w-full text-lg font-bold bg-transparent border rounded-lg px-3 py-2 text-center" />
              {crmData?.taxaFechamento ? <p className="text-[10px] text-muted-foreground text-center">Real: {(crmData.taxaFechamento * 100).toFixed(0)}%</p> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bloco 2 — Dados ao vivo */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <BenchmarkCard label="CPL Atual" value={metaData?.cpl ?? null} benchmark="R$ 30–70" fonte="META" unit="R$" />
        <BenchmarkCard label="CTR" value={metaData?.ctr ?? null} benchmark="> 1.5%" fonte="META" unit="%" />
        <BenchmarkCard label="Frequência" value={metaData?.frequency ?? null} benchmark="< 3.5x" fonte="META" />
        <BenchmarkCard label="Qualificação" value={crmData ? crmData.taxaQualificacao * 100 : null} benchmark="> 25%" fonte="CRM" unit="%" />
        <BenchmarkCard label="Agendamento" value={crmData ? crmData.taxaAgendamento * 100 : null} benchmark="> 40%" fonte="CRM" unit="%" />
        <BenchmarkCard label="No-Show" value={crmData ? crmData.taxaNoShow * 100 : null} benchmark="< 20%" fonte="CRM" unit="%" />
        <BenchmarkCard label="Tempo Resp." value={crmData?.avgResponseTimeMinutes ?? null} benchmark="< 15 min" fonte="CRM" unit="min" />
      </div>

      {/* Bloco 3 — Comparativo Histórico */}
      {histMeses.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><History size={16} />Comparativo Histórico</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 px-3 text-left text-xs text-muted-foreground font-medium">Métrica</th>
                  {histMeses.map((h) => (
                    <th key={h.mes} className="py-2 px-3 text-right text-xs text-muted-foreground font-medium">{mesLabel(h.mes)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <HistRow label="Leads" values={histMeses.map((h) => h.leads)} format="number" />
                <HistRow label="Investimento" values={histMeses.map((h) => h.investimento)} format="currency" />
                <HistRow label="CPL" values={histMeses.map((h) => h.cpl)} format="currency" />
                <HistRow label="Reuniões agendadas" values={histMeses.map((h) => h.reunioesAgendadas)} format="number" />
                <HistRow label="Reuniões feitas" values={histMeses.map((h) => h.reunioesFeitas)} format="number" />
                <HistRow label="No-show" values={histMeses.map((h) => h.taxaNoShow)} format="percent" />
                <HistRow label="Contratos" values={histMeses.map((h) => h.contratos)} format="number" />
                <HistRow label="MRR" values={histMeses.map((h) => h.mrr)} format="currency" />
                <HistRow label="LTV" values={histMeses.map((h) => h.ltv)} format="currency" />
                <HistRow label="Ticket médio" values={histMeses.map((h) => h.ticketMedio)} format="currency" />
                <HistRow label="Fechamento" values={histMeses.map((h) => h.taxaFechamento)} format="percent" />
                <HistRow label="Lead → Reunião" values={histMeses.map((h) => h.taxaLeadReuniao)} format="percent" />
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Bloco 4 — Funil de projeção */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp size={16} />Funil de Projeção</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FunnelBar label="Leads necessários" atual={projection.leadsComBudgetAtual} necessario={projection.leadsNecessarios} />
          <FunnelBar label="Qualificados necessários" atual={Math.round(projection.leadsComBudgetAtual * (crmData?.taxaQualificacao ?? 0.25))} necessario={projection.qualificadosNecessarios} />
          <FunnelBar label="Agendamentos necessários" atual={Math.round(projection.reunioesComBudgetAtual / (1 - (crmData?.taxaNoShow ?? 0.2)))} necessario={projection.agendamentosNecessarios} />
          <FunnelBar label="Reuniões realizadas" atual={projection.reunioesComBudgetAtual} necessario={metaReunioes} />
        </CardContent>
      </Card>

      {/* Bloco 5 — KPIs de resultado */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className={projection.budgetGap > 0 ? "border-red-500/30" : "border-green-500/30"}>
          <CardContent className="pt-4 pb-3 text-center">
            <DollarSign size={16} className="mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Budget necessário</p>
            <p className="text-xl font-bold">{formatCurrency(projection.budgetNecessario)}</p>
            {projection.budgetGap > 0 && <p className="text-xs text-red-400">Gap: +{formatCurrency(projection.budgetGap)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Users size={16} className="mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Clientes projetados</p>
            <p className="text-xl font-bold">{projection.clientesFechados.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingUp size={16} className="mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Faturamento projetado</p>
            <p className="text-xl font-bold text-green-400">{formatCurrency(projection.faturamentoProjetado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <AlertTriangle size={16} className="mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Reuniões perdidas (no-show)</p>
            <p className="text-xl font-bold text-red-400">{projection.reunioesPerdidas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bloco 6 — Alertas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Alertas e Ações ({alerts.length})</CardTitle>
            <div className="flex bg-muted rounded-lg p-0.5">
              {CAT_FILTER.map((f) => (
                <button key={f} onClick={() => setAlertFilter(f)}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${alertFilter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {f === "todas" ? "Todas" : CAT_LABELS[f as keyof typeof CAT_LABELS]}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAlerts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <CheckCircle size={24} className="text-green-500" />
              <p className="text-sm text-muted-foreground">Nenhum alerta nesta categoria</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAlerts.map((a) => (
                <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg border ${ALERT_COLORS[a.severidade]}`}>
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium">{a.titulo}</p>
                      <Badge variant="outline" className="text-[9px]">{CAT_LABELS[a.categoria]}</Badge>
                    </div>
                    <p className="text-xs">{a.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloco 7 — Análise IA */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain size={16} />
              Análise Estratégica por IA
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowProviderSelect(!showProviderSelect)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg hover:bg-muted transition-colors"
                >
                  {AI_LABELS[aiProvider].nome}
                  <ChevronDown size={12} />
                </button>
                {showProviderSelect && (
                  <div className="absolute right-0 top-full mt-1 bg-card border rounded-lg shadow-lg z-10 py-1 min-w-[180px]">
                    {ALL_PROVIDERS.map((p) => (
                      <button
                        key={p}
                        onClick={() => { setAiProvider(p); setShowProviderSelect(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex justify-between ${aiProvider === p ? "bg-muted font-medium" : ""}`}
                      >
                        <span>{AI_LABELS[p].nome}</span>
                        <span className="text-muted-foreground">{AI_LABELS[p].custoEstimado}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={runAiAnalysis}
                disabled={aiLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                {aiLoading ? "Analisando..." : "Gerar Análise"}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {aiError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs mb-3">
              {aiError}
            </div>
          )}
          {aiResult ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm whitespace-pre-wrap leading-relaxed">
              {aiResult}
            </div>
          ) : !aiLoading ? (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Brain size={32} className="opacity-30" />
              <p className="text-sm">Clique em &quot;Gerar Análise&quot; para receber um diagnóstico estratégico completo</p>
              <p className="text-xs">A IA analisará todos os dados de Meta Ads, CRM e projeções para gerar um plano de ação</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Gerando análise estratégica com {AI_LABELS[aiProvider].nome}...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
