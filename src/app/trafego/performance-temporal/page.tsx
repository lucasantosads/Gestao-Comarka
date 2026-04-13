"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const HORAS = Array.from({ length: 24 }, (_, i) => i);

interface PerfTemporal {
  dia_semana: number;
  hora: number;
  total_leads: number;
  cpl_medio: number | null;
  taxa_qualificacao: number | null;
  total_spend: number | null;
}

export default function TrafegoPerformanceTemporalPage() {
  const [data, setData] = useState<PerfTemporal[]>([]);
  const [clientes, setClientes] = useState<{ notion_id: string; cliente: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCliente, setFiltroCliente] = useState("all");
  const [filtroPeriodo, setFiltroPeriodo] = useState("1");

  useEffect(() => { loadData(); }, [filtroCliente, filtroPeriodo]);

  async function loadData() {
    setLoading(true);
    const mesesAtras = Number(filtroPeriodo);
    const desde = new Date();
    desde.setMonth(desde.getMonth() - mesesAtras);
    const desdeStr = desde.toISOString().split("T")[0].slice(0, 7) + "-01";

    let query = supabase
      .from("trafego_performance_temporal")
      .select("dia_semana, hora, total_leads, cpl_medio, taxa_qualificacao, total_spend")
      .gte("mes_referencia", desdeStr);

    if (filtroCliente !== "all") query = query.eq("cliente_id", filtroCliente);

    const [{ data: perf }, { data: cli }] = await Promise.all([
      query,
      supabase.from("clientes_notion_mirror").select("notion_id, cliente").neq("status", "Cancelado"),
    ]);

    // Agregar por dia_semana + hora
    const grid: Record<string, PerfTemporal> = {};
    for (const p of (perf || []) as PerfTemporal[]) {
      const key = `${p.dia_semana}-${p.hora}`;
      if (!grid[key]) grid[key] = { dia_semana: p.dia_semana, hora: p.hora, total_leads: 0, cpl_medio: null, taxa_qualificacao: null, total_spend: null };
      grid[key].total_leads += p.total_leads;
      if (p.cpl_medio) grid[key].cpl_medio = ((grid[key].cpl_medio || 0) + p.cpl_medio) / 2;
      if (p.taxa_qualificacao) grid[key].taxa_qualificacao = ((grid[key].taxa_qualificacao || 0) + p.taxa_qualificacao) / 2;
      if (p.total_spend) grid[key].total_spend = (grid[key].total_spend || 0) + p.total_spend;
    }

    setData(Object.values(grid));
    setClientes((cli || []) as { notion_id: string; cliente: string }[]);
    setLoading(false);
  }

  // Calcular insights
  const insights = useMemo(() => {
    if (data.length === 0) return null;
    let melhor = data[0], pior = data[0];
    let melhorQual = data[0];

    for (const d of data) {
      if (d.cpl_medio && d.total_leads >= 2) {
        if (!melhor.cpl_medio || d.cpl_medio < (melhor.cpl_medio || Infinity)) melhor = d;
        if (!pior.cpl_medio || d.cpl_medio > (pior.cpl_medio || 0)) pior = d;
      }
      if (d.taxa_qualificacao && (!melhorQual.taxa_qualificacao || d.taxa_qualificacao > (melhorQual.taxa_qualificacao || 0))) {
        melhorQual = d;
      }
    }

    return { melhor, pior, melhorQual };
  }, [data]);

  // Heatmap: CPL por dia × hora
  const cplMax = Math.max(...data.filter((d) => d.cpl_medio).map((d) => d.cpl_medio!), 1);
  const cplMin = Math.min(...data.filter((d) => d.cpl_medio).map((d) => d.cpl_medio!), 0);

  function getCplColor(cpl: number | null): string {
    if (!cpl) return "bg-muted";
    const ratio = cplMax > cplMin ? (cpl - cplMin) / (cplMax - cplMin) : 0.5;
    if (ratio < 0.33) return "bg-green-500/40";
    if (ratio < 0.66) return "bg-yellow-500/40";
    return "bg-red-500/40";
  }

  // Leads por dia da semana para bar chart
  const leadsPorDia = useMemo(() => {
    const acc: Record<number, number> = {};
    for (const d of data) {
      acc[d.dia_semana] = (acc[d.dia_semana] || 0) + d.total_leads;
    }
    return DIAS.map((nome, i) => ({ dia: nome, leads: acc[i] || 0 }));
  }, [data]);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Performance Temporal</h1>

      {/* Filtros */}
      <div className="flex gap-2">
        <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
          <option value="all">Todos clientes</option>
          {clientes.map((c) => <option key={c.notion_id} value={c.notion_id}>{c.cliente}</option>)}
        </select>
        <div className="flex bg-muted rounded-lg p-0.5">
          {[{ v: "1", l: "1M" }, { v: "3", l: "3M" }, { v: "6", l: "6M" }].map((p) => (
            <button key={p.v} onClick={() => setFiltroPeriodo(p.v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filtroPeriodo === p.v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {/* Insights */}
      {insights && insights.melhor.cpl_medio && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border-green-500/30">
            <CardContent className="p-4">
              <p className="text-[10px] text-muted-foreground">Melhor janela</p>
              <p className="text-sm font-bold text-green-400">{DIAS[insights.melhor.dia_semana]} entre {insights.melhor.hora}h e {insights.melhor.hora + 1}h</p>
              <p className="text-xs text-muted-foreground">CPL medio {formatCurrency(insights.melhor.cpl_medio!)}</p>
            </CardContent>
          </Card>
          <Card className="border-red-500/30">
            <CardContent className="p-4">
              <p className="text-[10px] text-muted-foreground">Pior janela</p>
              <p className="text-sm font-bold text-red-400">{DIAS[insights.pior.dia_semana]} entre {insights.pior.hora}h e {insights.pior.hora + 1}h</p>
              <p className="text-xs text-muted-foreground">CPL medio {formatCurrency(insights.pior.cpl_medio!)}</p>
            </CardContent>
          </Card>
          {insights.melhorQual.taxa_qualificacao && (
            <Card className="border-blue-500/30">
              <CardContent className="p-4">
                <p className="text-[10px] text-muted-foreground">Melhor qualificacao</p>
                <p className="text-sm font-bold text-blue-400">{DIAS[insights.melhorQual.dia_semana]} {insights.melhorQual.hora}h</p>
                <p className="text-xs text-muted-foreground">{insights.melhorQual.taxa_qualificacao.toFixed(0)}% taxa de qualificacao</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Heatmap CPL */}
      <Card>
        <div className="px-4 py-2 border-b text-sm font-semibold">CPL por Dia da Semana x Hora</div>
        <CardContent className="p-4 overflow-x-auto">
          {data.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum dado disponivel. Execute o job de performance temporal.</p>
          ) : (
            <div className="min-w-[800px]">
              {/* Header horas */}
              <div className="flex">
                <div className="w-12 shrink-0" />
                {HORAS.map((h) => (
                  <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">{h}h</div>
                ))}
              </div>

              {/* Rows dias */}
              {DIAS.map((dia, di) => (
                <div key={di} className="flex items-center">
                  <div className="w-12 shrink-0 text-[10px] font-medium text-muted-foreground">{dia}</div>
                  {HORAS.map((h) => {
                    const cell = data.find((d) => d.dia_semana === di && d.hora === h);
                    return (
                      <div key={h} className="flex-1 p-0.5" title={cell ? `CPL: ${cell.cpl_medio ? formatCurrency(cell.cpl_medio) : "—"}\nLeads: ${cell.total_leads}\nSpend: ${cell.total_spend ? formatCurrency(cell.total_spend) : "—"}\nQual: ${cell.taxa_qualificacao ? cell.taxa_qualificacao.toFixed(0) + "%" : "—"}` : "Sem dados"}>
                        <div className={`h-7 rounded-sm ${getCplColor(cell?.cpl_medio || null)} flex items-center justify-center`}>
                          {cell && cell.total_leads > 0 && <span className="text-[8px] font-bold">{cell.total_leads}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Legenda */}
              <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
                <span>Legenda:</span>
                <div className="flex items-center gap-1"><div className="w-4 h-3 rounded bg-green-500/40" /><span>CPL baixo</span></div>
                <div className="flex items-center gap-1"><div className="w-4 h-3 rounded bg-yellow-500/40" /><span>CPL medio</span></div>
                <div className="flex items-center gap-1"><div className="w-4 h-3 rounded bg-red-500/40" /><span>CPL alto</span></div>
                <div className="flex items-center gap-1"><div className="w-4 h-3 rounded bg-muted" /><span>Sem dados</span></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bar chart: leads por dia */}
      {data.length > 0 && (
        <Card>
          <div className="px-4 py-2 border-b text-sm font-semibold">Leads por Dia da Semana</div>
          <CardContent className="p-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadsPorDia}>
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip labelStyle={{ fontSize: 11 }} />
                  <Bar dataKey="leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
