"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LeadCrm, Closer, Contrato } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// formatMonthLabel removed (chart replaced with histogram)
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function diasEntre(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

function diasBadge(d: number | null) {
  if (d === null) return <span className="text-muted-foreground">—</span>;
  const color = d <= 7 ? "bg-green-500/20 text-green-500" : d <= 30 ? "bg-yellow-500/20 text-yellow-500" : "bg-red-500/20 text-red-500";
  return <Badge className={`${color} text-xs`}>{d}d</Badge>;
}

export default function FunilTempoPage() {
  const [leads, setLeads] = useState<LeadCrm[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [filtroCloser, setFiltroCloser] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      // No limit: needs all records for funnel time analysis across all months
      supabase.from("leads_crm").select("*").order("ghl_created_at", { ascending: false, nullsFirst: false }),
      supabase.from("closers").select("*").eq("ativo", true).order("nome"),
      supabase.from("contratos").select("cliente_nome,origem_lead,data_fechamento,closer_id"),
    ]).then(([{ data: l }, { data: c }, { data: cts }]) => {
      setLeads((l || []) as LeadCrm[]);
      setClosers((c || []) as Closer[]);
      setContratos((cts || []) as Contrato[]);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  // Últimos 90 dias como período padrão
  const dataCorte = new Date();
  dataCorte.setDate(dataCorte.getDate() - 90);
  const DATA_CORTE = dataCorte.toISOString().split("T")[0];
  const filtered = filtroCloser === "all" ? leads : leads.filter((l) => l.closer_id === filtroCloser);
  const fechados = filtered.filter((l) => l.etapa === "comprou" && (l.created_at || "") >= DATA_CORTE);

  // Calcs — para fechados (ciclo completo)
  // Fallback chain: data_comprou → data_venda → updated_at
  const dataFechamento = (l: LeadCrm) => l.data_comprou || l.data_venda || l.data_assinatura || l.updated_at;
  const dataCriacao = (l: LeadCrm) => l.preenchido_em || l.created_at;

  const withCiclo = fechados.map((l) => ({
    ...l,
    ciclo: diasEntre(dataCriacao(l), dataFechamento(l)),
    criacaoReuniao: diasEntre(dataCriacao(l), l.data_reuniao_agendada),
    reuniaoProposta: diasEntre(l.data_reuniao_agendada, l.data_proposta_enviada),
    propostaFechamento: diasEntre(l.data_proposta_enviada || l.data_reuniao_agendada, dataFechamento(l)),
  }));

  // Filtrar: ciclo válido (>= 0 e <= 365 dias — descartar outliers)
  const comCiclo = withCiclo.filter((l) => l.ciclo !== null && l.ciclo >= 0 && l.ciclo <= 365);

  const mediaCiclo = comCiclo.length > 0 ? comCiclo.reduce((s, l) => s + (l.ciclo || 0), 0) / comCiclo.length : 0;
  const mediaCriacaoReuniao = comCiclo.filter((l) => l.criacaoReuniao !== null).reduce((s, l, _, a) => s + (l.criacaoReuniao || 0) / a.length, 0);
  const mediaReuniaoProposta = comCiclo.filter((l) => l.reuniaoProposta !== null).reduce((s, l, _, a) => s + (l.reuniaoProposta || 0) / a.length, 0);
  const mediaPropostaFech = comCiclo.filter((l) => l.propostaFechamento !== null).reduce((s, l, _, a) => s + (l.propostaFechamento || 0) / a.length, 0);

  const ate7 = comCiclo.filter((l) => (l.ciclo || 0) <= 7).length;
  const pctAte7 = comCiclo.length > 0 ? (ate7 / comCiclo.length) * 100 : 0;

  // Insights
  // Closer mais rápido (só closers com dados)
  const closerStats = closers.map((c) => {
    const cl = comCiclo.filter((l) => l.closer_id === c.id);
    return { nome: c.nome, media: cl.length > 0 ? cl.reduce((s, l) => s + (l.ciclo || 0), 0) / cl.length : null, count: cl.length };
  }).filter((c) => c.media !== null);
  const bestCloser = closerStats.sort((a, b) => (a.media || 0) - (b.media || 0))[0];

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
        {bestCloser && bestCloser.media !== null && <Card><CardContent className="p-4 text-sm">{bestCloser.nome} fecha mais rapido: <strong>{bestCloser.media.toFixed(0)} dias</strong> em media ({bestCloser.count} contratos)</CardContent></Card>}
        <Card><CardContent className="p-4 text-sm">Total de contratos analisados: <strong>{comCiclo.length}</strong></CardContent></Card>
      </div>

      {/* Tempo por Canal — cruza com contratos para canal correto */}
      {(() => {
        // Mapa de nome do lead → origem do contrato (mais confiável)
        const contratoCanal = new Map<string, string>();
        contratos.forEach((ct) => {
          if (ct.origem_lead && ct.cliente_nome) contratoCanal.set(ct.cliente_nome.toLowerCase(), ct.origem_lead);
        });

        const canais = new Map<string, { total: number; dias: number[] }>();
        comCiclo.forEach((l) => {
          // Prioridade: contrato.origem_lead > lead.canal_aquisicao > lead.funil > "Sem canal"
          const canalContrato = l.nome ? contratoCanal.get(l.nome.toLowerCase()) : undefined;
          const canal = canalContrato || l.canal_aquisicao || l.funil || "Sem canal";
          const existing = canais.get(canal) || { total: 0, dias: [] };
          existing.total++;
          if (l.ciclo !== null) existing.dias.push(l.ciclo);
          canais.set(canal, existing);
        });
        const canalData = Array.from(canais.entries())
          .map(([canal, d]) => ({ canal, total: d.total, media: d.dias.length > 0 ? d.dias.reduce((s, v) => s + v, 0) / d.dias.length : 0 }))
          .sort((a, b) => a.media - b.media);

        return canalData.length > 0 ? (
          <Card>
            <CardHeader><CardTitle className="text-base">Tempo de Fechamento por Canal</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Canal</TableHead><TableHead className="text-right">Ciclo Medio</TableHead><TableHead className="text-right">Contratos</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {canalData.map((c) => (
                    <TableRow key={c.canal}>
                      <TableCell className="font-medium text-sm">{c.canal}</TableCell>
                      <TableCell className="text-right">{diasBadge(Math.round(c.media))}</TableCell>
                      <TableCell className="text-right text-sm">{c.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null;
      })()}

      {/* Histograma de distribuição */}
      {comCiclo.length > 0 && (() => {
        const faixas = [
          { label: "0-7d", min: 0, max: 7 },
          { label: "8-15d", min: 8, max: 15 },
          { label: "16-30d", min: 16, max: 30 },
          { label: "31-60d", min: 31, max: 60 },
          { label: "60d+", min: 61, max: 9999 },
        ];
        const histData = faixas.map((f) => ({
          faixa: f.label,
          count: comCiclo.filter((l) => (l.ciclo || 0) >= f.min && (l.ciclo || 0) <= f.max).length,
        }));
        return (
          <Card>
            <CardHeader><CardTitle className="text-base">Distribuição de Dias até Fechamento</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={histData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="faixa" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Contratos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })()}

      {/* Info */}
      {comCiclo.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nenhum contrato fechado a partir de 04/04/2026 com dados de ciclo. Os KPIs serao preenchidos conforme novos contratos forem registrados.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
