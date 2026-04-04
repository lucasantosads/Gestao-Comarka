"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Contrato, Closer } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent, formatMonthLabel } from "@/lib/format";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const ORIGENS = ["Tráfego Pago", "Orgânico", "Social Selling", "Indicação", "Workshop"];
const COLORS: Record<string, string> = { "Tráfego Pago": "#6366f1", "Orgânico": "#22c55e", "Social Selling": "#f59e0b", "Indicação": "#ec4899", "Workshop": "#14b8a6" };

export default function CanaisPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [investimento, setInvestimento] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("contratos").select("*"),
      supabase.from("closers").select("*").eq("ativo", true).order("nome"),
      supabase.from("metas_mensais").select("valor_investido_anuncios"),
    ]).then(([{ data: cts }, { data: cls }, { data: metas }]) => {
      setContratos((cts || []) as Contrato[]);
      setClosers((cls || []) as Closer[]);
      setInvestimento((metas || []).reduce((s: number, m: { valor_investido_anuncios: number }) => s + Number(m.valor_investido_anuncios), 0));
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  const total = contratos.length;
  const porOrigem = ORIGENS.map((origem) => {
    const grupo = contratos.filter((c) => c.origem_lead === origem);
    const mrr = grupo.reduce((s, c) => s + Number(c.mrr), 0);
    const ltv = grupo.reduce((s, c) => s + Number(c.valor_total_projeto), 0);
    return {
      origem, qtd: grupo.length, pct: total > 0 ? (grupo.length / total) * 100 : 0,
      mrr, ltv, ticket: grupo.length > 0 ? mrr / grupo.length : 0,
      ltvMedio: grupo.length > 0 ? ltv / grupo.length : 0,
      cac: origem === "Tráfego Pago" && grupo.length > 0 ? investimento / grupo.length : null,
    };
  }).filter((o) => o.qtd > 0);

  const pieData = porOrigem.map((o) => ({ name: o.origem, value: o.qtd }));

  // Per month per origin
  const meses = Array.from(new Set(contratos.map((c) => c.mes_referencia))).sort();
  const lineData = meses.map((mes) => {
    const row: Record<string, string | number> = { mes: formatMonthLabel(mes).split(" ")[0] };
    ORIGENS.forEach((o) => { row[o] = contratos.filter((c) => c.mes_referencia === mes && c.origem_lead === o).reduce((s, c) => s + Number(c.mrr), 0); });
    return row;
  });

  // Best LTV origin
  const bestLtv = [...porOrigem].sort((a, b) => b.ltvMedio - a.ltvMedio)[0];

  // Ticket chart
  const ticketData = porOrigem.map((o) => ({ origem: o.origem.replace("Tráfego Pago", "Traf. Pago").replace("Social Selling", "Social"), ticket: o.ticket }));

  // Closer x origin
  const closerOrigem = closers.map((c) => {
    const row: Record<string, string | number> = { nome: c.nome };
    ORIGENS.forEach((o) => { row[o] = contratos.filter((ct) => ct.closer_id === c.id && ct.origem_lead === o).length; });
    return row;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Eficiencia por Canal</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie */}
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuicao por Canal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((e) => (<Cell key={e.name} fill={COLORS[e.name] || "#94a3b8"} />))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ticket chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ticket Medio por Canal {bestLtv && <Badge className="ml-2 bg-yellow-500/20 text-yellow-500">Maior LTV: {bestLtv.origem}</Badge>}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={ticketData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" />
                <YAxis dataKey="origem" type="category" width={80} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="ticket" fill="#22c55e" name="Ticket Medio" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* KPI table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Comparativo por Canal</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">Contratos</TableHead>
                <TableHead className="text-right">% Total</TableHead>
                <TableHead className="text-right">MRR Total</TableHead>
                <TableHead className="text-right">Ticket Medio</TableHead>
                <TableHead className="text-right">LTV Medio</TableHead>
                <TableHead className="text-right">CAC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porOrigem.map((o) => (
                <TableRow key={o.origem}>
                  <TableCell className="font-medium">{o.origem}</TableCell>
                  <TableCell className="text-right">{o.qtd}</TableCell>
                  <TableCell className="text-right">{formatPercent(o.pct)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(o.mrr)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(o.ticket)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(o.ltvMedio)}</TableCell>
                  <TableCell className="text-right">{o.cac !== null ? formatCurrency(o.cac) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MRR per month per origin */}
      <Card>
        <CardHeader><CardTitle className="text-base">MRR por Canal ao Longo dos Meses</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              {ORIGENS.map((o) => (<Line key={o} type="monotone" dataKey={o} stroke={COLORS[o]} strokeWidth={2} dot={{ r: 3 }} />))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Closer x origin */}
      <Card>
        <CardHeader><CardTitle className="text-base">Closer x Canal</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Closer</TableHead>
                {ORIGENS.map((o) => (<TableHead key={o} className="text-right">{o}</TableHead>))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {closerOrigem.map((c) => (
                <TableRow key={c.nome as string}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  {ORIGENS.map((o) => (<TableCell key={o} className="text-right">{c[o] || 0}</TableCell>))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
