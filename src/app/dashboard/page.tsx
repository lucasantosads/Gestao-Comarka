"use client";

import { useState } from "react";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format";
import { KpiCard } from "@/components/kpi-card";
import { SyncButton } from "@/components/sync-button";
import { PeriodSelector } from "@/components/period-selector";
import { usePeriodFilter } from "@/hooks/use-period-filter";
import { ScoreCard } from "@/components/score-card";
import { calcularScore } from "@/lib/calculos";
import { DashboardCharts } from "@/components/dashboard-charts";
import { GestorCapacidade } from "@/components/gestor-capacidade";
import { GaugeChart } from "@/components/gauge-chart";
import { FullscreenModal } from "@/components/fullscreen-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Maximize2, AlertTriangle } from "lucide-react";
import { AlertsPanel } from "@/components/alerts-panel";
import { useDashboardData } from "@/hooks/use-dashboard-data";

export default function DashboardPage() {
  const period = usePeriodFilter();
  const [fullScore, setFullScore] = useState(false);
  const [fullGauges, setFullGauges] = useState(false);

  const {
    kpis, prevKpis, meta, contratos, closers, lancamentos, crmLeads,
    sdrAlerts, ghlClosersOpen, churnData, custosOp,
    loading, alertas, metasClosers, loadData, attrStart, apiErrors
  } = useDashboardData(period);

  const renderHeader = () => (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <SyncButton source="all" onDone={loadData} />
      </div>
      <PeriodSelector
        mode={period.mode}
        label={period.label}
        compareLabel={period.compareLabel}
        onModeChange={period.setMode}
        onPrev={period.prev}
        onNext={period.next}
        onCustomApply={period.setCustom}
      />
      {apiErrors.length > 0 && (
        <div className="flex flex-col gap-1 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-lg mt-2">
          <p className="font-semibold flex items-center gap-1"><AlertTriangle size={14} /> Falha de Integração:</p>
          {apiErrors.map(err => <span key={err}>- {err}</span>)}
        </div>
      )}
    </div>
  );

  if (loading || !kpis || !prevKpis) {
    return (
      <div className="space-y-6">
        {renderHeader()}
        <div className="flex items-center justify-center h-64 border rounded-xl bg-card/30">
          <p className="text-muted-foreground animate-pulse">Carregando métricas...</p>
        </div>
      </div>
    );
  }

  type CardDef = { title: string; value: string; prev: string; t: "up" | "down" | "neutral"; invertTrend?: boolean };
  const c = (title: string, value: string, prev: string, t: "up" | "down" | "neutral", invertTrend?: boolean): CardDef => ({ title, value, prev, t, invertTrend });

  const trend = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? "up" : "neutral";
    return cur > prev ? "up" : cur < prev ? "down" : "neutral";
  };
  const trendDir = (inv?: boolean, t?: "up" | "down" | "neutral") => inv ? (t === "up" ? "down" as const : t === "down" ? "up" as const : "neutral" as const) : t;

  // MRR Projetado calculation
  const propostaEnviada = crmLeads.filter((l) => l.etapa === "proposta_enviada");
  const comprouLeads = crmLeads.filter((l) => l.etapa === "comprou");
  const totalPropostaEComprou = propostaEnviada.length + comprouLeads.length;
  const taxaConvProposta = totalPropostaEComprou > 0 ? comprouLeads.length / totalPropostaEComprou : 0;
  const avgMrrPerContrato = kpis.contratosGanhos > 0 ? kpis.mrrTotal / kpis.contratosGanhos : 0;
  const mrrProjetado = kpis.mrrTotal + (propostaEnviada.length * taxaConvProposta * avgMrrPerContrato);

  const faixas = [
    {
      label: "Funil", big: true, cards: [
        c("Leads", formatNumber(kpis.leads), formatNumber(prevKpis.leads), trend(kpis.leads, prevKpis.leads)),
        c("Reuniões Agendadas", formatNumber(kpis.reunioesAgendadas), formatNumber(prevKpis.reunioesAgendadas), trend(kpis.reunioesAgendadas, prevKpis.reunioesAgendadas)),
        c("Reuniões Feitas", formatNumber(kpis.reunioesFeitas), formatNumber(prevKpis.reunioesFeitas), trend(kpis.reunioesFeitas, prevKpis.reunioesFeitas)),
        c("Taxa Comparecimento", formatPercent(kpis.reunioesAgendadas > 0 ? (kpis.reunioesFeitas / kpis.reunioesAgendadas) * 100 : 0), formatPercent(prevKpis.reunioesAgendadas > 0 ? (prevKpis.reunioesFeitas / prevKpis.reunioesAgendadas) * 100 : 0), trend(kpis.reunioesAgendadas > 0 ? kpis.reunioesFeitas / kpis.reunioesAgendadas : 0, prevKpis.reunioesAgendadas > 0 ? prevKpis.reunioesFeitas / prevKpis.reunioesAgendadas : 0)),
        c("No-Show", `${formatNumber(kpis.noShow)} (${formatPercent(kpis.percentNoShow)})`, `${formatNumber(prevKpis.noShow)} (${formatPercent(prevKpis.percentNoShow)})`, trend(kpis.percentNoShow, prevKpis.percentNoShow), true),
      ]
    }, {
      label: "Resultado Financeiro", cards: [
        c("Contratos Fechados", formatNumber(kpis.contratosGanhos), formatNumber(prevKpis.contratosGanhos), trend(kpis.contratosGanhos, prevKpis.contratosGanhos)),
        c("LTV Total", formatCurrency(kpis.ltvTotal), formatCurrency(prevKpis.ltvTotal), trend(kpis.ltvTotal, prevKpis.ltvTotal)),
        c("Ganho de MRR", formatCurrency(kpis.mrrTotal), formatCurrency(prevKpis.mrrTotal), trend(kpis.mrrTotal, prevKpis.mrrTotal)),
        c("MRR Projetado", formatCurrency(mrrProjetado), `${propostaEnviada.length} propostas`, mrrProjetado > kpis.mrrTotal ? "up" : "neutral"),
        c("Ticket Médio", formatCurrency(kpis.ticketMedio), formatCurrency(prevKpis.ticketMedio), trend(kpis.ticketMedio, prevKpis.ticketMedio)),
      ]
    }, {
      label: "Eficiência de Marketing", cards: [
        c("Valor Investido", formatCurrency(kpis.investimento), formatCurrency(prevKpis.investimento), trend(kpis.investimento, prevKpis.investimento), true),
        c("ROAS", kpis.roas.toFixed(2), prevKpis.roas.toFixed(2), trend(kpis.roas, prevKpis.roas)),
        c("Custo por Lead", formatCurrency(kpis.custoLead), formatCurrency(prevKpis.custoLead), trend(kpis.custoLead, prevKpis.custoLead), true),
        c("CAC Aproximado", formatCurrency(kpis.cacAproximado), formatCurrency(prevKpis.cacAproximado), trend(kpis.cacAproximado, prevKpis.cacAproximado), true),
      ]
    }, {
      label: "Time", cards: [
        c("Gasto em Comissão", formatCurrency(kpis.comissoesTotal), formatCurrency(prevKpis.comissoesTotal), trend(kpis.comissoesTotal, prevKpis.comissoesTotal), true),
        c("Resultado do Time", formatCurrency(kpis.resultadoTime), formatCurrency(prevKpis.resultadoTime), trend(kpis.resultadoTime, prevKpis.resultadoTime)),
        c("Custos Operacionais", formatCurrency(custosOp), "—", custosOp > 0 ? "up" : "neutral", true),
        c("Margem Operacional", kpis.mrrTotal > 0 ? `${(((kpis.mrrTotal - custosOp) / kpis.mrrTotal) * 100).toFixed(1)}%` : "—", "—", kpis.mrrTotal > 0 ? ((kpis.mrrTotal - custosOp) / kpis.mrrTotal > 0.2 ? "up" : "down") : "neutral"),
      ]
    }
  ];

  const fullAlertas = [...alertas];
  // Alerta Burn Rate
  const diaAtual = new Date().getDay();
  const isFds = diaAtual === 0 || diaAtual === 6;
  if (!isFds && custosOp > 0 && kpis.mrrTotal > 0) {
    const burnPct = (custosOp / kpis.mrrTotal) * 100;
    const margemPct = 100 - burnPct;
    if (burnPct > 95) fullAlertas.push({ msg: `Burn Rate Critico: custos de ${formatCurrency(custosOp)} representam ${burnPct.toFixed(0)}% da receita. Margem de apenas ${margemPct.toFixed(1)}%.`, tipo: "erro" });
    else if (burnPct > 85) fullAlertas.push({ msg: `Burn Rate Alto: custos de ${formatCurrency(custosOp)} representam ${burnPct.toFixed(0)}% da receita. Margem de ${margemPct.toFixed(1)}%.`, tipo: "aviso" });
  }

  for (const sa of sdrAlerts) {
    fullAlertas.push({ msg: `[SDR] ${sa.msg}`, tipo: sa.tipo === "qualificacao_baixa" || sa.tipo === "desqualificacao_alta" ? "erro" : "aviso" });
  }

  return (
    <div className="space-y-8">
      {renderHeader()}

      <AlertsPanel alertas={fullAlertas} />

      {faixas.map((faixa) => (
        <div key={faixa.label}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 font-medium mb-3">{faixa.label}</p>
          <div className={`grid gap-4 md:gap-6 ${faixa.big ? "grid-cols-2 md:grid-cols-4" : faixa.cards.length === 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
            {faixa.cards.map((card) => (
              <KpiCard
                key={card.title}
                title={card.title}
                value={card.value}
                previousValue={card.prev}
                trend={trendDir(card.invertTrend, card.t)}
                className={faixa.big ? "border-l-2 border-l-primary/30" : ""}
              />
            ))}
          </div>
        </div>
      ))}

      {(crmLeads.length > 0 || ghlClosersOpen.length > 0) && (() => {
        const sdrAtivos = crmLeads.filter((l) => !["comprou", "desistiu"].includes(l.etapa)).length;
        const closersAtivos = ghlClosersOpen.reduce((s, c) => s + c.aberto, 0);
        const totalAtivos = sdrAtivos + closersAtivos;
        return (
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-2xl font-bold">{totalAtivos}</span>
                <span className="text-sm text-muted-foreground">leads ativos no pipeline</span>
                <div className="flex gap-1.5 ml-2 flex-wrap">
                  {sdrAtivos > 0 && <Badge variant="outline" className="text-[9px]">SDR: {sdrAtivos}</Badge>}
                  {ghlClosersOpen.filter((c) => c.aberto > 0).map((c) => (
                    <Badge key={c.name} variant="outline" className="text-[9px]">{c.name}: {c.aberto}</Badge>
                  ))}
                  {[
                    { key: "oportunidade" }, { key: "reuniao_agendada" }, { key: "proposta_enviada" }, { key: "comprou" },
                  ].map((e) => {
                    const count = e.key === "comprou" ? kpis.contratosGanhos : crmLeads.filter((l) => l.etapa === e.key).length;
                    return count > 0 ? (
                      <Badge key={e.key} variant="outline" className="text-[9px]">
                        {count} {e.key === "comprou" ? "fechados" : e.key === "reuniao_agendada" ? "reunião" : e.key === "proposta_enviada" ? "proposta" : "novos"}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
              <Link href="/crm" className="text-sm text-primary hover:underline shrink-0">Ver CRM →</Link>
            </CardContent>
          </Card>
        );
      })()}

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-tight">Saúde do Time</h2>
            <Button variant="outline" size="sm" onClick={() => setFullScore(true)} className="text-xs h-7 px-2">
              <Maximize2 size={12} className="mr-1" />TV
            </Button>
          </div>
          <div className="space-y-2">
            {closers.map((cl) => {
              const myLanc = lancamentos.filter((l) => l.closer_id === cl.id);
              const mc = metasClosers[cl.id];
              const marcadas = myLanc.reduce((s, l) => s + l.reunioes_marcadas, 0);
              const feitas = myLanc.reduce((s, l) => s + l.reunioes_feitas, 0);
              const ganhos = myLanc.reduce((s, l) => s + l.ganhos, 0);
              const mrr = myLanc.reduce((s, l) => s + Number(l.mrr_dia), 0);
              const ticketMedio = ganhos > 0 ? mrr / ganhos : 0;
              const sr = calcularScore({
                reunioes_marcadas: marcadas, reunioes_feitas: feitas,
                contratos: ganhos, meta_contratos: mc?.meta_contratos ?? 0,
                ticket_medio: ticketMedio, ticket_meta: cl.meta_ticket_medio ?? 0,
              });
              const statusColor = sr.status === "saudavel" ? "bg-green-500/15 text-green-400" : sr.status === "atencao" ? "bg-yellow-500/15 text-yellow-400" : "bg-red-500/15 text-red-400";
              const statusLabel = sr.status === "saudavel" ? "OK" : sr.status === "atencao" ? "Atenção" : "Crítico";
              return (
                <div key={cl.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{cl.nome}</span>
                    <Badge className={`text-[9px] ${statusColor}`}>{statusLabel}</Badge>
                    <span className="text-xs text-muted-foreground font-mono">{sr.score}/100</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{ganhos} contratos · {formatCurrency(mrr)} MRR</span>
                    <Link href={`/dashboard/closers/${cl.id}`} className="text-xs text-primary hover:underline">Ver análise →</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <FullscreenModal open={fullScore} onClose={() => setFullScore(false)}>
        <h1 className="text-4xl font-bold text-center mb-8">Saúde do Time</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {closers.map((c) => {
            const myLanc = lancamentos.filter((l) => l.closer_id === c.id);
            const mc = metasClosers[c.id];
            const marcadas = myLanc.reduce((s, l) => s + l.reunioes_marcadas, 0);
            const feitas = myLanc.reduce((s, l) => s + l.reunioes_feitas, 0);
            const ganhos = myLanc.reduce((s, l) => s + l.ganhos, 0);
            const mrr = myLanc.reduce((s, l) => s + Number(l.mrr_dia), 0);
            const ticketMedio = ganhos > 0 ? mrr / ganhos : 0;
            const sr = calcularScore({
              reunioes_marcadas: marcadas, reunioes_feitas: feitas,
              contratos: ganhos, meta_contratos: mc?.meta_contratos ?? 0,
              ticket_medio: ticketMedio, ticket_meta: c.meta_ticket_medio ?? 0,
            });
            return <ScoreCard key={c.id} nome={c.nome} {...sr} closerId={c.id} />;
          })}
        </div>
      </FullscreenModal>

      <FullscreenModal open={fullGauges} onClose={() => setFullGauges(false)}>
        <h1 className="text-4xl font-bold text-center mb-8">Metas do Mes</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <GaugeChart label="Entradas" current={kpis.entradaTotal} target={Number(meta?.meta_entrada_valor ?? 0)} />
          <GaugeChart label="Faturamento (MRR)" current={kpis.mrrTotal} target={Number(meta?.meta_faturamento_total ?? 0)} />
        </div>
      </FullscreenModal>

      {churnData && (churnData.mrrEmRisco > 0 || churnData.mrrPerdidoMes > 0) && (
        <Card className={churnData.mrrEmRisco > 0 ? "border-red-500/20" : ""}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold flex items-center gap-2">Impacto do Churn</p>
              <Link href="/churn" className="text-xs text-primary hover:underline">Ver detalhes →</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Churn Rate</p>
                <p className={`text-lg font-bold ${churnData.churnRate > 7 ? "text-red-400" : churnData.churnRate > 4 ? "text-yellow-400" : "text-green-400"}`}>{churnData.churnRate.toFixed(1)}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">MRR Perdido (mes)</p>
                <p className="text-lg font-bold text-red-400">{formatCurrency(churnData.mrrPerdidoMes)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">MRR em Risco</p>
                <p className="text-lg font-bold text-yellow-400">{formatCurrency(churnData.mrrEmRisco)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Crescimento Liquido</p>
                <p className={`text-lg font-bold ${kpis.mrrTotal - churnData.mrrPerdidoMes > 0 ? "text-green-400" : "text-red-400"}`}>
                  {formatCurrency(kpis.mrrTotal - churnData.mrrPerdidoMes)}
                </p>
                <p className="text-[9px] text-muted-foreground">MRR {formatCurrency(kpis.mrrTotal)} - Churn {formatCurrency(churnData.mrrPerdidoMes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <DashboardCharts
        meta={meta!}
        metasClosers={metasClosers}
        contratos={contratos}
        closers={closers}
        lancamentos={lancamentos}
        onFullscreenGauges={() => setFullGauges(true)}
      />

      <GestorCapacidade />
    </div>
  );
}
