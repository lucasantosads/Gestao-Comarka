"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Contrato, Closer, LeadCrm } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent, formatMonthLabel } from "@/lib/format";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS_LIST = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6", "#8b5cf6", "#ef4444", "#64748b", "#06b6d4", "#d946ef"];
const CANAIS_PAGOS = ["Tráfego Pago", "Trafego Pago", "trafego pago", "facebookads", "googleads"];

export default function CanaisPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [leads, setLeads] = useState<LeadCrm[]>([]);
  const [investimento, setInvestimento] = useState(0);
  const [canalSelecionado, setCanalSelecionado] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("contratos").select("*"),
      supabase.from("closers").select("*").eq("ativo", true).order("nome"),
      supabase.from("leads_crm").select("canal_aquisicao,funil,etapa,closer_id,mes_referencia"),
      supabase.from("ads_performance").select("spend"),
    ]).then(([{ data: cts }, { data: cls }, { data: lds }, { data: adsPerf }]) => {
      setContratos((cts || []) as Contrato[]);
      setClosers((cls || []) as Closer[]);
      setLeads((lds || []) as LeadCrm[]);
      setInvestimento((adsPerf || []).reduce((s: number, r: { spend: number }) => s + Number(r.spend), 0));
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  // Canais dinâmicos — extrair de contratos reais (incluir "Sem canal" para contratos sem origem)
  const total = contratos.length;
  const semCanal = contratos.filter((c) => !c.origem_lead).length;
  const canaisUnicos = Array.from(new Set(contratos.map((c) => c.origem_lead).filter(Boolean)));
  if (semCanal > 0) canaisUnicos.push("Sem canal");
  const colorMap: Record<string, string> = {};
  canaisUnicos.forEach((c, i) => { colorMap[c] = COLORS_LIST[i % COLORS_LIST.length]; });

  const isPago = (canal: string) => CANAIS_PAGOS.some((p) => canal.toLowerCase().includes(p.toLowerCase()));

  const porOrigem = canaisUnicos.map((origem) => {
    const grupo = origem === "Sem canal"
      ? contratos.filter((c) => !c.origem_lead)
      : contratos.filter((c) => c.origem_lead === origem);
    const mrr = grupo.reduce((s, c) => s + Number(c.mrr), 0);
    const ltv = grupo.reduce((s, c) => s + Number(c.valor_total_projeto || c.mrr * c.meses_contrato), 0);
    const cac = isPago(origem) && grupo.length > 0 ? investimento / grupo.length : 0;
    const ltvMedio = grupo.length > 0 ? ltv / grupo.length : 0;
    return {
      origem, qtd: grupo.length, pct: total > 0 ? (grupo.length / total) * 100 : 0,
      mrr, ltv, ticket: grupo.length > 0 ? mrr / grupo.length : 0,
      ltvMedio, cac, isPago: isPago(origem),
      eficiencia: cac > 0 ? ltvMedio / cac : 0,
    };
  }).filter((o) => o.qtd > 0).sort((a, b) => b.eficiencia - a.eficiencia);

  const pieData = porOrigem.map((o) => ({ name: o.origem, value: o.qtd, mrr: o.mrr, pct: o.pct }));

  // Funil por canal (Tarefa 3)
  // Count paid canals to split spend proportionally
  const canaisPagos = canaisUnicos.filter((c) => isPago(c));
  const funilPorCanal = canaisUnicos.map((canal) => {
    // Match leads by canal_aquisicao OR funil, checking each independently
    const leadsDoCanal = leads.filter((l) => l.canal_aquisicao === canal || (!l.canal_aquisicao && l.funil === canal));
    const totalLeads = leadsDoCanal.length;
    const reunioes = leadsDoCanal.filter((l) => ["reuniao_agendada", "proposta_enviada", "assinatura_contrato", "comprou"].includes(l.etapa)).length;
    const propostas = leadsDoCanal.filter((l) => ["proposta_enviada", "assinatura_contrato", "comprou"].includes(l.etapa)).length;
    const fechados = contratos.filter((c) => c.origem_lead === canal).length;
    // Spend proporcional ao número de leads do canal pago (não dividido igualmente)
    const totalLeadsPagos = canaisPagos.reduce((s, c) => s + leads.filter((l) => l.canal_aquisicao === c || (!l.canal_aquisicao && l.funil === c)).length, 0);
    const spend = isPago(canal) && totalLeadsPagos > 0 ? investimento * (totalLeads / totalLeadsPagos) : 0;
    return {
      canal, leads: totalLeads, reunioes, propostas, fechados,
      taxaReuniao: totalLeads > 0 ? (reunioes / totalLeads) * 100 : 0,
      taxaProposta: reunioes > 0 ? (propostas / reunioes) * 100 : 0,
      taxaContrato: totalLeads > 0 ? (fechados / totalLeads) * 100 : 0,
      cpl: totalLeads > 0 && spend > 0 ? spend / totalLeads : 0,
      cprf: reunioes > 0 && spend > 0 ? spend / reunioes : 0,
      cac: fechados > 0 && spend > 0 ? spend / fechados : 0,
    };
  }).filter((f) => f.leads > 0 || f.fechados > 0);

  // Per month per origin
  const meses = Array.from(new Set(contratos.map((c) => c.mes_referencia))).sort();
  const lineData = meses.map((mes) => {
    const row: Record<string, string | number> = { mes: formatMonthLabel(mes).split(" ")[0] };
    canaisUnicos.forEach((o) => { row[o] = contratos.filter((c) => c.mes_referencia === mes && c.origem_lead === o).reduce((s, c) => s + Number(c.mrr), 0); });
    return row;
  });

  // Filtered by selected canal
  const filteredContratos = canalSelecionado ? porOrigem.filter((o) => o.origem === canalSelecionado) : porOrigem;

  // Closer x origin
  const closerOrigem = closers.map((c) => {
    const row: Record<string, string | number> = { nome: c.nome };
    canaisUnicos.forEach((o) => { row[o] = contratos.filter((ct) => ct.closer_id === c.id && ct.origem_lead === o).length; });
    return row;
  });

  // Best LTV origin
  const bestLtv = [...porOrigem].sort((a, b) => b.ltvMedio - a.ltvMedio)[0];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Eficiência por Canal</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut com tooltip completo — ocultar quando 1 canal */}
        {pieData.length <= 1 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-sm text-muted-foreground">Todos os contratos vieram de <strong>{pieData[0]?.name || "um único canal"}</strong>.</p>
              <p className="text-xs text-muted-foreground">Adicione outros canais de aquisição para comparar a eficiência.</p>
            </CardContent>
          </Card>
        ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Canal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  onClick={(_, idx) => {
                    const clicked = pieData[idx]?.name;
                    setCanalSelecionado(canalSelecionado === clicked ? null : clicked);
                  }}
                  cursor="pointer"
                >
                  {pieData.map((e) => (
                    <Cell key={e.name} fill={colorMap[e.name] || "#94a3b8"} opacity={canalSelecionado && canalSelecionado !== e.name ? 0.3 : 1} />
                  ))}
                </Pie>
                <Tooltip content={({ payload }) => {
                  const d = payload?.[0]?.payload;
                  if (!d) return null;
                  const orig = porOrigem.find((o) => o.origem === d.name);
                  return (
                    <div className="bg-card border rounded-lg p-2 text-xs shadow-lg">
                      <p className="font-medium">{d.name}</p>
                      <p>{d.value} contratos ({d.pct?.toFixed(1)}%)</p>
                      {orig && <p>MRR: {formatCurrency(orig.mrr)}</p>}
                    </div>
                  );
                }} />
              </PieChart>
            </ResponsiveContainer>
            {canalSelecionado && (
              <div className="text-center mt-2">
                <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => setCanalSelecionado(null)}>
                  Filtro: {canalSelecionado} ✕
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Ticket chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ticket Medio por Canal {bestLtv && <Badge className="ml-2 bg-yellow-500/20 text-yellow-500">Maior LTV: {bestLtv.origem}</Badge>}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porOrigem.map((o) => ({ origem: o.origem.length > 12 ? o.origem.slice(0, 12) + "..." : o.origem, ticket: o.ticket }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" />
                <YAxis dataKey="origem" type="category" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="ticket" fill="#22c55e" name="Ticket Medio" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Comparativo (com CAC, LTV, Eficiência) */}
      <Card>
        <CardHeader><CardTitle className="text-base">Comparativo por Canal</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">Contratos</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead className="text-right">Ticket</TableHead>
                <TableHead className="text-right">LTV Medio</TableHead>
                <TableHead className="text-right">CAC</TableHead>
                <TableHead className="text-right">Eficiência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContratos.map((o) => (
                <TableRow key={o.origem} className={canalSelecionado === o.origem ? "bg-primary/5" : ""}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: colorMap[o.origem] }} />
                    {o.origem}
                  </TableCell>
                  <TableCell className="text-right">{o.qtd}</TableCell>
                  <TableCell className="text-right">{formatPercent(o.pct)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(o.mrr)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(o.ticket)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(o.ltvMedio)}</TableCell>
                  <TableCell className="text-right">
                    {o.isPago ? formatCurrency(o.cac) : <span className="text-muted-foreground text-xs">(organico)</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {o.eficiencia > 0 ? (
                      <span className={o.eficiencia >= 3 ? "text-green-400" : o.eficiencia >= 1 ? "text-yellow-400" : "text-red-400"}>
                        {o.eficiencia.toFixed(1)}x
                      </span>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Funil por Canal (Tarefa 3) */}
      {funilPorCanal.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Funil de Conversao por Canal</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Reuniao (%)</TableHead>
                  <TableHead className="text-right">Proposta (%)</TableHead>
                  <TableHead className="text-right">Contrato (%)</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                  <TableHead className="text-right">CPRF</TableHead>
                  <TableHead className="text-right">CAC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funilPorCanal.map((f) => (
                  <TableRow key={f.canal}>
                    <TableCell className="font-medium">{f.canal}</TableCell>
                    <TableCell className="text-right">{f.leads}</TableCell>
                    <TableCell className="text-right">{f.reunioes} <span className="text-muted-foreground text-xs">({formatPercent(f.taxaReuniao)})</span></TableCell>
                    <TableCell className="text-right">{f.propostas} <span className="text-muted-foreground text-xs">({formatPercent(f.taxaProposta)})</span></TableCell>
                    <TableCell className="text-right">{f.fechados} <span className="text-muted-foreground text-xs">({formatPercent(f.taxaContrato)})</span></TableCell>
                    <TableCell className="text-right">{f.cpl > 0 ? formatCurrency(f.cpl) : "—"}</TableCell>
                    <TableCell className="text-right">{f.cprf > 0 ? formatCurrency(f.cprf) : "—"}</TableCell>
                    <TableCell className="text-right">{f.cac > 0 ? formatCurrency(f.cac) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* MRR por Canal ao longo dos meses */}
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
              {canaisUnicos.map((o) => (<Line key={o} type="monotone" dataKey={o} stroke={colorMap[o]} strokeWidth={2} dot={{ r: 3 }} />))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Closer x Canal */}
      <Card>
        <CardHeader><CardTitle className="text-base">Closer x Canal</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Closer</TableHead>
                {canaisUnicos.map((o) => (<TableHead key={o} className="text-right">{o}</TableHead>))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {closerOrigem.map((c) => (
                <TableRow key={c.nome as string}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  {canaisUnicos.map((o) => (<TableCell key={o} className="text-right">{c[o] || 0}</TableCell>))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
