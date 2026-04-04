"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCurrency, formatPercent } from "@/lib/format";
import { GaugeChart } from "@/components/gauge-chart";
import { Button } from "@/components/ui/button";
import { Maximize2 } from "lucide-react";
import type { MetaMensal, MetaCloser, Contrato, Closer, LancamentoDiario } from "@/types/database";

const ORIGIN_COLORS: Record<string, string> = {
  "Tráfego Pago": "#6366f1",
  "Orgânico": "#22c55e",
  "Social Selling": "#f59e0b",
  "Indicação": "#ec4899",
  "Workshop": "#14b8a6",
};

interface DashboardChartsProps {
  meta: MetaMensal | null;
  metasClosers: Record<string, MetaCloser>;
  contratos: Contrato[];
  closers: Closer[];
  lancamentos: LancamentoDiario[];
  onFullscreenGauges?: () => void;
}

// Progress bar component
function ProgressBar({
  label,
  current,
  target,
  format = "number",
  inverse = false,
}: {
  label: string;
  current: number;
  target: number;
  format?: "number" | "currency" | "percent";
  inverse?: boolean;
}) {
  const pct = target > 0 ? (current / target) * 100 : 0;
  const displayPct = Math.min(pct, 100);
  const color = inverse ? "bg-red-500" : "bg-green-500";

  const fmt = (v: number) => {
    if (format === "currency") return formatCurrency(v);
    if (format === "percent") return formatPercent(v);
    return String(Math.round(v));
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {fmt(current)} / {fmt(target)}{" "}
          <span className="text-xs text-muted-foreground">
            ({pct.toFixed(0)}%)
          </span>
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${displayPct}%` }}
        />
      </div>
    </div>
  );
}

export function DashboardCharts({
  meta,
  metasClosers,
  contratos,
  closers,
  lancamentos,
  onFullscreenGauges,
}: DashboardChartsProps) {
  if (!meta) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Configure as metas do mes em /metas para ver os graficos
        </CardContent>
      </Card>
    );
  }

  // Aggregate data (fonte: lancamentos_diarios para consistência com dashboard)
  const totalContratos = lancamentos.reduce((s, l) => s + l.ganhos, 0);
  const totalMrr = lancamentos.reduce((s, l) => s + Number(l.mrr_dia), 0);
  const totalLtv = lancamentos.reduce((s, l) => s + Number(l.ltv), 0);
  const totalReunioesAgendadas = lancamentos.reduce((s, l) => s + l.reunioes_marcadas, 0);
  const totalReunioesFeitas = lancamentos.reduce((s, l) => s + l.reunioes_feitas, 0);
  const noShowPct = totalReunioesAgendadas > 0
    ? ((totalReunioesAgendadas - totalReunioesFeitas) / totalReunioesAgendadas) * 100
    : 0;

  // Chart 1: Progress
  const progressItems = [
    { label: "Contratos", current: totalContratos, target: meta.meta_contratos_fechados, format: "number" as const },
    { label: "Entradas (MRR)", current: totalMrr, target: Number(meta.meta_entrada_valor), format: "currency" as const },
    { label: "Faturamento/LTV", current: totalLtv, target: Number(meta.meta_faturamento_total), format: "currency" as const },
    { label: "Reuniões Feitas", current: totalReunioesFeitas, target: meta.meta_reunioes_feitas, format: "number" as const },
    { label: "Reuniões Agendadas", current: totalReunioesAgendadas, target: meta.meta_reunioes_agendadas, format: "number" as const },
  ];

  // Chart 2: Origin pie
  const originData = Object.entries(
    contratos.reduce<Record<string, number>>((acc, c) => {
      acc[c.origem_lead] = (acc[c.origem_lead] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // Chart 3: Closer performance bars
  const closerPerf = closers.map((c) => {
    const myLanc = lancamentos.filter((l) => l.closer_id === c.id);
    const myContratos = myLanc.reduce((s, l) => s + l.ganhos, 0);
    const myMrr = myLanc.reduce((s, l) => s + Number(l.mrr_dia), 0);
    const myReunioesFeitas = myLanc.reduce((s, l) => s + l.reunioes_feitas, 0);
    const mc = metasClosers[c.id];
    return {
      nome: c.nome,
      contratos: myContratos,
      metaContratos: mc?.meta_contratos || 0,
      mrr: myMrr,
      metaMrr: Number(mc?.meta_mrr || 0),
      reunioes: myReunioesFeitas,
      metaReunioes: mc?.meta_reunioes_feitas || 0,
    };
  });

  // Chart 4: Daily cumulative line
  const dailyMap: Record<string, number> = {};
  for (const c of contratos) {
    const day = c.data_fechamento;
    dailyMap[day] = (dailyMap[day] || 0) + 1;
  }
  const sortedDays = Object.keys(dailyMap).sort();
  let cumulative = 0;
  const dailyLine = sortedDays.map((day) => {
    cumulative += dailyMap[day];
    return {
      dia: new Date(day + "T12:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      acumulado: cumulative,
    };
  });
  // Working days in month estimate
  const metaPerDay = meta.meta_contratos_fechados > 0 ? meta.meta_contratos_fechados / 22 : 0;

  // Chart 6: Ranking
  const ranking = closers
    .map((c) => {
      const mc = metasClosers[c.id];
      const myContratos = contratos.filter((ct) => ct.closer_id === c.id).length;
      const myMrr = contratos
        .filter((ct) => ct.closer_id === c.id)
        .reduce((s, ct) => s + Number(ct.mrr), 0);
      const myLanc = lancamentos.filter((l) => l.closer_id === c.id);
      const myFeitas = myLanc.reduce((s, l) => s + l.reunioes_feitas, 0);
      const myAgendadas = myLanc.reduce((s, l) => s + l.reunioes_marcadas, 0);
      const noShow = myAgendadas > 0 ? ((myAgendadas - myFeitas) / myAgendadas) * 100 : 0;
      const taxaConv = myFeitas > 0 ? (myContratos / myFeitas) * 100 : 0;

      const metaContratosAtingida = mc ? myContratos >= mc.meta_contratos : false;
      const metaMrrAtingida = mc ? myMrr >= Number(mc.meta_mrr) : false;

      let status: "acima" | "andamento" | "abaixo" = "andamento";
      if (mc) {
        if (metaContratosAtingida && metaMrrAtingida) status = "acima";
        else if (myContratos === 0 && myMrr === 0) status = "abaixo";
      }

      const myLtv = contratos
        .filter((ct) => ct.closer_id === c.id)
        .reduce((s, ct) => s + Number(ct.valor_total_projeto), 0);

      return {
        nome: c.nome,
        contratos: myContratos,
        mrr: myMrr,
        ltv: myLtv,
        taxaConv,
        noShow,
        status,
      };
    })
    .sort((a, b) => b.mrr - a.mrr);

  return (
    <div className="space-y-6">
      {/* Gauges: Faturamento + Entradas */}
      <div className="flex justify-end">
        {onFullscreenGauges && (
          <Button variant="outline" size="sm" onClick={onFullscreenGauges}>
            <Maximize2 size={14} className="mr-1" />TV
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GaugeChart
          label="Entradas (MRR)"
          current={totalMrr}
          target={Number(meta.meta_entrada_valor)}
        />
        <GaugeChart
          label="Faturamento / LTV"
          current={totalLtv}
          target={Number(meta.meta_faturamento_total)}
        />
      </div>

      {/* Chart 1: Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progresso das Metas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {progressItems.map((p) => (
            <ProgressBar key={p.label} {...p} />
          ))}
          <ProgressBar
            label="No Show"
            current={noShowPct}
            target={Number(meta.meta_taxa_no_show)}
            format="percent"
            inverse
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 2: Origin Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Origem dos Leads → Contratos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {originData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={originData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {originData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={ORIGIN_COLORS[entry.name] || "#94a3b8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Sem contratos
              </p>
            )}
          </CardContent>
        </Card>

        {/* Chart 4: Daily Line */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Evolucao Diaria de Contratos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyLine.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dailyLine}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="acumulado"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Contratos"
                  />
                  {metaPerDay > 0 && (
                    <ReferenceLine
                      y={meta.meta_contratos_fechados}
                      stroke="#94a3b8"
                      strokeDasharray="5 5"
                      label={{ value: "Meta", position: "right" }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Sem dados
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart 3: Closer Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance dos Closers</CardTitle>
        </CardHeader>
        <CardContent>
          {closerPerf.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={closerPerf} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="nome" type="category" width={80} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="contratos" fill="#6366f1" name="Contratos" />
                <Bar dataKey="metaContratos" fill="#94a3b8" name="Meta" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">Sem dados</p>
          )}
        </CardContent>
      </Card>

      {/* Chart 6: Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking de Closers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead className="text-right">Contratos</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead className="text-right">Faturamento/LTV</TableHead>
                  <TableHead className="text-right">Taxa Conv</TableHead>
                  <TableHead className="text-right">No Show %</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((r, i) => (
                  <TableRow key={r.nome}>
                    <TableCell className="font-bold">{i + 1}o</TableCell>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right">{r.contratos}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(r.mrr)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(r.ltv)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(r.taxaConv)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(r.noShow)}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.status === "acima" && (
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                          Acima
                        </Badge>
                      )}
                      {r.status === "andamento" && (
                        <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                          Em andamento
                        </Badge>
                      )}
                      {r.status === "abaixo" && (
                        <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
                          Abaixo
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
