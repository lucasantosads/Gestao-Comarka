"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LancamentoDiario, Closer } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPercent, formatCurrency } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const DIAS = ["", "Seg", "Ter", "Qua", "Qui", "Sex"];

export default function AnaliseDiasPage() {
  const [lancamentos, setLancamentos] = useState<(LancamentoDiario & { dia_semana: number })[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [filtroCloser, setFiltroCloser] = useState("all");
  const [filtroPeriodo, setFiltroPeriodo] = useState<"mes" | "3m" | "6m">("6m");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // No limit on lancamentos_diarios: needs all records for day-of-week analysis across all months
    Promise.all([
      supabase.from("lancamentos_diarios").select("*").order("data"),
      supabase.from("closers").select("*").eq("ativo", true).order("nome"),
    ]).then(([{ data: lancs }, { data: cls }]) => {
      const enriched = (lancs || []).map((l: LancamentoDiario) => ({
        ...l,
        dia_semana: new Date(l.data + "T12:00:00").getDay(),
      }));
      setLancamentos(enriched);
      setClosers((cls || []) as Closer[]);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  const safe = (n: number, d: number) => (d > 0 ? n / d : 0);

  // Period filter: compute cutoff date
  const periodCutoff = (() => {
    const now = new Date();
    if (filtroPeriodo === "mes") {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filtroPeriodo === "3m") {
      return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    } else {
      return new Date(now.getFullYear(), now.getMonth() - 5, 1);
    }
  })();
  const periodCutoffStr = periodCutoff.toISOString().slice(0, 10);

  const lancsByPeriod = lancamentos.filter((l) => l.data >= periodCutoffStr);
  const lancsFiltered = (filtroCloser === "all" ? lancsByPeriod : lancsByPeriod.filter((l) => l.closer_id === filtroCloser));

  // By day of week
  const porDia = [1, 2, 3, 4, 5].map((dia) => {
    const regs = lancsFiltered.filter((l) => l.dia_semana === dia && l.reunioes_marcadas > 0);
    const marcadas = regs.reduce((s, l) => s + l.reunioes_marcadas, 0);
    const feitas = regs.reduce((s, l) => s + l.reunioes_feitas, 0);
    const contratos = regs.reduce((s, l) => s + l.ganhos, 0);
    const mrr = regs.reduce((s, l) => s + Number(l.mrr_dia), 0);
    return {
      dia: DIAS[dia],
      marcadas, feitas, contratos, mrr,
      taxaConv: safe(contratos, feitas) * 100,
      taxaNoShow: safe(marcadas - feitas, marcadas) * 100,
      mrrMedio: regs.length > 0 ? mrr / regs.length : 0,
    };
  });

  // By week of month (current month only for week cards)
  const now = new Date();
  const mesAtualStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mesAntStr = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, "0")}`;

  const lancsCloser = filtroCloser === "all" ? lancamentos : lancamentos.filter((l) => l.closer_id === filtroCloser);
  const lancsMesAtual = lancsCloser.filter((l) => l.data.startsWith(mesAtualStr));
  const lancsMesAnt = lancsCloser.filter((l) => l.data.startsWith(mesAntStr));

  const porSemana = [1, 2, 3, 4].map((sem) => {
    const regs = lancsMesAtual.filter((l) => Math.ceil(new Date(l.data + "T12:00:00").getDate() / 7) === sem);
    const contratos = regs.reduce((s, l) => s + l.ganhos, 0);
    const mrr = regs.reduce((s, l) => s + Number(l.mrr_dia), 0);
    const feitas = regs.reduce((s, l) => s + l.reunioes_feitas, 0);
    const marcadas = regs.reduce((s, l) => s + l.reunioes_marcadas, 0);
    const noShow = marcadas - feitas;

    // Previous month same week
    const prevRegs = lancsMesAnt.filter((l) => Math.ceil(new Date(l.data + "T12:00:00").getDate() / 7) === sem);
    const prevContratos = prevRegs.reduce((s, l) => s + l.ganhos, 0);
    const diff = prevRegs.length > 0 ? contratos - prevContratos : null;

    return { semana: `${sem}a semana`, contratos, mrr, feitas, noShow, taxaConv: safe(contratos, feitas) * 100, diff };
  });

  // Per closer x day
  const porCloserDia = closers.map((c) => {
    const dias = [1, 2, 3, 4, 5].map((dia) => {
      const regs = lancsByPeriod.filter((l) => l.closer_id === c.id && l.dia_semana === dia);
      const feitas = regs.reduce((s, l) => s + l.reunioes_feitas, 0);
      const contratos = regs.reduce((s, l) => s + l.ganhos, 0);
      return { dia: DIAS[dia], taxaConv: safe(contratos, feitas) * 100 };
    });
    return { nome: c.nome, dias };
  });

  // Insights
  const melhorDia = [...porDia].sort((a, b) => b.taxaConv - a.taxaConv)[0];
  const piorDia = [...porDia].sort((a, b) => a.taxaConv - b.taxaConv)[0];
  const maiorNoShow = [...porDia].sort((a, b) => b.taxaNoShow - a.taxaNoShow)[0];
  const melhorSemana = [...porSemana].sort((a, b) => b.mrr - a.mrr)[0];

  const insights = [
    { icon: "✅", text: `Concentre reuniões de fechamento às ${melhorDia.dia.toLowerCase()}s (conv. ${melhorDia.taxaConv.toFixed(0)}%). Evite agendar fechamentos na ${piorDia.dia.toLowerCase()} (conv. ${piorDia.taxaConv.toFixed(0)}%).` },
    { icon: "📞", text: `Reforce confirmação de reunião às ${maiorNoShow.dia.toLowerCase()}s — no-show de ${maiorNoShow.taxaNoShow.toFixed(0)}% nesse dia.` },
    { icon: "📊", text: `${melhorSemana.semana} é a mais rentável: ${melhorSemana.contratos} contratos, ${formatCurrency(melhorSemana.mrr)} MRR.` },
  ];

  const heatColor = (v: number) => {
    if (v >= 30) return "bg-green-600 text-white";
    if (v >= 20) return "bg-green-500/60";
    if (v >= 10) return "bg-yellow-500/40";
    return "bg-red-500/20";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Análise por Dia da Semana</h1>
        <div className="flex gap-2">
          <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value as "mes" | "3m" | "6m")} className="text-sm bg-transparent border rounded-lg px-3 py-1.5">
            <option value="mes">Este mes</option>
            <option value="3m">3M</option>
            <option value="6m">6M</option>
          </select>
          <select value={filtroCloser} onChange={(e) => setFiltroCloser(e.target.value)} className="text-sm bg-transparent border rounded-lg px-3 py-1.5">
            <option value="all">Todos os Closers</option>
            {closers.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>

      {/* Insights acionáveis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {insights.map((t, i) => (
          <Card key={i}><CardContent className="p-4 text-sm"><span className="mr-1">{t.icon}</span>{t.text}</CardContent></Card>
        ))}
      </div>

      {/* Heatmap closer x day */}
      <Card>
        <CardHeader><CardTitle className="text-base">Conversão por Closer x Dia</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Closer</TableHead>
                {[1, 2, 3, 4, 5].map((d) => (<TableHead key={d} className="text-center">{DIAS[d]}</TableHead>))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {porCloserDia.map((c) => (
                <TableRow key={c.nome}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  {c.dias.map((d) => (
                    <TableCell key={d.dia} className="text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-mono ${heatColor(d.taxaConv)}`}>
                        {d.taxaConv.toFixed(0)}%
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bar chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Performance por Dia</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={porDia}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="dia" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="marcadas" fill="#6366f1" name="Marcadas" />
              <Bar dataKey="feitas" fill="#22c55e" name="Feitas" />
              <Bar dataKey="contratos" fill="#f59e0b" name="Contratos" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Week cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {porSemana.map((s) => (
          <Card key={s.semana}>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">{s.semana}</p>
              <p className="text-xl font-bold">{s.contratos} contratos</p>
              <p className="text-sm text-green-500">{formatCurrency(s.mrr)}</p>
              <div className="flex justify-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{s.feitas} feitas</span>
                <span className={s.noShow > 0 ? "text-red-400" : ""}>{s.noShow} no-show</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{formatPercent(s.taxaConv)} conv</p>
              {s.diff !== null && (
                <p className={`text-[10px] mt-1 ${s.diff > 0 ? "text-green-400" : s.diff < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                  {s.diff > 0 ? `↑${s.diff}` : s.diff < 0 ? `↓${Math.abs(s.diff)}` : "=0"} vs mes ant.
                </p>
              )}
              {s === melhorSemana && <Badge className="mt-1 bg-yellow-500/20 text-yellow-500">Mais rentavel</Badge>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Closer Efficiency Ranking */}
      <Card>
        <CardHeader><CardTitle className="text-base">Ranking de Eficiencia dos Closers</CardTitle></CardHeader>
        <CardContent>
          {(() => {
            const ranking = closers.map((c) => {
              const myLancs = lancsByPeriod.filter((l) => l.closer_id === c.id);
              const feitas = myLancs.reduce((s, l) => s + l.reunioes_feitas, 0);
              const ganhos = myLancs.reduce((s, l) => s + l.ganhos, 0);
              const mrr = myLancs.reduce((s, l) => s + Number(l.mrr_dia), 0);
              const convRate = safe(ganhos, feitas);
              const avgTicket = ganhos > 0 ? mrr / ganhos : 0;
              const efficiencyScore = convRate * avgTicket;
              return { nome: c.nome, convRate, avgTicket, efficiencyScore };
            }).sort((a, b) => b.efficiencyScore - a.efficiencyScore);

            return (
              <div className="space-y-2">
                {ranking.map((r, i) => (
                  <div key={r.nome} className={`flex items-center justify-between py-2 px-3 rounded-lg ${i === 0 ? "bg-yellow-500/10 border border-yellow-500/30" : i === 1 ? "bg-slate-500/5 border border-slate-500/20" : i === 2 ? "bg-orange-500/5 border border-orange-500/20" : "border border-border/30"}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-6">{i + 1}.</span>
                      <span className="font-medium">{r.nome}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-mono">
                      <span className="text-muted-foreground">conv. {formatPercent(r.convRate * 100)}</span>
                      <span className="text-muted-foreground">x</span>
                      <span className="text-muted-foreground">ticket {formatCurrency(r.avgTicket)}</span>
                      <span className="text-muted-foreground">=</span>
                      <Badge variant="outline" className={`font-bold ${i === 0 ? "border-yellow-500 text-yellow-500" : ""}`}>
                        score {r.efficiencyScore.toFixed(0)}
                      </Badge>
                    </div>
                  </div>
                ))}
                {ranking.length === 0 && <p className="text-sm text-muted-foreground">Sem dados de closers no periodo.</p>}
              </div>
            );
          })()}
        </CardContent>
      </Card>

    </div>
  );
}
