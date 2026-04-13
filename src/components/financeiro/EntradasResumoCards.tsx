"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { TrendingUp, TrendingDown, DollarSign, Users, UserPlus, UserMinus, AlertTriangle, Wallet, Info } from "lucide-react";

interface Resumo {
  receita_total: number; receita_pendente: number; clientes_pagantes: number;
  clientes_ativos: number; ticket_medio: number; inadimplentes: number;
  churn_mes: number; receita_churned: number; novos_clientes: number;
  receita_nova: number;
  comparativo: { receita_anterior: number; variacao_percentual: number };
}

function Kpi({ label, value, sub, icon: Icon, color, trend, tooltip }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  color?: string; trend?: { diff: number; invertido?: boolean }; tooltip?: string;
}) {
  const isGood = trend ? (trend.invertido ? trend.diff < 0 : trend.diff > 0) : undefined;
  return (
    <Card className={color ? `border-${color}-500/20` : ""}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              {tooltip && (
                <span className="group relative">
                  <Info size={10} className="text-muted-foreground/50 cursor-help" />
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block z-50 w-48 p-2 text-[10px] text-foreground bg-popover border rounded-lg shadow-lg leading-tight">{tooltip}</span>
                </span>
              )}
            </div>
            <p className={`text-lg font-bold ${color ? `text-${color}-400` : ""}`}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <Icon size={16} className="text-muted-foreground shrink-0" />
        </div>
        {trend && Math.abs(trend.diff) > 0.5 && (
          <div className="flex items-center gap-1 mt-1">
            {isGood ? <TrendingUp size={11} className="text-green-400" /> : <TrendingDown size={11} className="text-red-400" />}
            <span className={`text-[10px] ${isGood ? "text-green-400" : "text-red-400"}`}>{trend.diff > 0 ? "+" : ""}{trend.diff.toFixed(1)}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Skeleton() { return <Card><CardContent className="pt-4 pb-3"><div className="h-14 bg-muted animate-pulse rounded" /></CardContent></Card>; }

export function EntradasResumoCards({ resumo, loading }: { resumo: Resumo | null; loading: boolean }) {
  if (loading || !resumo) return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}</div>;

  const r = resumo;
  const mrr = (r as unknown as { mrr?: number }).mrr || 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Kpi label="Receita Confirmada" value={formatCurrency(r.receita_total)} icon={DollarSign} color="green"
        sub={`Anterior: ${formatCurrency(r.comparativo.receita_anterior)}`}
        trend={{ diff: r.comparativo.variacao_percentual }}
        tooltip="Soma de todos os pagamentos confirmados (status pago) no mes selecionado." />
      <Kpi label="Receita Pendente" value={formatCurrency(r.receita_pendente)} icon={Wallet}
        color={r.receita_pendente > 0 ? "yellow" : undefined}
        tooltip="Valor total dos clientes ativos recorrentes que ainda nao pagaram e ja passaram do dia de vencimento." />
      <Kpi label="Clientes Ativos" value={String(r.clientes_ativos)} icon={Users}
        sub={`${r.clientes_pagantes} pagaram este mes`}
        tooltip="Total de clientes na casa: ativos recorrentes, pagou integral, MDS, parcerias e pausados." />
      <Kpi label="Ticket Medio" value={formatCurrency(r.ticket_medio)} icon={DollarSign}
        trend={{ diff: r.comparativo.variacao_percentual }}
        tooltip="Valor medio mensal dos clientes ativos recorrentes (soma dos valores mensais / quantidade de ativos)." />
      <Kpi label="Novos Clientes" value={String(r.novos_clientes)} icon={UserPlus} color="green"
        sub={r.receita_nova > 0 ? `+${formatCurrency(r.receita_nova)}` : undefined}
        tooltip="Clientes cujo mes de fechamento coincide com o mes selecionado." />
      <Kpi label="Churn" value={String(r.churn_mes)} icon={UserMinus}
        color={r.churn_mes > 0 ? "red" : "green"}
        sub={r.receita_churned > 0 ? `-${formatCurrency(r.receita_churned)}` : "Nenhum"}
        tooltip="Total de clientes que cancelaram (historico completo). Inclui a receita perdida com esses cancelamentos." />
      <Kpi label="Inadimplentes" value={String(r.inadimplentes)} icon={AlertTriangle}
        color={r.inadimplentes > 3 ? "red" : r.inadimplentes > 0 ? "yellow" : "green"}
        sub={r.inadimplentes > 0 ? formatCurrency(r.receita_pendente) : "Tudo em dia"}
        tooltip="Clientes ativos recorrentes que ja passaram do dia de vencimento e ainda nao pagaram neste mes." />
      <Kpi label="MRR" value={formatCurrency(mrr)} icon={TrendingUp}
        color="green"
        tooltip="Monthly Recurring Revenue — soma do valor mensal de todos os clientes ativos recorrentes. Representa a receita esperada por mes." />
      {(r as unknown as { ltv_medio_ativos?: number }).ltv_medio_ativos ? (
        <Kpi label="LTV Medio (meses)" value={`${((r as unknown as { ltv_medio_ativos: number }).ltv_medio_ativos).toFixed(1)} meses`} icon={Users}
          sub="Media de permanencia dos ativos"
          tooltip="Media de meses que os clientes ativos recorrentes permanecem pagando. Calculado pela quantidade de pagamentos confirmados de cada cliente." />
      ) : null}
    </div>
  );
}
