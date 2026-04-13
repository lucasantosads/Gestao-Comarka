"use client";

import { useEffect, useState, use, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  ArrowLeft,
  Wrench,
  Users,
  Sparkles,
  ExternalLink,
  Printer,
  TrendingUp,
  Activity,
  DollarSign,
  Target,
  Percent,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DetalheCliente {
  entrada_id: string;
  notion_id: string | null;
  nome: string;
  nicho: string | null;
  categoria: string | null;
  status: string | null;
  status_financeiro: string;
  situacao: string | null;
  analista: string | null;
  valor_mensal: number;
  ltv_12m: number;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  meta_leads_mes: number | null;
  meta_roas_minimo: number | null;
  score_saude: number | null;
  score_calculado_em: string | null;
  risco_churn: "baixo" | "medio" | "alto" | null;
  risco_churn_motivo: string | null;
  risco_churn_acao: string | null;
}

interface Metricas {
  spend: number;
  total_leads: number;
  leads_qualificados: number;
  cpl: number;
  roas: number;
  taxa_qualificacao: number;
  pct_meta_leads?: number | null;
}

interface HistoricoMes {
  month: string;
  spend: number;
  leads: number;
  cpl: number;
}

interface HistoricoMesYA {
  month: string;
  spend: number;
  leads: number;
}

interface Tese {
  id: string;
  nome_tese: string;
  tipo: string | null;
  status: string | null;
  orcamento: number | null;
  data_ativacao: string | null;
}

interface TimelineItem {
  tipo: "otimizacao" | "reuniao";
  data: string;
  titulo: string;
  detalhe: string | null;
  confirmado: boolean;
  snapshot: Record<string, unknown> | null;
}

interface Benchmark {
  nicho: string | null;
  total_clientes: number;
  score_medio: number | null;
  cpl_medio: number | null;
  roas_medio: number | null;
  comparativo: {
    rotulo: string;
    score: number | null;
    cpl: number | null;
    roas: number | null;
    is_self: boolean;
  }[];
}

interface Alerta {
  id: string;
  tipo: string;
  mensagem: string;
  criado_em: string;
}

interface MetaHistorico {
  meta_campaign_id: string;
  meta_adset_id: string | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
}

interface LeadIndividual {
  id: string;
  nome: string | null;
  etapa: string | null;
  telefone: string | null;
  ghl_created_at: string | null;
  valor_total_projeto: number | null;
}

interface Payload {
  periodo: string;
  cliente: DetalheCliente;
  metricas_periodo: Metricas;
  metricas_comparativo: Metricas;
  historico_mensal: HistoricoMes[];
  historico_mensal_ano_anterior: HistoricoMesYA[];
  leads_individuais: LeadIndividual[];
  alerta_sem_leads: boolean;
  teses: Tese[];
  timeline: TimelineItem[];
  benchmark: Benchmark;
  alertas: Alerta[];
  meta_historico: MetaHistorico[];
}

const RISCO_COLORS: Record<string, string> = {
  baixo: "bg-green-500/15 text-green-400 border-green-500/30",
  medio: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  alto: "bg-red-500/15 text-red-400 border-red-500/30",
};

function scoreColor(s: number | null) {
  if (s == null) return "text-muted-foreground";
  if (s >= 70) return "text-green-400";
  if (s >= 40) return "text-yellow-400";
  return "text-red-400";
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function Delta({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const bom = inverse ? pct < 0 : pct > 0;
  const color = bom ? "text-green-400" : "text-red-400";
  const sign = pct > 0 ? "+" : "";
  return (
    <span className={`text-[10px] ${color}`}>
      {sign}
      {pct.toFixed(1)}% vs anterior
    </span>
  );
}

export default function DetalhePerformancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagnostico, setDiagnostico] = useState<string>("");
  const [periodo, setPeriodo] = useState<"mes_atual" | "3m" | "6m" | "12m">("mes_atual");
  const [comparativoTipo, setComparativoTipo] = useState<
    "periodo_anterior" | "mesmo_periodo_ano_anterior"
  >("periodo_anterior");
  const [filtroLeadEtapa, setFiltroLeadEtapa] = useState<string>("todos");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/clientes/${id}/performance?periodo=${periodo}&comparativo=${comparativoTipo}`
        );
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Erro");
        setData(j);
      } catch (e) {
        toast.error(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, periodo, comparativoTipo]);

  async function gerarDiagnostico(salvarNotion: boolean) {
    setDiagLoading(true);
    try {
      const r = await fetch(`/api/clientes/${id}/diagnostico`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salvar_notion: salvarNotion }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erro");
      setDiagnostico(j.diagnostico || "");
      if (salvarNotion) {
        if (j.notion_url) toast.success("Salvo no Notion", { description: j.notion_url });
        else toast.warning("Diagnóstico gerado mas não foi possível salvar no Notion");
      } else {
        toast.success("Diagnóstico gerado");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDiagLoading(false);
    }
  }

  // Breakdown do score: tenta derivar componentes aproximados para visualização.
  // O cálculo oficial roda no cron job; aqui mostramos uma decomposição informativa.
  const scoreBreakdown = useMemo(() => {
    if (!data) return null;
    const m = data.metricas_periodo;
    const c = data.cliente;
    // Heurística para breakdown visual (mesma fórmula do job)
    const taxa = m.taxa_qualificacao;
    const qualif = taxa >= 0.4 ? 25 : taxa >= 0.3 ? 18 : taxa >= 0.2 ? 12 : 5;
    const leadsPct = c.meta_leads_mes
      ? Math.min(1, m.total_leads / c.meta_leads_mes)
      : m.total_leads > 0
      ? 0.5
      : 0;
    const leadsPts = Math.round(leadsPct * 25);
    // Estimativa de pontos de CPL e otimização (sem acesso às datas exatas aqui)
    const totalScore = c.score_saude ?? null;
    const conhecidos = qualif + leadsPts;
    const restante = totalScore != null ? Math.max(0, totalScore - conhecidos) : 0;
    // Divide o restante entre CPL (30 max) e otimização (20 max) proporcionalmente
    const cplPts = Math.min(30, Math.round((restante * 30) / 50));
    const otimPts = Math.min(20, restante - cplPts);
    return { qualif, leadsPts, cplPts, otimPts, total: totalScore };
  }, [data]);

  // Merge do histórico mensal com YA para o gráfico
  const chartData = useMemo(() => {
    if (!data) return [];
    const ya = new Map(
      (data.historico_mensal_ano_anterior || []).map((r) => [r.month.slice(5), r])
    );
    return data.historico_mensal.map((r) => {
      const yaR = ya.get(r.month.slice(5));
      return {
        month: r.month,
        spend: Math.round(r.spend),
        leads: r.leads,
        spend_ya: yaR ? Math.round(yaR.spend) : null,
        leads_ya: yaR ? yaR.leads : null,
      };
    });
  }, [data]);

  const leadsFiltrados = useMemo(() => {
    if (!data) return [];
    if (filtroLeadEtapa === "todos") return data.leads_individuais;
    return data.leads_individuais.filter((l) => l.etapa === filtroLeadEtapa);
  }, [data, filtroLeadEtapa]);

  const etapasUnicas = useMemo(() => {
    if (!data) return [];
    return Array.from(
      new Set(data.leads_individuais.map((l) => l.etapa).filter(Boolean))
    ) as string[];
  }, [data]);

  if (loading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (!data) return <div className="p-6 text-red-400">Cliente não encontrado</div>;

  const c = data.cliente;
  const m = data.metricas_periodo;
  const cmp = data.metricas_comparativo;
  const semCampanha = !c.meta_campaign_id;

  return (
    <>
      {/* Estilos de impressão para PDF via window.print() */}
      <style jsx global>{`
        @media print {
          nav,
          aside,
          header[role="banner"],
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-area {
            padding: 16px !important;
          }
          .print-area * {
            color: black !important;
            border-color: #ccc !important;
          }
          .print-area .bg-muted,
          .print-area [class*="bg-"] {
            background: transparent !important;
          }
        }
      `}</style>

      <div className="p-6 space-y-6 print-area">
        <div className="flex items-start justify-between">
          <div>
            <Link
              href="/dashboard/clientes/performance"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 no-print"
            >
              <ArrowLeft className="h-3 w-3" /> Voltar
            </Link>
            <h1 className="text-2xl font-bold mt-1">{c.nome}</h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
              <span>{c.nicho || "sem nicho"}</span>
              <span>•</span>
              <span>{c.categoria || "—"}</span>
              <span>•</span>
              <span>{c.status_financeiro}</span>
              {c.analista && (
                <>
                  <span>•</span>
                  <span>Analista: {c.analista}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={`text-3xl font-bold ${scoreColor(c.score_saude)}`}>
              {c.score_saude ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">Score de saúde</div>
            {c.risco_churn && (
              <span
                className={`text-xs px-2 py-0.5 rounded border ${RISCO_COLORS[c.risco_churn]}`}
                title={c.risco_churn_motivo || undefined}
              >
                Risco {c.risco_churn}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 no-print">
          <select
            className="bg-background border border-border rounded px-3 py-1.5 text-sm"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as typeof periodo)}
          >
            <option value="mes_atual">Mês atual</option>
            <option value="3m">Últimos 3 meses</option>
            <option value="6m">Últimos 6 meses</option>
            <option value="12m">Últimos 12 meses</option>
          </select>
          <select
            className="bg-background border border-border rounded px-3 py-1.5 text-sm"
            value={comparativoTipo}
            onChange={(e) => setComparativoTipo(e.target.value as typeof comparativoTipo)}
          >
            <option value="periodo_anterior">vs. período anterior</option>
            <option value="mesmo_periodo_ano_anterior">vs. mesmo período ano anterior</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            title="Exportar PDF via impressão"
          >
            <Printer className="h-3 w-3 mr-1" /> Exportar PDF
          </Button>
        </div>

        {data.alerta_sem_leads && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-4 text-sm text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>
                <strong>Campanha sem leads.</strong> Spend &gt; 0 nos últimos 3 dias mas nenhum lead
                recebido em <code>leads_crm</code> no mesmo período.
              </span>
            </CardContent>
          </Card>
        )}

        {data.alertas.length > 0 && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4 space-y-1">
              <div className="text-xs uppercase text-yellow-400 font-semibold">
                {data.alertas.length} alerta(s) ativo(s)
              </div>
              {data.alertas.map((a) => (
                <div key={a.id} className="text-sm">
                  • <span className="font-mono text-xs">{a.tipo}</span> — {a.mensagem}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {semCampanha && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4 text-sm text-yellow-400">
              ⚠ Campanha Meta não vinculada. Defina <code>meta_campaign_id</code> em{" "}
              <code>clientes_notion_mirror</code> para ver CPL/ROAS reais.
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="visao">
          <TabsList className="no-print">
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
            <TabsTrigger value="benchmark">Benchmark</TabsTrigger>
            <TabsTrigger value="ia">IA — Diagnóstico</TabsTrigger>
          </TabsList>

          {/* === VISÃO GERAL === */}
          <TabsContent value="visao" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card>
                <CardContent className="p-3">
                  <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Spend
                  </div>
                  <div className="text-lg font-bold tabular-nums">
                    {formatCurrency(m.spend)}
                  </div>
                  <Delta current={m.spend} previous={cmp.spend} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> CPL
                  </div>
                  <div className="text-lg font-bold tabular-nums">
                    {m.cpl > 0 ? formatCurrency(m.cpl) : "—"}
                  </div>
                  <Delta current={m.cpl} previous={cmp.cpl} inverse />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                    <Activity className="h-3 w-3" /> ROAS
                  </div>
                  <div className="text-lg font-bold tabular-nums">
                    {m.roas > 0 ? `${m.roas.toFixed(2)}x` : "—"}
                  </div>
                  <Delta current={m.roas} previous={cmp.roas} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Leads
                  </div>
                  <div className="text-lg font-bold tabular-nums">{m.total_leads}</div>
                  <Delta current={m.total_leads} previous={cmp.total_leads} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                    <Percent className="h-3 w-3" /> Qualif.
                  </div>
                  <div className="text-lg font-bold tabular-nums">
                    {(m.taxa_qualificacao * 100).toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {m.leads_qualificados}/{m.total_leads}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                    <Target className="h-3 w-3" /> % Meta
                  </div>
                  <div className="text-lg font-bold tabular-nums">
                    {m.pct_meta_leads != null ? `${m.pct_meta_leads}%` : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    meta: {c.meta_leads_mes ?? "—"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de linha spend vs leads 12m */}
            {chartData.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3 text-sm">Spend × Leads — últimos 12 meses</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="month" stroke="#71717a" fontSize={11} />
                      <YAxis
                        yAxisId="spend"
                        orientation="left"
                        stroke="#3b82f6"
                        fontSize={11}
                      />
                      <YAxis
                        yAxisId="leads"
                        orientation="right"
                        stroke="#10b981"
                        fontSize={11}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#18181b",
                          border: "1px solid #27272a",
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        yAxisId="spend"
                        type="monotone"
                        dataKey="spend"
                        stroke="#3b82f6"
                        name="Spend"
                        strokeWidth={2}
                      />
                      <Line
                        yAxisId="leads"
                        type="monotone"
                        dataKey="leads"
                        stroke="#10b981"
                        name="Leads"
                        strokeWidth={2}
                      />
                      {chartData.some((r) => r.spend_ya != null) && (
                        <Line
                          yAxisId="spend"
                          type="monotone"
                          dataKey="spend_ya"
                          stroke="#3b82f6"
                          name="Spend (ano anterior)"
                          strokeDasharray="4 4"
                          strokeWidth={1}
                          dot={false}
                        />
                      )}
                      {chartData.some((r) => r.leads_ya != null) && (
                        <Line
                          yAxisId="leads"
                          type="monotone"
                          dataKey="leads_ya"
                          stroke="#10b981"
                          name="Leads (ano anterior)"
                          strokeDasharray="4 4"
                          strokeWidth={1}
                          dot={false}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Breakdown do score */}
            {scoreBreakdown && scoreBreakdown.total != null && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3 text-sm">Breakdown do score de saúde</h3>
                  <div className="space-y-2 text-xs">
                    {[
                      { label: "Variação de CPL", pts: scoreBreakdown.cplPts, max: 30, color: "bg-blue-500" },
                      { label: "Leads vs. meta", pts: scoreBreakdown.leadsPts, max: 25, color: "bg-green-500" },
                      { label: "Taxa de qualificação", pts: scoreBreakdown.qualif, max: 25, color: "bg-yellow-500" },
                      { label: "Regularidade de otimização", pts: scoreBreakdown.otimPts, max: 20, color: "bg-purple-500" },
                    ].map((r) => (
                      <div key={r.label}>
                        <div className="flex justify-between mb-0.5">
                          <span>{r.label}</span>
                          <span className="tabular-nums">
                            {r.pts}/{r.max}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${r.color}`}
                            style={{ width: `${(r.pts / r.max) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="text-[10px] text-muted-foreground pt-1 border-t border-border mt-2">
                      Breakdown estimado visualmente. Cálculo oficial roda no cron semanal.
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 text-sm">Teses</h3>
                {data.teses.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhuma tese cadastrada.</div>
                ) : (
                  <div className="space-y-2">
                    {data.teses.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0"
                      >
                        <div>
                          <div className="font-medium">{t.nome_tese}</div>
                          <div className="text-xs text-muted-foreground">
                            {t.tipo || "—"} • ativada {fmtDate(t.data_ativacao)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="tabular-nums text-xs">
                            {formatCurrency(t.orcamento || 0)}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              t.status === "Ativa"
                                ? "bg-green-500/15 text-green-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {t.status || "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === LEADS === */}
          <TabsContent value="leads">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">
                    Leads do período ({data.leads_individuais.length})
                  </h3>
                  <select
                    className="bg-background border border-border rounded px-2 py-1 text-xs"
                    value={filtroLeadEtapa}
                    onChange={(e) => setFiltroLeadEtapa(e.target.value)}
                  >
                    <option value="todos">Todas as etapas</option>
                    {etapasUnicas.map((et) => (
                      <option key={et} value={et}>
                        {et}
                      </option>
                    ))}
                  </select>
                </div>
                {leadsFiltrados.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Nenhum lead no período.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="text-left px-2 py-2">Nome</th>
                          <th className="text-left px-2 py-2">Etapa</th>
                          <th className="text-left px-2 py-2">Telefone</th>
                          <th className="text-right px-2 py-2">Data</th>
                          <th className="text-right px-2 py-2">Custo est.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leadsFiltrados.map((l) => (
                          <tr key={l.id} className="border-t border-border">
                            <td className="px-2 py-2">{l.nome || "—"}</td>
                            <td className="px-2 py-2">
                              <span className="text-[11px] px-1.5 py-0.5 bg-muted rounded">
                                {l.etapa || "—"}
                              </span>
                            </td>
                            <td className="px-2 py-2 font-mono text-xs">{l.telefone || "—"}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-xs">
                              {fmtDate(l.ghl_created_at)}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums text-xs">
                              {m.total_leads > 0
                                ? formatCurrency(m.spend / m.total_leads)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === TIMELINE === */}
          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 text-sm">Eventos</h3>
                {data.timeline.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sem eventos registrados.</div>
                ) : (
                  <div className="space-y-3">
                    {data.timeline.map((item, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <div className="flex flex-col items-center">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center ${
                              item.tipo === "otimizacao"
                                ? "bg-blue-500/15 text-blue-400"
                                : "bg-purple-500/15 text-purple-400"
                            }`}
                          >
                            {item.tipo === "otimizacao" ? (
                              <Wrench className="h-4 w-4" />
                            ) : (
                              <Users className="h-4 w-4" />
                            )}
                          </div>
                          {i < data.timeline.length - 1 && (
                            <div className="w-px flex-1 bg-border mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.titulo}</span>
                            {!item.confirmado && item.tipo === "otimizacao" && (
                              <span className="text-xs text-yellow-400">não confirmada</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{fmtDate(item.data)}</div>
                          {item.detalhe && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {item.detalhe}
                            </div>
                          )}
                          {item.snapshot && Object.keys(item.snapshot).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(item.snapshot).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-mono"
                                >
                                  {k}: {String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {data.meta_historico.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3 text-sm">Histórico de vínculos Meta</h3>
                  <div className="space-y-1 text-xs font-mono">
                    {data.meta_historico.map((h, i) => (
                      <div key={i} className="flex items-center gap-3 border-b border-border pb-1 last:border-0">
                        <span className="text-muted-foreground">
                          {fmtDate(h.vigencia_inicio)} →{" "}
                          {h.vigencia_fim ? fmtDate(h.vigencia_fim) : "atual"}
                        </span>
                        <span>campaign {h.meta_campaign_id}</span>
                        {h.meta_adset_id && (
                          <span className="text-muted-foreground">adset {h.meta_adset_id}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* === BENCHMARK === */}
          <TabsContent value="benchmark">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Benchmark do nicho</h3>
                    <div className="text-xs text-muted-foreground">
                      {data.benchmark.nicho
                        ? `${data.benchmark.total_clientes} clientes em "${data.benchmark.nicho}"`
                        : "Cliente sem nicho definido"}
                    </div>
                  </div>
                  <div className="flex gap-4 text-right text-xs">
                    <div>
                      <div className="text-muted-foreground">CPL médio</div>
                      <div className="font-semibold tabular-nums">
                        {data.benchmark.cpl_medio
                          ? formatCurrency(data.benchmark.cpl_medio)
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">ROAS médio</div>
                      <div className="font-semibold tabular-nums">
                        {data.benchmark.roas_medio
                          ? `${data.benchmark.roas_medio.toFixed(2)}x`
                          : "—"}
                      </div>
                    </div>
                    {data.benchmark.score_medio != null && (
                      <div>
                        <div className="text-muted-foreground">Score médio</div>
                        <div
                          className={`text-lg font-bold ${scoreColor(data.benchmark.score_medio)}`}
                        >
                          {data.benchmark.score_medio}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {data.benchmark.comparativo.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sem dados para comparar.</div>
                ) : (
                  <div className="space-y-2">
                    {data.benchmark.comparativo.map((b, i) => {
                      const pct = b.score ?? 0;
                      const color =
                        pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
                      return (
                        <div key={i} className="flex items-center gap-3 text-xs">
                          <div
                            className={`w-28 truncate ${
                              b.is_self
                                ? "font-bold text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {b.rotulo}
                          </div>
                          <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                            <div
                              className={`h-full ${color}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="w-10 text-right tabular-nums">{b.score ?? "—"}</div>
                          <div className="w-20 text-right tabular-nums text-muted-foreground">
                            {b.cpl != null ? formatCurrency(b.cpl) : "—"}
                          </div>
                          <div className="w-14 text-right tabular-nums text-muted-foreground">
                            {b.roas != null ? `${b.roas.toFixed(1)}x` : "—"}
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground border-t border-border pt-1 mt-2">
                      <div className="w-28">Legenda</div>
                      <div className="flex-1">Score</div>
                      <div className="w-10 text-right">pts</div>
                      <div className="w-20 text-right">CPL</div>
                      <div className="w-14 text-right">ROAS</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === IA === */}
          <TabsContent value="ia">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> Diagnóstico com IA
                    </h3>
                    <div className="text-xs text-muted-foreground">
                      Claude Haiku analisa contexto operacional (teses, otimizações, reuniões,
                      score, risco).
                    </div>
                  </div>
                  <div className="flex gap-2 no-print">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={diagLoading}
                      onClick={() => gerarDiagnostico(false)}
                    >
                      {diagLoading ? "Analisando…" : "Gerar análise"}
                    </Button>
                    <Button
                      size="sm"
                      disabled={diagLoading || !diagnostico}
                      onClick={() => gerarDiagnostico(true)}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> Salvar no Notion
                    </Button>
                  </div>
                </div>

                {c.risco_churn_acao && (
                  <div className="text-xs border border-border rounded p-3 bg-muted/20">
                    <div className="text-muted-foreground uppercase mb-1">
                      Ação sugerida pela IA de risco ({c.risco_churn || "—"})
                    </div>
                    <div>{c.risco_churn_acao}</div>
                  </div>
                )}

                {diagnostico ? (
                  <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap border-t border-border pt-4">
                    {diagnostico}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground border-t border-border pt-4">
                    Clique em &quot;Gerar análise&quot; para começar.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
