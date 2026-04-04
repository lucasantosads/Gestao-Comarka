"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Closer, LancamentoDiario, Contrato, MetaMensal, MetaCloser, LeadCrm } from "@/types/database";
import { calcKpis, trend, type KpiData } from "@/lib/kpis";
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  getPreviousMonth,
} from "@/lib/format";
import { KpiCard } from "@/components/kpi-card";
import { PeriodSelector } from "@/components/period-selector";
import { usePeriodFilter } from "@/hooks/use-period-filter";
import { ScoreCard } from "@/components/score-card";
import { calcularScore } from "@/lib/calculos";
import { DashboardCharts } from "@/components/dashboard-charts";
import { GaugeChart } from "@/components/gauge-chart";
import { FullscreenModal } from "@/components/fullscreen-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Maximize2 } from "lucide-react";
import { format } from "date-fns";

export default function DashboardPage() {
  const period = usePeriodFilter();
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [prevKpis, setPrevKpis] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  // Chart data
  const [meta, setMeta] = useState<MetaMensal | null>(null);
  const [metasClosers, setMetasClosers] = useState<Record<string, MetaCloser>>({});
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoDiario[]>([]);
  const [crmLeads, setCrmLeads] = useState<LeadCrm[]>([]);
  const [fullScore, setFullScore] = useState(false);
  const [fullGauges, setFullGauges] = useState(false);

  // Derivar mes_referencia do período atual para queries por mês
  const mes = format(period.current.start, "yyyy-MM");
  const prevMes = getPreviousMonth(mes);
  const startDate = format(period.current.start, "yyyy-MM-dd");
  const endDate = format(period.current.end, "yyyy-MM-dd");
  const prevStartDate = format(period.previous.start, "yyyy-MM-dd");
  const prevEndDate = format(period.previous.end, "yyyy-MM-dd");

  useEffect(() => {
    loadData();
  }, [period.current.start.getTime(), period.current.end.getTime()]);

  // Real-time
  useEffect(() => {
    const channel = supabase.channel("dashboard-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads_crm" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "lancamentos_diarios" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "contratos" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [mes]);

  async function loadData() {
    setLoading(true);
    const isMesMode = period.mode === "mes";

    // Para modo mês: usar mes_referencia (rápido). Para outros: filtrar por data range.
    const lancQuery = isMesMode
      ? supabase.from("lancamentos_diarios").select("*").eq("mes_referencia", mes)
      : supabase.from("lancamentos_diarios").select("*").gte("data", startDate).lte("data", endDate);
    const prevLancQuery = isMesMode
      ? supabase.from("lancamentos_diarios").select("*").eq("mes_referencia", prevMes)
      : supabase.from("lancamentos_diarios").select("*").gte("data", prevStartDate).lte("data", prevEndDate);
    const crmQuery = isMesMode
      ? supabase.from("leads_crm").select("etapa,valor_total_projeto,closer_id").eq("mes_referencia", mes)
      : supabase.from("leads_crm").select("etapa,valor_total_projeto,closer_id").gte("created_at", startDate).lte("created_at", endDate + "T23:59:59");
    const contratosQuery = isMesMode
      ? supabase.from("contratos").select("*").eq("mes_referencia", mes).order("data_fechamento")
      : supabase.from("contratos").select("*").gte("data_fechamento", startDate).lte("data_fechamento", endDate).order("data_fechamento");

    const [
      { data: lances },
      { data: prevLances },
      { data: config },
      { data: prevConfig },
      { data: closersData },
      { data: contratosData },
      { data: metaData },
      { data: mcData },
      { data: crmData },
    ] = await Promise.all([
      lancQuery,
      prevLancQuery,
      supabase.from("config_mensal").select("*").eq("mes_referencia", mes).single(),
      supabase.from("config_mensal").select("*").eq("mes_referencia", prevMes).single(),
      supabase.from("closers").select("*").eq("ativo", true).order("created_at"),
      contratosQuery,
      supabase.from("metas_mensais").select("*").eq("mes_referencia", mes).single(),
      supabase.from("metas_closers").select("*").eq("mes_referencia", mes),
      crmQuery,
    ]);

    const currentLances = (lances || []) as LancamentoDiario[];
    const currentContratos = (contratosData || []) as Contrato[];
    const currentCrmLeads = (crmData || []) as LeadCrm[];
    const currentKpis = calcKpis(currentLances, config || null, { contratos: currentContratos, crmLeads: currentCrmLeads });
    const previousKpis = calcKpis(
      (prevLances || []) as LancamentoDiario[],
      prevConfig || null
    );

    setKpis(currentKpis);
    setPrevKpis(previousKpis);
    setLancamentos(currentLances);
    setClosers((closersData || []) as Closer[]);
    setContratos((contratosData || []) as Contrato[]);
    setMeta((metaData as MetaMensal) || null);

    const mcMap: Record<string, MetaCloser> = {};
    for (const m of (mcData || []) as MetaCloser[]) {
      mcMap[m.closer_id] = m;
    }
    setMetasClosers(mcMap);

    setCrmLeads(currentCrmLeads);

    setLoading(false);
  }

  if (loading || !kpis) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const p = prevKpis!;

  type CardDef = { title: string; value: string; prev: string; t: "up" | "down" | "neutral"; invertTrend?: boolean };
  const c = (title: string, value: string, prev: string, t: "up" | "down" | "neutral", invertTrend?: boolean): CardDef => ({ title, value, prev, t, invertTrend });
  const trendDir = (inv?: boolean, t?: "up" | "down" | "neutral") => inv ? (t === "up" ? "down" as const : t === "down" ? "up" as const : "neutral" as const) : t;

  const faixas = [
    {
      label: "Funil",
      big: true,
      cards: [
        c("Leads", formatNumber(kpis.leads), formatNumber(p.leads), trend(kpis.leads, p.leads)),
        c("Reuniões Agendadas", formatNumber(kpis.reunioesAgendadas), formatNumber(p.reunioesAgendadas), trend(kpis.reunioesAgendadas, p.reunioesAgendadas)),
        c("Reuniões Feitas", formatNumber(kpis.reunioesFeitas), formatNumber(p.reunioesFeitas), trend(kpis.reunioesFeitas, p.reunioesFeitas)),
        c("No-Show", `${formatNumber(kpis.noShow)} (${formatPercent(kpis.percentNoShow)})`, `${formatNumber(p.noShow)} (${formatPercent(p.percentNoShow)})`, trend(kpis.percentNoShow, p.percentNoShow), true),
      ],
    },
    {
      label: "Resultado Financeiro",
      cards: [
        c("Contratos Fechados", formatNumber(kpis.contratosGanhos), formatNumber(p.contratosGanhos), trend(kpis.contratosGanhos, p.contratosGanhos)),
        c("LTV Total", formatCurrency(kpis.ltvTotal), formatCurrency(p.ltvTotal), trend(kpis.ltvTotal, p.ltvTotal)),
        c("Ganho de MRR", formatCurrency(kpis.mrrTotal), formatCurrency(p.mrrTotal), trend(kpis.mrrTotal, p.mrrTotal)),
        c("Ticket Médio", formatCurrency(kpis.ticketMedio), formatCurrency(p.ticketMedio), trend(kpis.ticketMedio, p.ticketMedio)),
      ],
    },
    {
      label: "Eficiência de Marketing",
      cards: [
        c("Valor Investido", formatCurrency(kpis.investimento), formatCurrency(p.investimento), trend(kpis.investimento, p.investimento), true),
        c("ROAS", kpis.roas.toFixed(2), p.roas.toFixed(2), trend(kpis.roas, p.roas)),
        c("Custo por Lead", formatCurrency(kpis.custoLead), formatCurrency(p.custoLead), trend(kpis.custoLead, p.custoLead), true),
        c("CAC Aproximado", formatCurrency(kpis.cacAproximado), formatCurrency(p.cacAproximado), trend(kpis.cacAproximado, p.cacAproximado), true),
      ],
    },
    {
      label: "Time",
      cards: [
        c("Gasto em Comissão", formatCurrency(kpis.comissoesTotal), formatCurrency(p.comissoesTotal), trend(kpis.comissoesTotal, p.comissoesTotal), true),
        c("Resultado do Time", formatCurrency(kpis.resultadoTime), formatCurrency(p.resultadoTime), trend(kpis.resultadoTime, p.resultadoTime)),
      ],
    },
  ];

  // Alertas de performance
  const alertas: { msg: string; tipo: "erro" | "aviso" }[] = [];
  if (kpis.percentNoShow > 30) alertas.push({ msg: `No-Show em ${formatPercent(kpis.percentNoShow)} — acima de 30%. Ação necessária.`, tipo: "erro" });
  if (kpis.roas > 0 && kpis.roas < 2) alertas.push({ msg: `ROAS em ${kpis.roas.toFixed(2)} — abaixo de 2x. Revisar investimento.`, tipo: "erro" });
  if (kpis.contratosGanhos === 0 && kpis.reunioesFeitas > 10) alertas.push({ msg: "Nenhum contrato fechado com mais de 10 reuniões feitas.", tipo: "erro" });

  // Verificação de divergências entre fontes
  const contratosTabela = contratos.length;
  const contratosLanc = kpis.contratosGanhos;
  const comprouCrm = crmLeads.filter((l) => l.etapa === "comprou").length;
  if (contratosLanc > 0 && contratosTabela !== contratosLanc) {
    alertas.push({ msg: `Divergência em contratos: Lançamentos=${contratosLanc}, Tabela Contratos=${contratosTabela}. Verifique se todos os contratos foram registrados na página de Contratos.`, tipo: "aviso" });
  }
  if (contratosLanc > 0 && comprouCrm !== contratosLanc) {
    alertas.push({ msg: `Divergência em "Comprou": Lançamentos=${contratosLanc}, CRM=${comprouCrm}. Atualize a etapa dos leads no CRM para "Comprou" ou corrija os lançamentos.`, tipo: "aviso" });
  }
  const mrrLanc = kpis.mrrTotal;
  const mrrContratos = contratos.reduce((s, c) => s + Number(c.mrr), 0);
  if (mrrLanc > 0 && mrrContratos > 0 && Math.abs(mrrLanc - mrrContratos) > 1) {
    alertas.push({ msg: `Divergência em MRR: Lançamentos=${formatCurrency(mrrLanc)}, Contratos=${formatCurrency(mrrContratos)}. Os valores devem ser iguais.`, tipo: "aviso" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
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
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className={`flex items-start gap-2 text-sm rounded-lg p-3 ${a.tipo === "erro" ? "bg-red-500/10 border border-red-500/20 text-red-400" : "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"}`}>
              <span className="shrink-0 mt-0.5">{a.tipo === "erro" ? "🚨" : "⚠️"}</span>
              <span>{a.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI Faixas */}
      {faixas.map((faixa) => (
        <div key={faixa.label}>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{faixa.label}</p>
          <div className={`grid gap-3 ${faixa.big ? "grid-cols-2 md:grid-cols-4" : faixa.cards.length === 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
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

      {/* CRM Mini Funnel */}
      {crmLeads.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Funil CRM <span className="text-xs font-normal text-muted-foreground ml-2">({crmLeads.length} leads)</span></CardTitle>
            <Link href="/crm" className="text-sm text-primary hover:underline">Ver CRM →</Link>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto">
              {[
                { key: "oportunidade", label: "Oportunidade", color: "bg-slate-500/20 text-slate-400" },
                { key: "reuniao_agendada", label: "Reunião", color: "bg-blue-500/20 text-blue-500" },
                { key: "proposta_enviada", label: "Proposta", color: "bg-purple-500/20 text-purple-500" },
                { key: "follow_up", label: "Follow Up", color: "bg-yellow-500/20 text-yellow-500" },
                { key: "assinatura_contrato", label: "Assinatura", color: "bg-orange-500/20 text-orange-500" },
                { key: "comprou", label: "Comprou", color: "bg-green-500/20 text-green-500" },
                { key: "desistiu", label: "Desistiu", color: "bg-red-500/20 text-red-500" },
              ].map((e) => (
                <div key={e.key} className="flex-1 min-w-[100px] text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">
                    {e.key === "comprou" ? kpis.contratosGanhos : crmLeads.filter((l) => l.etapa === e.key).length}
                  </p>
                  <Badge className={`text-xs ${e.color}`}>{e.label}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Link SDR */}

      {/* Score de Saúde */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Saúde do Time</h2>
          <Button variant="outline" size="sm" onClick={() => setFullScore(true)}>
            <Maximize2 size={14} className="mr-1" />TV
          </Button>
        </div>
        {(() => {
          const scoreCards = closers.map((c) => {
            const myLanc = lancamentos.filter((l) => l.closer_id === c.id);
            const mc = metasClosers[c.id];
            const marcadas = myLanc.reduce((s, l) => s + l.reunioes_marcadas, 0);
            const feitas = myLanc.reduce((s, l) => s + l.reunioes_feitas, 0);
            const ganhos = myLanc.reduce((s, l) => s + l.ganhos, 0);
            const mrr = myLanc.reduce((s, l) => s + Number(l.mrr_dia), 0);
            const ticketMedio = ganhos > 0 ? mrr / ganhos : 0;
            const scoreResult = calcularScore({
              reunioes_marcadas: marcadas, reunioes_feitas: feitas,
              contratos: ganhos, meta_contratos: mc?.meta_contratos ?? 0,
              ticket_medio: ticketMedio, ticket_meta: c.meta_ticket_medio ?? 0,
            });
            return { id: c.id, nome: c.nome, ...scoreResult };
          });
          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {scoreCards.map((s) => <ScoreCard key={s.id} nome={s.nome} score={s.score} status={s.status} detalhes={s.detalhes} closerId={s.id} />)}
            </div>
          );
        })()}
      </div>

      {/* Fullscreen: Score */}
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

      {/* Fullscreen: Gauges */}
      <FullscreenModal open={fullGauges} onClose={() => setFullGauges(false)}>
        <h1 className="text-4xl font-bold text-center mb-8">Metas do Mes</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <GaugeChart label="Entradas (MRR)" current={kpis.mrrTotal} target={Number(meta?.meta_entrada_valor ?? 0)} />
          <GaugeChart label="Faturamento / LTV" current={kpis.ltvTotal} target={Number(meta?.meta_faturamento_total ?? 0)} />
        </div>
      </FullscreenModal>

      {/* Charts Section */}
      <DashboardCharts
        meta={meta}
        metasClosers={metasClosers}
        contratos={contratos}
        closers={closers}
        lancamentos={lancamentos}
        onFullscreenGauges={() => setFullGauges(true)}
      />
    </div>
  );
}
