"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Closer, LancamentoDiario, Contrato, MetaCloser, ConfigMensal } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { GaugeChart } from "@/components/gauge-chart";
import { MonthSelector } from "@/components/month-selector";
import { ScoreCard } from "@/components/score-card";
import { calcularScore } from "@/lib/calculos";
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  getCurrentMonth,
  getPreviousMonth,
  isWeekend,
} from "@/lib/format";
import { trend } from "@/lib/kpis";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Progress bar
function ProgressBar({ label, current, target, format = "number", inverse = false }: {
  label: string; current: number; target: number; format?: "number" | "currency" | "percent"; inverse?: boolean;
}) {
  const pct = target > 0 ? (current / target) * 100 : 0;
  const displayPct = Math.min(pct, 100);
  const color = inverse ? "bg-red-500" : "bg-green-500";

  const fmt = (v: number) => {
    if (format === "currency") return formatCurrency(v);
    if (format === "percent") return formatPercent(v);
    return String(Math.round(v));
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{fmt(current)} / {fmt(target)} <span className="text-xs text-muted-foreground">({pct.toFixed(0)}%)</span></span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${displayPct}%` }} />
      </div>
    </div>
  );
}

interface CloserKpis {
  ganhos: number;
  reunioesAgendadas: number;
  reunioesFeitas: number;
  percentFeitas: number;
  noShow: number;
  percentNoShow: number;
  percentConversao: number;
  ltvTotal: number;
  mrrTotal: number;
  comissoes: number;
  ticketMedio: number;
  gastoComReunioes: number;
  cacIndividual: number;
  custoRetorno: number;
  retornoCloser: number;
}

function calcCloserKpis(
  lancamentos: LancamentoDiario[],
  opts: { investimento?: number; feitasGlobal?: number }
): CloserKpis {
  const safe = (n: number, d: number) => (d > 0 ? n / d : 0);
  const reunioesAgendadas = lancamentos.reduce((s, l) => s + l.reunioes_marcadas, 0);
  const reunioesFeitas = lancamentos.reduce((s, l) => s + l.reunioes_feitas, 0);
  const noShow = reunioesAgendadas - reunioesFeitas;
  const ganhos = lancamentos.reduce((s, l) => s + l.ganhos, 0);
  const mrrTotal = lancamentos.reduce((s, l) => s + Number(l.mrr_dia), 0);
  const ltvTotal = lancamentos.reduce((s, l) => s + Number(l.ltv), 0);
  const comissoes = mrrTotal * 0.1;
  const ticketMedio = safe(mrrTotal, ganhos);
  const cprf = safe(opts.investimento || 0, opts.feitasGlobal || 0);
  const gastoComReunioes = cprf * reunioesFeitas;
  const cacIndividual = safe(gastoComReunioes, ganhos);
  const custoRetorno = safe(mrrTotal, gastoComReunioes);
  const retornoCloser = mrrTotal - comissoes - gastoComReunioes;

  return {
    ganhos, reunioesAgendadas, reunioesFeitas,
    percentFeitas: safe(reunioesFeitas, reunioesAgendadas) * 100,
    noShow, percentNoShow: safe(noShow, reunioesAgendadas) * 100,
    percentConversao: safe(ganhos, reunioesFeitas) * 100,
    ltvTotal, mrrTotal, comissoes, ticketMedio,
    gastoComReunioes, cacIndividual, custoRetorno, retornoCloser,
  };
}

export default function CloserPage() {
  const { id } = useParams<{ id: string }>();
  const [mes, setMes] = useState(getCurrentMonth);
  const [closer, setCloser] = useState<Closer | null>(null);
  const [lancamentos, setLancamentos] = useState<LancamentoDiario[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [metaCloser, setMetaCloser] = useState<MetaCloser | null>(null);
  const [kpis, setKpis] = useState<CloserKpis | null>(null);
  const [prevKpis, setPrevKpis] = useState<CloserKpis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [id, mes]);

  async function loadData() {
    setLoading(true);
    const prevMes = getPreviousMonth(mes);

    const [closerRes, lancesRes, prevLancesRes, contratosRes, metaRes, configRes, allLancesRes, prevAllLancesRes, prevConfigRes] =
      await Promise.all([
        supabase.from("closers").select("*").eq("id", id).single(),
        supabase.from("lancamentos_diarios").select("*").eq("closer_id", id).eq("mes_referencia", mes).order("data"),
        supabase.from("lancamentos_diarios").select("*").eq("closer_id", id).eq("mes_referencia", prevMes).order("data"),
        supabase.from("contratos").select("*").eq("closer_id", id).eq("mes_referencia", mes).order("data_fechamento"),
        supabase.from("metas_closers").select("*").eq("closer_id", id).eq("mes_referencia", mes).single(),
        supabase.from("config_mensal").select("*").eq("mes_referencia", mes).single(),
        supabase.from("lancamentos_diarios").select("reunioes_feitas").eq("mes_referencia", mes),
        supabase.from("lancamentos_diarios").select("reunioes_feitas").eq("mes_referencia", prevMes),
        supabase.from("config_mensal").select("*").eq("mes_referencia", prevMes).single(),
      ]);

    setCloser(closerRes.data || null);
    const currentLances = (lancesRes.data || []) as LancamentoDiario[];
    const currentContratos = (contratosRes.data || []) as Contrato[];
    const config = configRes.data as ConfigMensal | null;
    const investimento = Number(config?.investimento ?? 0);
    const feitasGlobal = (allLancesRes.data || []).reduce((s: number, l: { reunioes_feitas: number }) => s + l.reunioes_feitas, 0);

    const prevConfig = prevConfigRes.data as ConfigMensal | null;
    const prevInvestimento = Number(prevConfig?.investimento ?? 0);
    const prevFeitasGlobal = (prevAllLancesRes.data || []).reduce((s: number, l: { reunioes_feitas: number }) => s + l.reunioes_feitas, 0);

    setLancamentos(currentLances);
    setContratos(currentContratos);
    setKpis(calcCloserKpis(currentLances, { investimento, feitasGlobal }));
    setPrevKpis(calcCloserKpis((prevLancesRes.data || []) as LancamentoDiario[], { investimento: prevInvestimento, feitasGlobal: prevFeitasGlobal }));
    setMetaCloser((metaRes.data as MetaCloser) || null);
    setLoading(false);
  }

  if (loading || !kpis || !closer) {
    return (<div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>);
  }

  const p = prevKpis!;

  const cards: { title: string; value: string; prev: string; t: "up" | "down" | "neutral"; invertTrend?: boolean }[] = [
    { title: "Contratos Fechados", value: formatNumber(kpis.ganhos), prev: formatNumber(p.ganhos), t: trend(kpis.ganhos, p.ganhos) },
    { title: "Reuniões Agendadas", value: formatNumber(kpis.reunioesAgendadas), prev: formatNumber(p.reunioesAgendadas), t: trend(kpis.reunioesAgendadas, p.reunioesAgendadas) },
    { title: "Reuniões Feitas", value: formatNumber(kpis.reunioesFeitas), prev: formatNumber(p.reunioesFeitas), t: trend(kpis.reunioesFeitas, p.reunioesFeitas) },
    { title: "No Show", value: `${formatNumber(kpis.noShow)} (${formatPercent(kpis.percentNoShow)})`, prev: `${formatNumber(p.noShow)} (${formatPercent(p.percentNoShow)})`, t: trend(kpis.percentNoShow, p.percentNoShow), invertTrend: true },
    { title: "% Conversão / Reunião", value: formatPercent(kpis.percentConversao), prev: formatPercent(p.percentConversao), t: trend(kpis.percentConversao, p.percentConversao) },
    { title: "CAC Individual", value: formatCurrency(kpis.cacIndividual), prev: formatCurrency(p.cacIndividual), t: trend(kpis.cacIndividual, p.cacIndividual), invertTrend: true },
    { title: "Ticket Médio", value: formatCurrency(kpis.ticketMedio), prev: formatCurrency(p.ticketMedio), t: trend(kpis.ticketMedio, p.ticketMedio) },
    { title: "LTV em Contrato", value: formatCurrency(kpis.ltvTotal), prev: formatCurrency(p.ltvTotal), t: trend(kpis.ltvTotal, p.ltvTotal) },
    { title: "Gasto com Reuniões", value: formatCurrency(kpis.gastoComReunioes), prev: formatCurrency(p.gastoComReunioes), t: trend(kpis.gastoComReunioes, p.gastoComReunioes), invertTrend: true },
    { title: "MRR Gerado", value: formatCurrency(kpis.mrrTotal), prev: formatCurrency(p.mrrTotal), t: trend(kpis.mrrTotal, p.mrrTotal) },
    { title: "Custo/Retorno", value: kpis.custoRetorno.toFixed(2), prev: p.custoRetorno.toFixed(2), t: trend(kpis.custoRetorno, p.custoRetorno) },
    { title: "Comissões (10%)", value: formatCurrency(kpis.comissoes), prev: formatCurrency(p.comissoes), t: trend(kpis.comissoes, p.comissoes) },
    { title: "Retorno do Closer", value: formatCurrency(kpis.retornoCloser), prev: formatCurrency(p.retornoCloser), t: trend(kpis.retornoCloser, p.retornoCloser) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{closer.nome}</h1>
          <p className="text-sm text-muted-foreground">Perfil individual do closer</p>
        </div>
        <MonthSelector value={mes} onChange={setMes} />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <KpiCard
            key={c.title}
            title={c.title}
            value={c.value}
            previousValue={c.prev}
            trend={c.invertTrend ? (c.t === "up" ? "down" : c.t === "down" ? "up" : "neutral") : c.t}
          />
        ))}
      </div>

      {/* Score de Saúde */}
      {(() => {
        const sr = calcularScore({
          reunioes_marcadas: kpis.reunioesAgendadas, reunioes_feitas: kpis.reunioesFeitas,
          contratos: kpis.ganhos, meta_contratos: metaCloser?.meta_contratos ?? 0,
          ticket_medio: kpis.ticketMedio, ticket_meta: closer.meta_ticket_medio ?? 0,
        });
        return (
          <div className="max-w-sm">
            <ScoreCard nome={closer.nome} score={sr.score} status={sr.status} detalhes={sr.detalhes} />
          </div>
        );
      })()}

      {/* Gauges de Metas */}
      {metaCloser && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GaugeChart
              label="Entradas (MRR)"
              current={kpis.mrrTotal}
              target={Number(metaCloser.meta_mrr)}
            />
            <GaugeChart
              label="Faturamento / LTV"
              current={kpis.ltvTotal}
              target={Number(metaCloser.meta_ltv)}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atingimento de Metas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProgressBar label="Contratos" current={kpis.ganhos} target={metaCloser.meta_contratos} />
              <ProgressBar label="MRR" current={kpis.mrrTotal} target={Number(metaCloser.meta_mrr)} format="currency" />
              <ProgressBar label="Reuniões Feitas" current={kpis.reunioesFeitas} target={metaCloser.meta_reunioes_feitas} />
            </CardContent>
          </Card>
        </>
      )}

      {/* Historico Diario */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Histórico Diário</h2>
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Agendadas</TableHead>
                <TableHead className="text-right">Feitas</TableHead>
                <TableHead className="text-right">No Show</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancamentos.map((l) => {
                const d = new Date(l.data + "T12:00:00");
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      {isWeekend(d) && <Badge variant="outline" className="ml-2 text-xs">FDS</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{l.reunioes_marcadas}</TableCell>
                    <TableCell className="text-right">{l.reunioes_feitas}</TableCell>
                    <TableCell className="text-right">{l.no_show}</TableCell>
                  </TableRow>
                );
              })}
              {lancamentos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum lancamento neste mes</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Contratos */}
      {contratos.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Contratos do Mes</h2>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Entrada</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{new Date(c.data_fechamento + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</TableCell>
                    <TableCell className="font-medium">{c.cliente_nome}</TableCell>
                    <TableCell>{c.origem_lead}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(c.valor_entrada))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(c.mrr))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(c.valor_total_projeto))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
