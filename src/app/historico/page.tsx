"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LancamentoDiario, MetaMensal, Closer } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent, formatMonthLabel } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";

interface MesKpi {
  mes: string;
  label: string;
  mrr: number;
  ltv: number;
  contratos: number;
  reunioesFeitas: number;
  noShowPct: number;
  taxaConv: number;
  cac: number | null;
  metaMrr: number;
}

export default function HistoricoPage() {
  const [dados, setDados] = useState<MesKpi[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [closerData, setCloserData] = useState<Record<string, { mes: string; mrr: number; contratos: number; taxaConv: number }[]>>({});
  const [metricaCloser, setMetricaCloser] = useState("mrr");
  const [metaMrr, setMetaMrr] = useState(0);
  const [churnByMonth, setChurnByMonth] = useState<Record<string, number>>({});
  const [churnLoaded, setChurnLoaded] = useState(false);
  const [mrrProjetado, setMrrProjetado] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    // No limit on lancamentos_diarios, leads_crm, ads_performance: needs all records for multi-month historical aggregation
    const [{ data: lancs }, { data: configs }, { data: crmData }, { data: metas }, { data: cls }, { data: adsPerf }] = await Promise.all([
      supabase.from("lancamentos_diarios").select("*"),
      supabase.from("config_mensal").select("*"),
      supabase.from("leads_crm").select("etapa,valor_total_projeto,mes_referencia"),
      supabase.from("metas_mensais").select("*").order("mes_referencia"),
      supabase.from("closers").select("*").eq("ativo", true).order("nome"),
      supabase.from("ads_performance").select("spend,data_ref"),
    ]);

    const allLanc = (lancs || []) as LancamentoDiario[];
    const allConfigs = (configs || []) as { mes_referencia: string; investimento: number }[];
    const allCrm = (crmData || []) as { etapa: string; valor_total_projeto: number; mes_referencia: string }[];
    const allMetas = (metas || []) as MetaMensal[];

    // MRR Projetado: MRR fechado no mês atual + (leads em proposta_enviada × taxa conversão histórica)
    const mesAtualRef = new Date().toISOString().slice(0, 7);
    const totalProposta = allCrm.filter((l) => l.etapa === "proposta_enviada").length;
    const totalComprou = allCrm.filter((l) => l.etapa === "comprou").length;
    const taxaConvProposta = totalProposta + totalComprou > 0 ? totalComprou / (totalProposta + totalComprou) : 0;
    const propostaMesAtual = allCrm.filter((l) => l.etapa === "proposta_enviada" && l.mes_referencia === mesAtualRef).length;
    const mrrFechadoMesAtual = allLanc.filter((x) => x.mes_referencia === mesAtualRef).reduce((s, x) => s + Number(x.mrr_dia), 0);
    // Projection uses average MRR per contract (from lancamentos) as ticket for projected conversions
    const totalContratosHist = allLanc.reduce((s, x) => s + x.ganhos, 0);
    const mrrTotalHist = allLanc.reduce((s, x) => s + Number(x.mrr_dia), 0);
    const avgMrrPerContrato = totalContratosHist > 0 ? mrrTotalHist / totalContratosHist : 0;
    const projetadoExtra = propostaMesAtual * taxaConvProposta * avgMrrPerContrato;
    setMrrProjetado(mrrFechadoMesAtual + projetadoExtra);
    const closersList = (cls || []) as Closer[];
    setClosers(closersList);

    // Agregar spend real do Meta por mês
    const metaSpendByMonth: Record<string, number> = {};
    for (const row of (adsPerf || []) as { spend: number; data_ref: string }[]) {
      const m = row.data_ref.slice(0, 7);
      metaSpendByMonth[m] = (metaSpendByMonth[m] || 0) + Number(row.spend);
    }

    const meses = Array.from(new Set(allLanc.map((l) => l.mes_referencia))).sort();
    const safe = (n: number, d: number): number | null => (d > 0 ? n / d : null);

    const result = meses.map((mes) => {
      const l = allLanc.filter((x) => x.mes_referencia === mes);
      const crm = allCrm.filter((x) => x.mes_referencia === mes && x.etapa === "comprou");
      const cfg = allConfigs.find((x) => x.mes_referencia === mes);
      const m = allMetas.find((x) => x.mes_referencia === mes);
      const marcadas = l.reduce((s, x) => s + x.reunioes_marcadas, 0);
      const feitas = l.reduce((s, x) => s + x.reunioes_feitas, 0);
      const contratos = l.reduce((s, x) => s + x.ganhos, 0);
      const mrr = l.reduce((s, x) => s + Number(x.mrr_dia), 0);
      const ltv = crm.length > 0
        ? crm.reduce((s, x) => s + Number(x.valor_total_projeto || 0), 0)
        : l.reduce((s, x) => s + Number(x.ltv), 0);
      const inv = metaSpendByMonth[mes] ?? Number(cfg?.investimento ?? m?.valor_investido_anuncios ?? 0);
      return {
        mes, label: formatMonthLabel(mes).split(" ")[0],
        mrr, ltv, contratos, reunioesFeitas: feitas,
        noShowPct: (safe(marcadas - feitas, marcadas) ?? 0) * 100,
        taxaConv: (safe(contratos, feitas) ?? 0) * 100,
        cac: safe(inv, contratos),
        metaMrr: Number(m?.meta_faturamento_total ?? 0),
      };
    });
    setDados(result);

    // Per closer
    const cd: Record<string, { mes: string; mrr: number; contratos: number; taxaConv: number }[]> = {};
    closersList.forEach((cl) => {
      cd[cl.id] = meses.map((mes) => {
        const l = allLanc.filter((x) => x.mes_referencia === mes && x.closer_id === cl.id);
        const feitas = l.reduce((s, x) => s + x.reunioes_feitas, 0);
        const ganhos = l.reduce((s, x) => s + x.ganhos, 0);
        const mrr = l.reduce((s, x) => s + Number(x.mrr_dia), 0);
        return {
          mes: formatMonthLabel(mes).split(" ")[0],
          mrr: mrr,
          contratos: ganhos,
          taxaConv: (safe(ganhos, feitas) ?? 0) * 100,
        };
      });
    });
    setCloserData(cd);

    // Meta MRR do último mês
    const lastMeta = allMetas[allMetas.length - 1];
    if (lastMeta) setMetaMrr(Number(lastMeta.meta_entrada_valor || 0));

    // Churn — Notion + Supabase, deduplicado por nome
    if (!churnLoaded) {
      Promise.all([
        fetch("/api/notion-churn").then((r) => r.json()).catch(() => ({ churns: [] })),
        supabase.from("clientes").select("nome,data_cancelamento,mrr").eq("status", "cancelado").not("data_cancelamento", "is", null),
      ]).then(([notionData, { data: sbData }]) => {
        const seen = new Set<string>();
        const churnMap: Record<string, number> = {};
        // Notion primeiro
        for (const c of (notionData.churns || []) as { nome: string; data: string; valor: number }[]) {
          if (!c.data) continue;
          const key = c.nome?.toLowerCase();
          if (key && !seen.has(key)) { seen.add(key); const m = c.data.slice(0, 7); churnMap[m] = (churnMap[m] || 0) + c.valor; }
        }
        // Supabase (só novos)
        for (const c of (sbData || []) as { nome: string; data_cancelamento: string; mrr: number }[]) {
          const key = c.nome?.toLowerCase();
          if (key && !seen.has(key)) { seen.add(key); const m = c.data_cancelamento.slice(0, 7); churnMap[m] = (churnMap[m] || 0) + Number(c.mrr); }
        }
        setChurnByMonth(churnMap);
        setChurnLoaded(true);
      });
    }

    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  // Best records
  const bestMrr = [...dados].sort((a, b) => b.mrr - a.mrr)[0];
  const bestContratos = [...dados].sort((a, b) => b.contratos - a.contratos)[0];
  const bestCac = [...dados].filter((d) => (d.cac ?? 0) > 0).sort((a, b) => (a.cac ?? 0) - (b.cac ?? 0))[0];

  const mesAtualHist = new Date().toISOString().slice(0, 7);

  // Moving average
  const chartData = dados.map((d, i) => {
    const mm3 = i >= 2 ? (dados[i - 2].mrr + dados[i - 1].mrr + d.mrr) / 3 : null;
    const mrrLiquido = d.mrr - (churnByMonth[d.mes] || 0);
    const isParcial = d.mes === mesAtualHist;
    return { ...d, mm3, mrrLiquido, labelChart: isParcial ? `${d.label} (parcial)` : d.label };
  });

  // Closer chart data
  const closerChartData = dados.map((d, i) => {
    const row: Record<string, string | number> = { mes: d.label };
    closers.forEach((c) => {
      const val = closerData[c.id]?.[i];
      if (val) row[c.nome] = metricaCloser === "mrr" ? val.mrr : metricaCloser === "contratos" ? val.contratos : val.taxaConv;
    });
    return row;
  });

  const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6"];

  // Trend
  const lastDado = dados[dados.length - 1];
  const lastIsParcial = lastDado?.mes === mesAtualHist;
  const parcialSuffix = lastIsParcial ? " (parcial)" : "";

  const trendData = [
    { kpi: "MRR", media3m: dados.length >= 3 ? dados.slice(-3).reduce((s, d) => s + d.mrr, 0) / 3 : 0, atual: lastDado?.mrr ?? 0 },
    { kpi: "Contratos", media3m: dados.length >= 3 ? dados.slice(-3).reduce((s, d) => s + d.contratos, 0) / 3 : 0, atual: lastDado?.contratos ?? 0 },
    { kpi: "Taxa Conv", media3m: dados.length >= 3 ? dados.slice(-3).reduce((s, d) => s + d.taxaConv, 0) / 3 : 0, atual: lastDado?.taxaConv ?? 0 },
    { kpi: "No Show %", media3m: dados.length >= 3 ? dados.slice(-3).reduce((s, d) => s + d.noShowPct, 0) / 3 : 0, atual: lastDado?.noShowPct ?? 0 },
  ];

  const trendIcon = (atual: number, media: number, inverse = false) => {
    const diff = ((atual - media) / (media || 1)) * 100;
    const absDiff = Math.abs(diff);
    const sign = diff >= 0 ? "+" : "";
    const pctLabel = `${sign}${diff.toFixed(0)}%`;
    let arrow: string;
    let color: string;
    if (inverse) {
      arrow = diff < -10 ? "↑" : diff > 10 ? "↓" : "→";
      color = diff < -10 ? "text-green-500" : diff > 10 ? "text-red-500" : "text-yellow-500";
    } else {
      arrow = diff > 10 ? "↑" : diff < -10 ? "↓" : "→";
      if (diff > 0) {
        color = "text-green-500";
      } else if (absDiff > 20) {
        color = "text-red-500";
      } else if (absDiff > 5) {
        color = "text-yellow-500";
      } else {
        color = "text-yellow-500";
      }
    }
    return <span className={color}>{arrow} {pctLabel}</span>;
  };

  const mrrAcumulado = dados.reduce((s, d) => s + d.mrr, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Histórico e Tendências</h1>

      {/* MRR evolution (unified: Bruto + Líquido + Média 3M + Meta) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Evolução do MRR</CardTitle>
            <a href="/retencao" className="text-xs text-primary hover:underline">Ver Churn →</a>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="labelChart" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="mrr" stroke="#22c55e" strokeWidth={2} name="MRR Bruto" dot={{ r: 4 }} />
              <Line type="monotone" dataKey="mrrLiquido" stroke="#3b82f6" strokeWidth={2} name="MRR Liquido" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="mm3" stroke="#94a3b8" strokeDasharray="5 5" name="Media 3M" />
              {metaMrr > 0 && <ReferenceLine y={metaMrr} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: `Meta ${formatCurrency(metaMrr)}`, fontSize: 10, fill: "#f59e0b" }} />}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Best records */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {bestMrr && <Card><CardContent className="p-4 text-center"><Badge className="bg-yellow-500/20 text-yellow-500 mb-2">Maior MRR</Badge><p className="text-xl font-bold">{formatCurrency(bestMrr.mrr)}</p><p className="text-sm text-muted-foreground">{formatMonthLabel(bestMrr.mes)}</p></CardContent></Card>}
        {bestContratos && <Card><CardContent className="p-4 text-center"><Badge className="bg-green-500/20 text-green-500 mb-2">Mais Contratos</Badge><p className="text-xl font-bold">{bestContratos.contratos}</p><p className="text-sm text-muted-foreground">{formatMonthLabel(bestContratos.mes)}</p></CardContent></Card>}
        {bestCac && <Card><CardContent className="p-4 text-center"><Badge className="bg-blue-500/20 text-blue-500 mb-2">Menor CAC</Badge><p className="text-xl font-bold">{formatCurrency(bestCac.cac ?? 0)}</p><p className="text-sm text-muted-foreground">{formatMonthLabel(bestCac.mes)}</p></CardContent></Card>}
      </div>

      {/* Alerta de queda crítica de MRR */}
      {(() => {
        const mrrMedia3m = trendData[0].media3m;
        const mrrAtual = trendData[0].atual;
        const pctAbaixo = mrrMedia3m > 0 ? ((mrrMedia3m - mrrAtual) / mrrMedia3m) * 100 : 0;
        if (mrrMedia3m > 0 && mrrAtual < mrrMedia3m * 0.5) {
          return (
            <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-red-500 font-medium text-sm">
              {"⚠️"} MRR do mês atual ({formatCurrency(mrrAtual)}) está {pctAbaixo.toFixed(0)}% abaixo da média dos últimos 3 meses ({formatCurrency(mrrMedia3m)}). Verifique o funil.
            </div>
          );
        }
        return null;
      })()}

      {/* Trends */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tendência dos KPIs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>KPI</TableHead><TableHead className="text-right">Media 3m</TableHead><TableHead className="text-right">Mes Atual{parcialSuffix}</TableHead><TableHead className="text-center">Tendência</TableHead></TableRow></TableHeader>
            <TableBody>
              {trendData.map((t) => (
                <TableRow key={t.kpi}>
                  <TableCell className="font-medium">{t.kpi}</TableCell>
                  <TableCell className="text-right font-mono">{t.kpi.includes("Conv") || t.kpi.includes("Show") ? formatPercent(t.media3m) : t.kpi === "Contratos" ? t.media3m.toFixed(1) : formatCurrency(t.media3m)}</TableCell>
                  <TableCell className="text-right font-mono">{t.kpi.includes("Conv") || t.kpi.includes("Show") ? formatPercent(t.atual) : t.kpi === "Contratos" ? t.atual : formatCurrency(t.atual)}</TableCell>
                  <TableCell className="text-center text-lg">{trendIcon(t.atual, t.media3m, t.kpi.includes("Show"))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MRR Projetado */}
      {mrrProjetado !== null && mrrProjetado > 0 && (
        <Card className="border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">MRR Projetado do Mes Atual</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(mrrProjetado)} <span className="text-sm font-normal text-muted-foreground">(estimativa)</span></p>
              <p className="text-xs text-muted-foreground mt-1">
                MRR fechado ({formatCurrency(lastDado?.mes === mesAtualHist ? lastDado.mrr : 0)}) + propostas em aberto convertidas pela taxa historica
              </p>
            </div>
            {lastDado?.mes === mesAtualHist && lastDado.metaMrr > 0 && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">vs Meta</p>
                <p className={`text-lg font-bold ${mrrProjetado >= lastDado.metaMrr ? "text-green-500" : "text-yellow-500"}`}>
                  {((mrrProjetado / lastDado.metaMrr) * 100).toFixed(0)}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Per closer evolution */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Evolução por Closer</CardTitle>
          <Select value={metricaCloser} onValueChange={setMetricaCloser}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="mrr">MRR</SelectItem><SelectItem value="contratos">Contratos</SelectItem><SelectItem value="taxaConv">Taxa Conv</SelectItem></SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={closerChartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip />
              <Legend />
              {closers.map((c, i) => (
                <Line key={c.id} type="monotone" dataKey={c.nome} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Accumulated */}
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">MRR Acumulado no Ano</p>
          <p className="text-4xl font-bold text-green-500">{formatCurrency(mrrAcumulado)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
