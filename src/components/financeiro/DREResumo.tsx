"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { TrendingUp, TrendingDown, Minus, DollarSign, Percent, Users, Wallet } from "lucide-react";

interface DREData {
  receita_bruta: number; custo_total: number; lucro_liquido: number;
  margem_percentual: number; folha_sobre_receita: number;
  custos_por_categoria: { categoria: string; valor: number; percentual: number }[];
  comparativo: { receita_bruta_anterior: number; custo_total_anterior: number; lucro_anterior: number; margem_anterior: number };
}

function KpiSkeleton() {
  return <Card><CardContent className="pt-4 pb-3"><div className="h-16 bg-muted animate-pulse rounded" /></CardContent></Card>;
}

function DreKpi({ label, value, prev, format, invertTrend, icon: Icon, thresholds }: {
  label: string; value: number; prev: number; format: "currency" | "percent" | "number";
  invertTrend?: boolean; icon: React.ElementType;
  thresholds?: { green: number; yellow: number };
}) {
  const fmt = format === "currency" ? formatCurrency(value) : format === "percent" ? formatPercent(value) : String(value);
  const diff = prev > 0 ? ((value - prev) / prev) * 100 : 0;
  const isUp = diff > 0;
  const isGood = invertTrend ? !isUp : isUp;

  let thresholdColor = "";
  if (thresholds) {
    thresholdColor = value < thresholds.green ? "text-green-400" : value < thresholds.yellow ? "text-yellow-400" : "text-red-400";
  }

  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-xl font-bold ${thresholdColor}`}>{fmt}</p>
          </div>
          <Icon size={16} className="text-muted-foreground" />
        </div>
        {prev > 0 && Math.abs(diff) > 0.5 && (
          <div className="flex items-center gap-1 mt-1.5">
            {isGood ? <TrendingUp size={12} className="text-green-400" /> : <TrendingDown size={12} className="text-red-400" />}
            <span className={`text-[10px] ${isGood ? "text-green-400" : "text-red-400"}`}>
              {isUp ? "+" : ""}{diff.toFixed(1)}% vs anterior
            </span>
          </div>
        )}
        {prev > 0 && Math.abs(diff) <= 0.5 && (
          <div className="flex items-center gap-1 mt-1.5">
            <Minus size={12} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Estavel</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DREResumo({ mes }: { mes: string }) {
  const [data, setData] = useState<DREData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/financeiro/dre?mes=${mes}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [mes]);

  if (loading) return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)}
    </div>
  );

  if (!data) return <p className="text-sm text-muted-foreground text-center py-4">Sem dados para {mes}</p>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <DreKpi label="Receita Bruta" value={data.receita_bruta} prev={data.comparativo.receita_bruta_anterior} format="currency" icon={DollarSign} />
      <DreKpi label="Custo Total" value={data.custo_total} prev={data.comparativo.custo_total_anterior} format="currency" icon={Wallet} invertTrend />
      <DreKpi label="Lucro Liquido" value={data.lucro_liquido} prev={data.comparativo.lucro_anterior} format="currency" icon={TrendingUp} />
      <DreKpi label="Margem" value={data.margem_percentual} prev={data.comparativo.margem_anterior} format="percent" icon={Percent} />
      <DreKpi label="Folha / Receita" value={data.folha_sobre_receita} prev={0} format="percent" icon={Users} thresholds={{ green: 50, yellow: 65 }} />
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Custos Detalhados</p>
              <p className="text-xl font-bold">{data.custos_por_categoria.length}</p>
              <p className="text-[10px] text-muted-foreground">{data.custos_por_categoria.length} categorias</p>
            </div>
            <Wallet size={16} className="text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
