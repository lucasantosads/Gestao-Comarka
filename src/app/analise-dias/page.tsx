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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  // By day of week
  const porDia = [1, 2, 3, 4, 5].map((dia) => {
    const regs = lancamentos.filter((l) => l.dia_semana === dia && l.reunioes_marcadas > 0);
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

  // By week of month
  const porSemana = [1, 2, 3, 4].map((sem) => {
    const regs = lancamentos.filter((l) => Math.ceil(new Date(l.data + "T12:00:00").getDate() / 7) === sem);
    const contratos = regs.reduce((s, l) => s + l.ganhos, 0);
    const mrr = regs.reduce((s, l) => s + Number(l.mrr_dia), 0);
    const feitas = regs.reduce((s, l) => s + l.reunioes_feitas, 0);
    return { semana: `${sem}a semana`, contratos, mrr, taxaConv: safe(contratos, feitas) * 100 };
  });

  // Per closer x day
  const porCloserDia = closers.map((c) => {
    const dias = [1, 2, 3, 4, 5].map((dia) => {
      const regs = lancamentos.filter((l) => l.closer_id === c.id && l.dia_semana === dia);
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
    `${melhorDia.dia} é o melhor dia para fechar — taxa de conversão de ${melhorDia.taxaConv.toFixed(0)}%`,
    `${maiorNoShow.dia} tem o maior no show (${maiorNoShow.taxaNoShow.toFixed(0)}%) — reforçar confirmação nesse dia`,
    `${piorDia.dia} tem a menor conversão (${piorDia.taxaConv.toFixed(0)}%)`,
  ];

  const heatColor = (v: number) => {
    if (v >= 30) return "bg-green-600 text-white";
    if (v >= 20) return "bg-green-500/60";
    if (v >= 10) return "bg-yellow-500/40";
    return "bg-red-500/20";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analise por Dia da Semana</h1>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {insights.map((t, i) => (
          <Card key={i}><CardContent className="p-4 text-sm">{t}</CardContent></Card>
        ))}
      </div>

      {/* Bar chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Performance por Dia</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
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
              <p className="text-xs text-muted-foreground">{formatPercent(s.taxaConv)} conv</p>
              {s === melhorSemana && <Badge className="mt-1 bg-yellow-500/20 text-yellow-500">Mais rentavel</Badge>}
            </CardContent>
          </Card>
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
    </div>
  );
}
