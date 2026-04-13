"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { TrafegoFilters, useTrafegoFilters } from "@/components/trafego-filters";
import { useTrafegoData } from "@/hooks/use-trafego-data";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";

export default function TrafegoRelatoriosPage() {
  const filters = useTrafegoFilters();
  const { data: tData, isLoading: loading } = useTrafegoData(filters.dataInicio, filters.dataFim, filters.statusFiltro);

  const performance = tData?.performance || [];
  const leads = tData?.leads || [];
  const prevPerformance = tData?.prevPerformance || [];
  const prevLeads = tData?.prevLeads || [];

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  function calc(perfs: AdsPerformance[], lds: LeadAdsAttribution[]) {
    const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
    const metaLeads = perfs.reduce((s, p) => s + p.leads, 0); // Meta leads from ads_performance
    const leadsCount = lds.length; // CRM leads (kept for fechados/receita)
    const fechados = lds.filter((l) => l.estagio_crm === "fechado" || l.estagio_crm === "comprou").length;
    const receita = lds.reduce((s, l) => s + Number(l.receita_gerada), 0);
    const cpl = metaLeads > 0 ? spend / metaLeads : 0; // CPL uses Meta leads, not CRM leads
    const cac = fechados > 0 ? spend / fechados : 0;
    const roas = spend > 0 ? receita / spend : 0;
    const impressoes = perfs.reduce((s, p) => s + p.impressoes, 0);
    const cliques = perfs.reduce((s, p) => s + p.cliques, 0);
    const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;
    return { spend, leadsCount, metaLeads, fechados, receita, cpl, cac, roas, ctr };
  }

  const atual = calc(performance, leads);
  const anterior = calc(prevPerformance, prevLeads);

  // Variação: cada métrica tem semântica própria ("higher is better", "lower is better" ou neutra).
  type Sem = "higher" | "lower" | "neutral";
  const delta = (cur: number, prev: number, sem: Sem) => {
    if (prev === 0) return null;
    const pct = ((cur - prev) / prev) * 100;
    let color: "green" | "red" | "neutral";
    if (sem === "neutral") color = "neutral";
    else if (sem === "higher") color = pct >= 0 ? "green" : "red";
    else color = pct <= 0 ? "green" : "red";
    return { pct, color };
  };

  const metricas = [
    { label: "Investido", atual: formatCurrency(atual.spend), anterior: formatCurrency(anterior.spend), d: delta(atual.spend, anterior.spend, "neutral") },
    { label: "Leads", atual: String(atual.leadsCount), anterior: String(anterior.leadsCount), d: delta(atual.leadsCount, anterior.leadsCount, "higher") },
    { label: "CPL", atual: atual.metaLeads > 0 ? formatCurrency(atual.cpl) : "—", anterior: anterior.metaLeads > 0 ? formatCurrency(anterior.cpl) : "—", d: delta(atual.cpl, anterior.cpl, "lower") },
    { label: "CTR", atual: atual.ctr.toFixed(2) + "%", anterior: anterior.ctr.toFixed(2) + "%", d: delta(atual.ctr, anterior.ctr, "higher") },
    { label: "Fechados", atual: String(atual.fechados), anterior: String(anterior.fechados), d: delta(atual.fechados, anterior.fechados, "higher") },
    { label: "CAC", atual: atual.fechados > 0 ? formatCurrency(atual.cac) : "—", anterior: anterior.fechados > 0 ? formatCurrency(anterior.cac) : "—", d: delta(atual.cac, anterior.cac, "lower") },
    { label: "ROAS", atual: atual.fechados > 0 ? atual.roas.toFixed(2) + "x" : "—", anterior: anterior.fechados > 0 ? anterior.roas.toFixed(2) + "x" : "—", d: delta(atual.roas, anterior.roas, "higher") },
  ];

  // Se TODAS as métricas do período anterior estão zeradas/nulas → estado vazio
  const anteriorVazio = anterior.spend === 0 && anterior.leadsCount === 0 && anterior.metaLeads === 0 && anterior.fechados === 0 && anterior.ctr === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Relatórios de Tráfego</h1>
        <TrafegoFilters periodo={filters.periodo} onPeriodoChange={filters.setPeriodo} dataInicio={filters.dataInicio} dataFim={filters.dataFim} onDataInicioChange={filters.setDataInicio} onDataFimChange={filters.setDataFim} statusFiltro={filters.statusFiltro} onStatusChange={filters.setStatusFiltro} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Período Atual vs Período Anterior</CardTitle></CardHeader>
        <CardContent>
          {anteriorVazio && (
            <p className="text-xs text-muted-foreground mb-3 italic">Sem dados para comparação no período anterior</p>
          )}
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Métrica</th>
                <th className="px-4 py-2 text-right font-medium">Atual</th>
                {!anteriorVazio && <th className="px-4 py-2 text-right font-medium">Anterior</th>}
                {!anteriorVazio && <th className="px-4 py-2 text-right font-medium">Variação</th>}
              </tr></thead>
              <tbody>
                {metricas.map((m) => {
                  const colorCls = m.d?.color === "green" ? "text-green-400" : m.d?.color === "red" ? "text-red-400" : "text-muted-foreground";
                  const arrow = m.d ? (m.d.pct >= 0 ? "↑" : "↓") : "";
                  return (
                    <tr key={m.label} className="border-b">
                      <td className="px-4 py-3 font-medium">{m.label}</td>
                      <td className="px-4 py-3 text-right font-bold">{m.atual}</td>
                      {!anteriorVazio && <td className="px-4 py-3 text-right text-muted-foreground">{m.anterior}</td>}
                      {!anteriorVazio && (
                        <td className="px-4 py-3 text-right">
                          {m.d
                            ? <span className={`font-medium ${colorCls}`}>{arrow} {Math.abs(m.d.pct).toFixed(0)}%</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de tendência diária */}
      {performance.length > 0 && (() => {
        const byDay = new Map<string, { dia: string; spend: number; leads: number; cpl: number; ctr: number }>();
        performance.forEach((p) => {
          const d = p.data_ref.slice(5);
          const existing = byDay.get(d) || { dia: d, spend: 0, leads: 0, cpl: 0, ctr: 0 };
          existing.spend += Number(p.spend);
          existing.leads += p.leads;
          byDay.set(d, existing);
        });
        const chartData = Array.from(byDay.values()).map((d) => ({
          ...d,
          cpl: d.leads > 0 ? Math.round(d.spend / d.leads * 100) / 100 : 0,
        }));
        return (
          <Card>
            <CardHeader><CardTitle className="text-base">Tendência Diária</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Investimento e CPL por dia</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="dia" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v, n) => [n === "CPL" ? formatCurrency(Number(v)) : formatCurrency(Number(v)), n]} contentStyle={{ fontSize: 12 }} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="spend" name="Investido" stroke="#6366f1" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="cpl" name="CPL" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Leads por dia</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="dia" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="leads" name="Leads" stroke="#22c55e" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
