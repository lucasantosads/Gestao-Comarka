"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LeadCrm, Closer } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMonthLabel } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

function diasEntre(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

function diasBadge(d: number | null) {
  if (d === null) return <span className="text-muted-foreground">—</span>;
  const color = d <= 7 ? "bg-green-500/20 text-green-500" : d <= 14 ? "bg-yellow-500/20 text-yellow-500" : "bg-red-500/20 text-red-500";
  return <Badge className={`${color} text-xs`}>{d}d</Badge>;
}

export default function FunilTempoPage() {
  const [leads, setLeads] = useState<LeadCrm[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [filtroCloser, setFiltroCloser] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("leads_crm").select("*").not("ghl_contact_id", "like", "notion-%").order("created_at", { ascending: false }),
      supabase.from("closers").select("*").eq("ativo", true).order("nome"),
    ]).then(([{ data: l }, { data: c }]) => {
      setLeads((l || []) as LeadCrm[]);
      setClosers((c || []) as Closer[]);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  const filtered = filtroCloser === "all" ? leads : leads.filter((l) => l.closer_id === filtroCloser);
  const closerName = (id: string | null) => closers.find((c) => c.id === id)?.nome || "—";
  const fechados = filtered.filter((l) => l.etapa === "comprou");

  // Calcs — para fechados (ciclo completo)
  const withCiclo = fechados.map((l) => ({
    ...l,
    ciclo: diasEntre(l.preenchido_em || l.created_at, l.data_comprou),
    criacaoReuniao: diasEntre(l.preenchido_em || l.created_at, l.data_reuniao_agendada),
    reuniaoProposta: diasEntre(l.data_reuniao_agendada, l.data_proposta_enviada),
    propostaFechamento: diasEntre(l.data_proposta_enviada, l.data_comprou),
  }));

  const comCiclo = withCiclo.filter((l) => l.ciclo !== null && l.ciclo >= 0);

  // Todos os leads ativos — tempo desde criação até agora
  const hoje = new Date().toISOString();
  const leadsAtivos = filtered.filter((l) => !["comprou", "desistiu"].includes(l.etapa)).map((l) => ({
    ...l,
    diasNoFunil: diasEntre(l.preenchido_em || l.created_at, hoje),
  }));
  const mediaCiclo = comCiclo.length > 0 ? comCiclo.reduce((s, l) => s + (l.ciclo || 0), 0) / comCiclo.length : 0;
  const mediaCriacaoReuniao = comCiclo.filter((l) => l.criacaoReuniao !== null).reduce((s, l, _, a) => s + (l.criacaoReuniao || 0) / a.length, 0);
  const mediaReuniaoProposta = comCiclo.filter((l) => l.reuniaoProposta !== null).reduce((s, l, _, a) => s + (l.reuniaoProposta || 0) / a.length, 0);
  const mediaPropostaFech = comCiclo.filter((l) => l.propostaFechamento !== null).reduce((s, l, _, a) => s + (l.propostaFechamento || 0) / a.length, 0);

  const ate7 = comCiclo.filter((l) => (l.ciclo || 0) <= 7).length;
  const pctAte7 = comCiclo.length > 0 ? (ate7 / comCiclo.length) * 100 : 0;

  // Per month chart
  const meses = Array.from(new Set(filtered.map((l) => l.mes_referencia).filter(Boolean))).sort() as string[];
  const chartData = meses.map((m) => {
    const ml = withCiclo.filter((l) => l.mes_referencia === m && l.ciclo !== null);
    const avgCR = ml.filter((l) => l.criacaoReuniao !== null);
    const avgRP = ml.filter((l) => l.reuniaoProposta !== null);
    const avgPF = ml.filter((l) => l.propostaFechamento !== null);
    return {
      mes: formatMonthLabel(m).split(" ")[0],
      "Criação→Reunião": avgCR.length > 0 ? avgCR.reduce((s, l) => s + (l.criacaoReuniao || 0), 0) / avgCR.length : 0,
      "Reunião→Proposta": avgRP.length > 0 ? avgRP.reduce((s, l) => s + (l.reuniaoProposta || 0), 0) / avgRP.length : 0,
      "Proposta→Fechamento": avgPF.length > 0 ? avgPF.reduce((s, l) => s + (l.propostaFechamento || 0), 0) / avgPF.length : 0,
    };
  });

  // Insights
  const bestCloser = closers.map((c) => {
    const cl = comCiclo.filter((l) => l.closer_id === c.id);
    return { nome: c.nome, media: cl.length > 0 ? cl.reduce((s, l) => s + (l.ciclo || 0), 0) / cl.length : 999 };
  }).sort((a, b) => a.media - b.media)[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Tempo de Fechamento</h1>
        <Select value={filtroCloser} onValueChange={setFiltroCloser}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem>{closers.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Ciclo Medio Total" value={`${mediaCiclo.toFixed(0)} dias`} />
        <KpiCard title="Criação → Reunião" value={`${mediaCriacaoReuniao.toFixed(0)} dias`} />
        <KpiCard title="Reuniao → Proposta" value={`${mediaReuniaoProposta.toFixed(0)} dias`} />
        <KpiCard title="Proposta → Fechamento" value={`${mediaPropostaFech.toFixed(0)} dias`} />
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-sm">Leads que fecham em ate 7 dias: <strong>{pctAte7.toFixed(0)}%</strong> ({ate7} de {comCiclo.length})</CardContent></Card>
        {bestCloser && <Card><CardContent className="p-4 text-sm">{bestCloser.nome} fecha mais rapido: <strong>{bestCloser.media.toFixed(0)} dias</strong> em media</CardContent></Card>}
        <Card><CardContent className="p-4 text-sm">Total de contratos analisados: <strong>{comCiclo.length}</strong></CardContent></Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Ciclo por Mes (dias)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="mes" /><YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Criação→Reunião" stackId="a" fill="#6366f1" />
              <Bar dataKey="Reunião→Proposta" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Proposta→Fechamento" stackId="a" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Active leads */}
      {leadsAtivos.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Leads Ativos no Funil ({leadsAtivos.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Lead</TableHead><TableHead>Etapa</TableHead><TableHead>Closer</TableHead><TableHead>Criado em</TableHead><TableHead>Dias no Funil</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {leadsAtivos.sort((a, b) => (b.diasNoFunil || 0) - (a.diasNoFunil || 0)).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium text-sm">{l.nome}</TableCell>
                      <TableCell className="text-xs">{l.etapa}</TableCell>
                      <TableCell className="text-xs">{closerName(l.closer_id)}</TableCell>
                      <TableCell className="text-xs">{l.preenchido_em ? new Date(l.preenchido_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}</TableCell>
                      <TableCell>{diasBadge(l.diasNoFunil)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Leads Fechados ({withCiclo.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead><TableHead>Closer</TableHead><TableHead>Criado</TableHead><TableHead>Reuniao</TableHead><TableHead>Proposta</TableHead><TableHead>Fechou</TableHead><TableHead>Ciclo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withCiclo.slice(0, 50).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium text-sm">{l.nome}</TableCell>
                    <TableCell className="text-xs">{closerName(l.closer_id)}</TableCell>
                    <TableCell className="text-xs">{l.preenchido_em ? new Date(l.preenchido_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}</TableCell>
                    <TableCell className="text-xs">{l.data_reuniao_agendada ? new Date(l.data_reuniao_agendada).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}</TableCell>
                    <TableCell className="text-xs">{l.data_proposta_enviada ? new Date(l.data_proposta_enviada).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}</TableCell>
                    <TableCell className="text-xs">{l.data_comprou ? new Date(l.data_comprou).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}</TableCell>
                    <TableCell>{diasBadge(l.ciclo)}</TableCell>
                  </TableRow>
                ))}
                {comCiclo.length > 0 && (
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell colSpan={6}>MEDIA</TableCell>
                    <TableCell>{diasBadge(Math.round(mediaCiclo))}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
