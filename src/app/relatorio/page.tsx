"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LancamentoDiario, ConfigMensal, LeadCrm, Closer, MetaMensal } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent, formatMonthLabel } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine,
} from "recharts";

interface MesData {
  mes: string;
  label: string;
  leads: number;
  investimento: number;
  reunioesAgendadas: number;
  reunioesFeitas: number;
  noShow: number;
  percentNoShow: number;
  contratos: number;
  mrr: number;
  ltv: number;
  comissao: number;
  custoLead: number;
  percentLeadsReuniao: number;
  custoReuniaoFeita: number;
  percentLeadsContrato: number;
  cacMarketing: number;
  cacAproximado: number;
  ticketMedio: number;
  roas: number;
  resultado: number;
}

const MESES = ["2026-01", "2026-02", "2026-03", "2026-04"];

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "green" | "red" | "blue" | "yellow" }) {
  const colors = { green: "text-green-400", red: "text-red-400", blue: "text-blue-400", yellow: "text-yellow-400" };
  return (
    <div className="flex justify-between items-baseline py-1 border-b border-muted/30 last:border-0">
      <span className="text-xs text-muted-foreground truncate mr-2">{label}</span>
      <div className="text-right shrink-0">
        <span className={`text-sm font-mono font-medium ${accent ? colors[accent] : ""}`}>{value}</span>
        {sub && <span className="text-[10px] text-muted-foreground ml-1">({sub})</span>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-3 mb-1">{children}</p>;
}

function calcMesData(
  mes: string,
  lanc: LancamentoDiario[],
  config: ConfigMensal | undefined,
  crm: LeadCrm[]
): MesData {
  const safe = (n: number, d: number) => (d > 0 ? n / d : 0);
  const leads = config?.leads_totais ?? 0;
  const investimento = Number(config?.investimento ?? 0);
  const reunioesAgendadas = lanc.reduce((s, l) => s + l.reunioes_marcadas, 0);
  const reunioesFeitas = lanc.reduce((s, l) => s + l.reunioes_feitas, 0);
  const noShow = reunioesAgendadas - reunioesFeitas;
  const contratos = lanc.reduce((s, l) => s + l.ganhos, 0);
  const mrr = lanc.reduce((s, l) => s + Number(l.mrr_dia), 0);
  const ltvCrm = crm.reduce((s, l) => s + Number(l.valor_total_projeto || 0), 0);
  const ltv = ltvCrm > 0 ? ltvCrm : lanc.reduce((s, l) => s + Number(l.ltv || 0), 0);
  const comissao = mrr * 0.1;

  return {
    mes, label: formatMonthLabel(mes), leads, investimento,
    reunioesAgendadas, reunioesFeitas, noShow,
    percentNoShow: safe(noShow, reunioesAgendadas) * 100,
    contratos, mrr, ltv, comissao,
    custoLead: safe(investimento, leads),
    percentLeadsReuniao: safe(reunioesFeitas, leads) * 100,
    custoReuniaoFeita: safe(investimento, reunioesFeitas),
    percentLeadsContrato: safe(contratos, leads) * 100,
    cacMarketing: safe(investimento, contratos),
    cacAproximado: safe(investimento + comissao, contratos),
    ticketMedio: safe(mrr, contratos),
    roas: safe(ltv, investimento),
    resultado: mrr - (comissao + investimento),
  };
}

function MesCard({ d, meta }: { d: MesData; meta?: MetaMensal | null }) {
  const hasData = d.leads > 0 || d.contratos > 0;
  return (
    <Card className={!hasData ? "opacity-40" : ""}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm capitalize">{d.label}</h3>
          {d.resultado > 0 && (
            <span className="text-[10px] font-medium bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full">
              +{formatCurrency(d.resultado)}
            </span>
          )}
        </div>

        <SectionTitle>Topo de Funil</SectionTitle>
        <Kpi label="Leads" value={String(d.leads)} />
        <Kpi label="Investimento" value={formatCurrency(d.investimento)} accent="red" />
        <Kpi label="CPL" value={formatCurrency(d.custoLead)} />

        <SectionTitle>Reuniões</SectionTitle>
        <Kpi label="Agendadas" value={String(d.reunioesAgendadas)} />
        <Kpi label="Feitas" value={String(d.reunioesFeitas)} sub={formatPercent(d.percentLeadsReuniao)} />
        <Kpi label="No Show" value={String(d.noShow)} sub={formatPercent(d.percentNoShow)} accent="red" />
        <Kpi label="CPRF" value={formatCurrency(d.custoReuniaoFeita)} />

        <SectionTitle>Conversão</SectionTitle>
        <Kpi label="Contratos" value={String(d.contratos)} accent="green" sub={meta && meta.meta_contratos_fechados > 0 ? `meta: ${meta.meta_contratos_fechados} · ${Math.round(d.contratos / meta.meta_contratos_fechados * 100)}%` : undefined} />
        <Kpi label="% Leads → Contrato" value={formatPercent(d.percentLeadsContrato)} />
        <Kpi label="Ticket Médio" value={formatCurrency(d.ticketMedio)} />

        <SectionTitle>Financeiro</SectionTitle>
        <Kpi label="MRR" value={formatCurrency(d.mrr)} accent="green" sub={meta && Number(meta.meta_entrada_valor) > 0 ? `meta: ${formatCurrency(Number(meta.meta_entrada_valor))} · ${Math.round(d.mrr / Number(meta.meta_entrada_valor) * 100)}%` : undefined} />
        <Kpi label="LTV" value={formatCurrency(d.ltv)} accent="blue" />
        <Kpi label="ROAS" value={d.roas.toFixed(2)} accent={d.roas >= 3 ? "green" : d.roas >= 2 ? "yellow" : "red"} />

        <SectionTitle>Custos</SectionTitle>
        <Kpi label="CAC Marketing" value={formatCurrency(d.cacMarketing)} />
        <Kpi label="CAC Aproximado" value={formatCurrency(d.cacAproximado)} />
        <Kpi label="Comissão (10%)" value={formatCurrency(d.comissao)} accent="red" />

        <div className="mt-3 pt-2 border-t border-muted flex justify-between items-baseline">
          <span className="text-xs font-medium">Resultado</span>
          <span className={`text-sm font-bold font-mono ${d.resultado >= 0 ? "text-green-400" : "text-red-400"}`}>
            {formatCurrency(d.resultado)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RelatorioPage() {
  const [dados, setDados] = useState<MesData[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [closerSelecionado, setCloserSelecionado] = useState<string>("todos");
  const [closerDados, setCloserDados] = useState<MesData[]>([]);
  const [allLanc, setAllLanc] = useState<LancamentoDiario[]>([]);
  const [allConfigs, setAllConfigs] = useState<ConfigMensal[]>([]);
  const [allCrm, setAllCrm] = useState<LeadCrm[]>([]);
  const [allMetas, setAllMetas] = useState<MetaMensal[]>([]);
  const [loading, setLoading] = useState(true);

  // Meta real spend/leads por mês
  const [metaByMonth, setMetaByMonth] = useState<Record<string, { spend: number; leads: number }>>({});

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);

    const [{ data: lancamentos }, { data: configs }, { data: crmLeads }, { data: closersData }, { data: adsPerf }, { data: metasData }] =
      await Promise.all([
        supabase.from("lancamentos_diarios").select("*").in("mes_referencia", MESES),
        supabase.from("config_mensal").select("*").in("mes_referencia", MESES),
        supabase.from("leads_crm").select("etapa,valor_total_projeto,mes_referencia,closer_id").eq("etapa", "comprou"),
        supabase.from("closers").select("*").eq("ativo", true).order("nome"),
        supabase.from("ads_performance").select("spend,leads,data_ref").gte("data_ref", MESES[0] + "-01").lte("data_ref", MESES[MESES.length - 1] + "-31"),
        supabase.from("metas_mensais").select("*").in("mes_referencia", MESES),
      ]);

    const lancAll = (lancamentos || []) as LancamentoDiario[];
    const configAll = (configs || []) as ConfigMensal[];
    const crmAll = (crmLeads || []) as LeadCrm[];
    const closersList = (closersData || []) as Closer[];

    // Agregar spend/leads do Meta por mês
    const metaMonth: Record<string, { spend: number; leads: number }> = {};
    for (const row of (adsPerf || []) as { spend: number; leads: number; data_ref: string }[]) {
      const mes = row.data_ref.slice(0, 7);
      if (!metaMonth[mes]) metaMonth[mes] = { spend: 0, leads: 0 };
      metaMonth[mes].spend += Number(row.spend);
      metaMonth[mes].leads += Number(row.leads);
    }

    // Fetch Meta API real para o mês atual (100% preciso)
    const hoje = new Date().toISOString().split("T")[0];
    const mesAtual = hoje.slice(0, 7);
    try {
      const res = await fetch(`/api/meta-spend?since=${mesAtual}-01&until=${hoje}`);
      const data = await res.json();
      if (!data.error && data.spend > 0) {
        metaMonth[mesAtual] = { spend: data.spend, leads: data.leads };
      }
    } catch { }

    setMetaByMonth(metaMonth);
    setAllLanc(lancAll);
    setAllConfigs(configAll);
    setAllCrm(crmAll);
    setClosers(closersList);
    setAllMetas((metasData || []) as MetaMensal[]);

    // Dados gerais com Meta real
    const result = MESES.map((mes) => {
      const meta = metaMonth[mes];
      const config = configAll.find((c) => c.mes_referencia === mes);
      // Override config com Meta real quando disponível
      const configOverride = config ? {
        ...config,
        investimento: meta ? meta.spend : Number(config.investimento ?? 0),
        leads_totais: meta ? meta.leads : (config.leads_totais ?? 0),
      } : undefined;
      return calcMesData(
        mes,
        lancAll.filter((l) => l.mes_referencia === mes),
        configOverride as ConfigMensal | undefined,
        crmAll.filter((l) => l.mes_referencia === mes),
      );
    });

    setDados(result);
    setCloserDados(result);
    setLoading(false);
  }

  useEffect(() => {
    if (closerSelecionado === "todos") {
      setCloserDados(dados);
    } else {
      const result = MESES.map((mes) => {
        const lancFiltered = allLanc.filter((l) => l.mes_referencia === mes && l.closer_id === closerSelecionado);
        const lancAll = allLanc.filter((l) => l.mes_referencia === mes);
        const crmFiltered = allCrm.filter((l) => l.mes_referencia === mes && l.closer_id === closerSelecionado);
        const meta = metaByMonth[mes];
        const config = allConfigs.find((c) => c.mes_referencia === mes);

        const safe = (n: number, d: number) => (d > 0 ? n / d : 0);

        // Dados do closer
        const reunioesAgendadas = lancFiltered.reduce((s, l) => s + l.reunioes_marcadas, 0);
        const reunioesFeitas = lancFiltered.reduce((s, l) => s + l.reunioes_feitas, 0);
        const noShow = reunioesAgendadas - reunioesFeitas;
        const contratos = lancFiltered.reduce((s, l) => s + l.ganhos, 0);
        const mrr = lancFiltered.reduce((s, l) => s + Number(l.mrr_dia), 0);
        const ltvCrm = crmFiltered.reduce((s, l) => s + Number(l.valor_total_projeto || 0), 0);
        const ltv = ltvCrm > 0 ? ltvCrm : lancFiltered.reduce((s, l) => s + Number(l.ltv || 0), 0);
        const comissao = mrr * 0.1;

        // Investimento ATRIBUÍDO ao closer:
        // custo por reunião feita (geral) × reuniões feitas por este closer
        const investimentoTotal = meta?.spend ?? Number(config?.investimento ?? 0);
        const leadsTotal = meta?.leads ?? config?.leads_totais ?? 0;
        const reunioesTotaisGeral = lancAll.reduce((s, l) => s + l.reunioes_feitas, 0);
        const custoPorReuniaoGeral = safe(investimentoTotal, reunioesTotaisGeral);
        const investimentoCloser = custoPorReuniaoGeral * reunioesFeitas;

        return {
          mes, label: formatMonthLabel(mes),
          leads: leadsTotal,
          investimento: investimentoCloser,
          reunioesAgendadas, reunioesFeitas, noShow,
          percentNoShow: safe(noShow, reunioesAgendadas) * 100,
          contratos, mrr, ltv, comissao,
          custoLead: safe(investimentoCloser, reunioesFeitas > 0 ? reunioesFeitas : 1),
          percentLeadsReuniao: safe(reunioesFeitas, leadsTotal) * 100,
          custoReuniaoFeita: custoPorReuniaoGeral,
          percentLeadsContrato: safe(contratos, leadsTotal) * 100,
          cacMarketing: safe(investimentoCloser, contratos),
          cacAproximado: safe(investimentoCloser + comissao, contratos),
          ticketMedio: safe(mrr, contratos),
          roas: safe(ltv, investimentoCloser),
          resultado: mrr - comissao,
        } as MesData;
      });
      setCloserDados(result);
    }
  }, [closerSelecionado, dados, allLanc, allCrm, allConfigs, metaByMonth]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  // Regressão linear simples
  function trendLine(values: number[]): number[] {
    const n = values.length;
    if (n < 3) return values;
    const xs = values.map((_, i) => i);
    const sumX = xs.reduce((s, x) => s + x, 0);
    const sumY = values.reduce((s, y) => s + y, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * values[i], 0);
    const sumX2 = xs.reduce((s, x) => s + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return xs.map((x) => Math.max(0, Math.round(intercept + slope * x)));
  }

  const mrrValues = closerDados.map((d) => d.mrr);
  const contValues = closerDados.map((d) => d.contratos);
  const roasValues = closerDados.map((d) => d.roas);
  const mrrTrend = trendLine(mrrValues);
  const contTrend = trendLine(contValues);
  const roasTrend = trendLine(roasValues);

  const chartData = closerDados.map((d, i) => ({
    mes: d.label.split(" ")[0]?.slice(0, 3),
    MRR: d.mrr,
    Resultado: d.resultado,
    Contratos: d.contratos,
    ROAS: d.roas,
    mrrTrend: mrrTrend[i],
    contTrend: contTrend[i],
    roasTrend: roasTrend[i],
  }));

  // Meta do último mês disponível (para linhas de referência)
  const lastMeta = allMetas.length > 0 ? allMetas[allMetas.length - 1] : null;

  const closerNome = closerSelecionado === "todos"
    ? null
    : closers.find((c) => c.id === closerSelecionado)?.nome;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Relatório Mensal</h1>
          {closerNome && <p className="text-sm text-muted-foreground">Desempenho individual: <strong>{closerNome}</strong></p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Visualizar:</span>
          <select
            value={closerSelecionado}
            onChange={(e) => setCloserSelecionado(e.target.value)}
            className="text-sm bg-transparent border rounded-lg px-3 py-1.5"
          >
            <option value="todos">Todos os Closers</option>
            <option value="comparar">Comparar Closers</option>
            {closers.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          {closerSelecionado !== "todos" && (
            <Badge variant="outline" className="text-xs">{closerNome}</Badge>
          )}
        </div>
      </div>

      {/* Mini charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2">MRR x Resultado</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData} barGap={2}>
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="MRR" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Resultado" fill="#6366f1" radius={[3, 3, 0, 0]} />
                {chartData.length >= 3 && <Line type="monotone" dataKey="mrrTrend" stroke="#ffffff" strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.4} dot={false} />}
                {lastMeta && Number(lastMeta.meta_entrada_valor) > 0 && <ReferenceLine y={Number(lastMeta.meta_entrada_valor)} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: "Meta", fontSize: 9, fill: "#f59e0b" }} />}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2">Contratos Fechados</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData}>
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="Contratos" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                {chartData.length >= 3 && <Line type="monotone" dataKey="contTrend" stroke="#ffffff" strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.4} dot={false} />}
                {lastMeta && lastMeta.meta_contratos_fechados > 0 && <ReferenceLine y={lastMeta.meta_contratos_fechados} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: "Meta", fontSize: 9, fill: "#f59e0b" }} />}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2">ROAS</p>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={chartData}>
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, "auto"]} />
                <Tooltip formatter={(v) => Number(v).toFixed(2)} contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="ROAS" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tarefa 5 — Comparar Closers */}
      {closerSelecionado === "comparar" && (
        <Card>
          <CardContent className="pt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 px-2 text-left">Closer</th>
                  <th className="py-2 px-2 text-right">Contratos</th>
                  <th className="py-2 px-2 text-right">MRR</th>
                  <th className="py-2 px-2 text-right">Taxa Conv.</th>
                  <th className="py-2 px-2 text-right">No-Show</th>
                  <th className="py-2 px-2 text-right">Ticket Médio</th>
                </tr>
              </thead>
              <tbody>
                {closers.map((cl) => {
                  const cLanc = allLanc.filter((l) => l.closer_id === cl.id);
                  const cont = cLanc.reduce((s, l) => s + l.ganhos, 0);
                  const mrr = cLanc.reduce((s, l) => s + Number(l.mrr_dia), 0);
                  const feitas = cLanc.reduce((s, l) => s + l.reunioes_feitas, 0);
                  const marcadas = cLanc.reduce((s, l) => s + l.reunioes_marcadas, 0);
                  const taxaConv = feitas > 0 ? (cont / feitas) * 100 : 0;
                  const noShowPct = marcadas > 0 ? ((marcadas - feitas) / marcadas) * 100 : 0;
                  const ticket = cont > 0 ? mrr / cont : 0;
                  return (
                    <tr key={cl.id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">{cl.nome}</td>
                      <td className="py-2 px-2 text-right font-mono">{cont}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatCurrency(mrr)}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatPercent(taxaConv)}</td>
                      <td className={`py-2 px-2 text-right font-mono ${noShowPct > 30 ? "text-red-400" : ""}`}>{formatPercent(noShowPct)}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatCurrency(ticket)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 font-medium">
                  <td className="py-2 px-2">Total / Média</td>
                  <td className="py-2 px-2 text-right font-mono">{allLanc.reduce((s, l) => s + l.ganhos, 0)}</td>
                  <td className="py-2 px-2 text-right font-mono">{formatCurrency(allLanc.reduce((s, l) => s + Number(l.mrr_dia), 0))}</td>
                  <td className="py-2 px-2 text-right font-mono">{formatPercent(allLanc.reduce((s, l) => s + l.reunioes_feitas, 0) > 0 ? (allLanc.reduce((s, l) => s + l.ganhos, 0) / allLanc.reduce((s, l) => s + l.reunioes_feitas, 0)) * 100 : 0)}</td>
                  <td className="py-2 px-2 text-right font-mono">{formatPercent(allLanc.reduce((s, l) => s + l.reunioes_marcadas, 0) > 0 ? ((allLanc.reduce((s, l) => s + l.reunioes_marcadas, 0) - allLanc.reduce((s, l) => s + l.reunioes_feitas, 0)) / allLanc.reduce((s, l) => s + l.reunioes_marcadas, 0)) * 100 : 0)}</td>
                  <td className="py-2 px-2 text-right font-mono">{formatCurrency(allLanc.reduce((s, l) => s + l.ganhos, 0) > 0 ? allLanc.reduce((s, l) => s + Number(l.mrr_dia), 0) / allLanc.reduce((s, l) => s + l.ganhos, 0) : 0)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Month cards */}
      {closerSelecionado !== "comparar" && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {closerDados.map((d) => <MesCard key={d.mes} d={d} meta={allMetas.find((m) => m.mes_referencia === d.mes)} />)}
      </div>}
    </div>
  );
}
