"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3 } from "lucide-react";

interface CustoCategoria { categoria: string; valor: number; percentual: number }

export function DespesasCategoria({ mes }: { mes: string }) {
  const [data, setData] = useState<{ custos_por_categoria: CustoCategoria[]; receita_bruta: number; custo_total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/financeiro/dre?mes=${mes}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [mes]);

  if (loading) return <Card><CardContent className="pt-4"><div className="h-48 bg-muted animate-pulse rounded" /></CardContent></Card>;

  if (!data || data.custos_por_categoria.length === 0) return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-12">
        <BarChart3 size={32} className="text-muted-foreground opacity-30" />
        <p className="text-sm text-muted-foreground">Nenhuma despesa registrada em {mes}</p>
      </CardContent>
    </Card>
  );

  const chartData = data.custos_por_categoria.map((c) => ({
    ...c,
    pctReceita: data.receita_bruta > 0 ? (c.valor / data.receita_bruta) * 100 : 0,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Despesas por Categoria</CardTitle>
          <span className="text-xs text-muted-foreground">Total: {formatCurrency(data.custo_total)}</span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 35)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 0 }}>
            <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <YAxis dataKey="categoria" type="category" width={120} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.pctReceita > 30 ? "#ef4444" : "#6366f1"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 space-y-1.5 border-t pt-3">
          {chartData.map((c) => (
            <div key={c.categoria} className="flex items-center justify-between text-xs">
              <span className={c.pctReceita > 30 ? "text-red-400 font-medium" : "text-muted-foreground"}>{c.categoria}</span>
              <div className="flex gap-3">
                <span className="font-mono">{formatCurrency(c.valor)}</span>
                <span className="text-muted-foreground w-10 text-right">{formatPercent(c.percentual)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
