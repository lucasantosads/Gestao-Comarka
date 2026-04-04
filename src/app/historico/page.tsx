"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LancamentoDiario, MetaMensal, Closer } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent, formatMonthLabel } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface MesKpi {
  mes: string;
  label: string;
  mrr: number;
  ltv: number;
  contratos: number;
  reunioesFeitas: number;
  noShowPct: number;
  taxaConv: number;
  cac: number;
  metaMrr: number;
}

export default function HistoricoPage() {
  const [dados, setDados] = useState<MesKpi[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [closerData, setCloserData] = useState<Record<string, { mes: string; mrr: number; contratos: number; taxaConv: number }[]>>({});
  const [metricaCloser, setMetricaCloser] = useState("mrr");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [{ data: lancs }, { data: configs }, { data: crmData }, { data: metas }, { data: cls }] = await Promise.all([
      supabase.from("lancamentos_diarios").select("*"),
      supabase.from("config_mensal").select("*"),
      supabase.from("leads_crm").select("etapa,valor_total_projeto,mes_referencia").eq("etapa", "comprou"),
      supabase.from("metas_mensais").select("*").order("mes_referencia"),
      supabase.from("closers").select("*").eq("ativo", true).order("nome"),
    ]);

    const allLanc = (lancs || []) as LancamentoDiario[];
    const allConfigs = (configs || []) as { mes_referencia: string; investimento: number }[];
    const allCrm = (crmData || []) as { etapa: string; valor_total_projeto: number; mes_referencia: string }[];
    const allMetas = (metas || []) as MetaMensal[];
    const closersList = (cls || []) as Closer[];
    setClosers(closersList);

    const meses = Array.from(new Set(allLanc.map((l) => l.mes_referencia))).sort();
    const safe = (n: number, d: number) => (d > 0 ? n / d : 0);

    const result = meses.map((mes) => {
      const l = allLanc.filter((x) => x.mes_referencia === mes);
      const crm = allCrm.filter((x) => x.mes_referencia === mes);
      const cfg = allConfigs.find((x) => x.mes_referencia === mes);
      const m = allMetas.find((x) => x.mes_referencia === mes);
      const marcadas = l.reduce((s, x) => s + x.reunioes_marcadas, 0);
      const feitas = l.reduce((s, x) => s + x.reunioes_feitas, 0);
      const contratos = l.reduce((s, x) => s + x.ganhos, 0);
      const mrr = l.reduce((s, x) => s + Number(x.mrr_dia), 0);
      const ltv = crm.length > 0
        ? crm.reduce((s, x) => s + Number(x.valor_total_projeto || 0), 0)
        : l.reduce((s, x) => s + Number(x.ltv), 0);
      const inv = Number(cfg?.investimento ?? m?.valor_investido_anuncios ?? 0);
      return {
        mes, label: formatMonthLabel(mes).split(" ")[0],
        mrr, ltv, contratos, reunioesFeitas: feitas,
        noShowPct: safe(marcadas - feitas, marcadas) * 100,
        taxaConv: safe(contratos, feitas) * 100,
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
          taxaConv: safe(ganhos, feitas) * 100,
        };
      });
    });
    setCloserData(cd);
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  // Best records
  const bestMrr = [...dados].sort((a, b) => b.mrr - a.mrr)[0];
  const bestContratos = [...dados].sort((a, b) => b.contratos - a.contratos)[0];
  const bestCac = [...dados].filter((d) => d.cac > 0).sort((a, b) => a.cac - b.cac)[0];

  // Moving average
  const chartData = dados.map((d, i) => {
    const mm3 = i >= 2 ? (dados[i - 2].mrr + dados[i - 1].mrr + d.mrr) / 3 : null;
    return { ...d, mm3 };
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
  const trendData = [
    { kpi: "MRR", media3m: dados.length >= 3 ? dados.slice(-3).reduce((s, d) => s + d.mrr, 0) / 3 : 0, atual: dados[dados.length - 1]?.mrr ?? 0 },
    { kpi: "Contratos", media3m: dados.length >= 3 ? dados.slice(-3).reduce((s, d) => s + d.contratos, 0) / 3 : 0, atual: dados[dados.length - 1]?.contratos ?? 0 },
    { kpi: "Taxa Conv", media3m: dados.length >= 3 ? dados.slice(-3).reduce((s, d) => s + d.taxaConv, 0) / 3 : 0, atual: dados[dados.length - 1]?.taxaConv ?? 0 },
    { kpi: "No Show %", media3m: dados.length >= 3 ? dados.slice(-3).reduce((s, d) => s + d.noShowPct, 0) / 3 : 0, atual: dados[dados.length - 1]?.noShowPct ?? 0 },
  ];

  const trendIcon = (atual: number, media: number, inverse = false) => {
    const diff = ((atual - media) / (media || 1)) * 100;
    if (inverse) return diff < -10 ? "↑" : diff > 10 ? "↓" : "→";
    return diff > 10 ? "↑" : diff < -10 ? "↓" : "→";
  };

  const mrrAcumulado = dados.reduce((s, d) => s + d.mrr, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Histórico e Tendências</h1>

      {/* MRR evolution */}
      <Card>
        <CardHeader><CardTitle className="text-base">Evolucao do MRR</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="mrr" stroke="#22c55e" strokeWidth={2} name="MRR" dot={{ r: 4 }} />
              <Line type="monotone" dataKey="mm3" stroke="#94a3b8" strokeDasharray="5 5" name="Media 3m" />
              <Line type="monotone" dataKey="metaMrr" stroke="#6366f1" strokeDasharray="3 3" name="Meta" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Best records */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {bestMrr && <Card><CardContent className="p-4 text-center"><Badge className="bg-yellow-500/20 text-yellow-500 mb-2">Maior MRR</Badge><p className="text-xl font-bold">{formatCurrency(bestMrr.mrr)}</p><p className="text-sm text-muted-foreground">{formatMonthLabel(bestMrr.mes)}</p></CardContent></Card>}
        {bestContratos && <Card><CardContent className="p-4 text-center"><Badge className="bg-green-500/20 text-green-500 mb-2">Mais Contratos</Badge><p className="text-xl font-bold">{bestContratos.contratos}</p><p className="text-sm text-muted-foreground">{formatMonthLabel(bestContratos.mes)}</p></CardContent></Card>}
        {bestCac && <Card><CardContent className="p-4 text-center"><Badge className="bg-blue-500/20 text-blue-500 mb-2">Menor CAC</Badge><p className="text-xl font-bold">{formatCurrency(bestCac.cac)}</p><p className="text-sm text-muted-foreground">{formatMonthLabel(bestCac.mes)}</p></CardContent></Card>}
      </div>

      {/* Trends */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tendencia dos KPIs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>KPI</TableHead><TableHead className="text-right">Media 3m</TableHead><TableHead className="text-right">Mes Atual</TableHead><TableHead className="text-center">Tendencia</TableHead></TableRow></TableHeader>
            <TableBody>
              {trendData.map((t) => (
                <TableRow key={t.kpi}>
                  <TableCell className="font-medium">{t.kpi}</TableCell>
                  <TableCell className="text-right font-mono">{t.kpi.includes("Conv") || t.kpi.includes("Show") ? formatPercent(t.media3m) : formatCurrency(t.media3m)}</TableCell>
                  <TableCell className="text-right font-mono">{t.kpi.includes("Conv") || t.kpi.includes("Show") ? formatPercent(t.atual) : t.kpi === "Contratos" ? t.atual : formatCurrency(t.atual)}</TableCell>
                  <TableCell className="text-center text-lg">{trendIcon(t.atual, t.media3m, t.kpi.includes("Show"))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Per closer evolution */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Evolucao por Closer</CardTitle>
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
