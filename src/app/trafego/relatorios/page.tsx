"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AdsPerformance, LeadAdsAttribution } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { TrafegoFilters, useTrafegoFilters } from "@/components/trafego-filters";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";

export default function TrafegoRelatoriosPage() {
  const filters = useTrafegoFilters();
  const [performance, setPerformance] = useState<AdsPerformance[]>([]);
  const [leads, setLeads] = useState<LeadAdsAttribution[]>([]);
  const [prevPerformance, setPrevPerformance] = useState<AdsPerformance[]>([]);
  const [prevLeads, setPrevLeads] = useState<LeadAdsAttribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [filters.dataInicio, filters.dataFim]);

  async function loadData() {
    setLoading(true);
    // Calcular período anterior com mesma duração
    const inicio = new Date(filters.dataInicio + "T00:00:00");
    const fim = new Date(filters.dataFim + "T23:59:59");
    const dias = Math.ceil((fim.getTime() - inicio.getTime()) / 86400000);
    const prevFim = new Date(inicio); prevFim.setDate(prevFim.getDate() - 1);
    const prevInicio = new Date(prevFim); prevInicio.setDate(prevInicio.getDate() - dias);
    const prevInicioStr = prevInicio.toISOString().split("T")[0];
    const prevFimStr = prevFim.toISOString().split("T")[0];

    const [{ data: p }, { data: l }, { data: pp }, { data: pl }] = await Promise.all([
      supabase.from("ads_performance").select("*").gte("data_ref", filters.dataInicio).lte("data_ref", filters.dataFim),
      supabase.from("leads_ads_attribution").select("*").gte("created_at", filters.dataInicio + "T00:00:00").lte("created_at", filters.dataFim + "T23:59:59"),
      supabase.from("ads_performance").select("*").gte("data_ref", prevInicioStr).lte("data_ref", prevFimStr),
      supabase.from("leads_ads_attribution").select("*").gte("created_at", prevInicioStr + "T00:00:00").lte("created_at", prevFimStr + "T23:59:59"),
    ]);

    setPerformance((p || []) as AdsPerformance[]);
    setLeads((l || []) as LeadAdsAttribution[]);
    setPrevPerformance((pp || []) as AdsPerformance[]);
    setPrevLeads((pl || []) as LeadAdsAttribution[]);
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  function calc(perfs: AdsPerformance[], lds: LeadAdsAttribution[]) {
    const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
    const leadsCount = lds.length;
    const fechados = lds.filter((l) => l.estagio_crm === "fechado" || l.estagio_crm === "comprou").length;
    const receita = lds.reduce((s, l) => s + Number(l.receita_gerada), 0);
    const cpl = leadsCount > 0 ? spend / leadsCount : 0;
    const cac = fechados > 0 ? spend / fechados : 0;
    const roas = spend > 0 ? receita / spend : 0;
    const impressoes = perfs.reduce((s, p) => s + p.impressoes, 0);
    const cliques = perfs.reduce((s, p) => s + p.cliques, 0);
    const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;
    return { spend, leadsCount, fechados, receita, cpl, cac, roas, ctr };
  }

  const atual = calc(performance, leads);
  const anterior = calc(prevPerformance, prevLeads);

  const delta = (cur: number, prev: number, inv = false) => {
    if (prev === 0) return null;
    const pct = ((cur - prev) / prev) * 100;
    return { pct, positivo: inv ? pct < 0 : pct > 0 };
  };

  const metricas = [
    { label: "Investido", atual: formatCurrency(atual.spend), anterior: formatCurrency(anterior.spend), d: delta(atual.spend, anterior.spend, true) },
    { label: "Leads", atual: String(atual.leadsCount), anterior: String(anterior.leadsCount), d: delta(atual.leadsCount, anterior.leadsCount) },
    { label: "CPL", atual: atual.leadsCount > 0 ? formatCurrency(atual.cpl) : "—", anterior: anterior.leadsCount > 0 ? formatCurrency(anterior.cpl) : "—", d: delta(atual.cpl, anterior.cpl, true) },
    { label: "CTR", atual: atual.ctr.toFixed(2) + "%", anterior: anterior.ctr.toFixed(2) + "%", d: delta(atual.ctr, anterior.ctr) },
    { label: "Fechados", atual: String(atual.fechados), anterior: String(anterior.fechados), d: delta(atual.fechados, anterior.fechados) },
    { label: "CAC", atual: atual.fechados > 0 ? formatCurrency(atual.cac) : "—", anterior: anterior.fechados > 0 ? formatCurrency(anterior.cac) : "—", d: delta(atual.cac, anterior.cac, true) },
    { label: "ROAS", atual: atual.fechados > 0 ? atual.roas.toFixed(2) + "x" : "—", anterior: anterior.fechados > 0 ? anterior.roas.toFixed(2) + "x" : "—", d: delta(atual.roas, anterior.roas) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Relatórios de Tráfego</h1>
        <TrafegoFilters periodo={filters.periodo} onPeriodoChange={filters.setPeriodo} dataInicio={filters.dataInicio} dataFim={filters.dataFim} onDataInicioChange={filters.setDataInicio} onDataFimChange={filters.setDataFim} statusFiltro={filters.statusFiltro} onStatusChange={filters.setStatusFiltro} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Período Atual vs Período Anterior</CardTitle></CardHeader>
        <CardContent><div className="overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Métrica</th>
              <th className="px-4 py-2 text-right font-medium">Atual</th>
              <th className="px-4 py-2 text-right font-medium">Anterior</th>
              <th className="px-4 py-2 text-right font-medium">Variação</th>
            </tr></thead>
            <tbody>
              {metricas.map((m) => (
                <tr key={m.label} className="border-b">
                  <td className="px-4 py-3 font-medium">{m.label}</td>
                  <td className="px-4 py-3 text-right font-bold">{m.atual}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{m.anterior}</td>
                  <td className="px-4 py-3 text-right">{m.d ? (<span className={`font-medium ${m.d.positivo ? "text-green-400" : "text-red-400"}`}>{m.d.positivo ? "↑" : "↓"} {Math.abs(m.d.pct).toFixed(0)}%</span>) : <span className="text-muted-foreground">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></CardContent>
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
                  <ResponsiveContainer width="100%" height={200}>
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
                  <ResponsiveContainer width="100%" height={150}>
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
