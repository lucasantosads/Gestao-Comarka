"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

interface FluxoMes { mes: string; entradas: number; saidas: number; saldo: number; saldo_acumulado: number }

const MESES_LABEL: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr", "05": "Mai", "06": "Jun",
  "07": "Jul", "08": "Ago", "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

export function FluxoCaixaChart({ ano }: { ano: number }) {
  const [data, setData] = useState<FluxoMes[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/financeiro/fluxo-caixa?ano=${ano}`)
      .then((r) => r.json())
      .then((d) => { setData(d.meses || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [ano]);

  if (loading) return <Card><CardContent className="pt-4"><div className="h-64 bg-muted animate-pulse rounded" /></CardContent></Card>;

  if (data.length === 0) return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-12">
        <TrendingUp size={32} className="text-muted-foreground opacity-30" />
        <p className="text-sm text-muted-foreground">Sem dados de fluxo de caixa para {ano}</p>
      </CardContent>
    </Card>
  );

  const chartData = data.map((m) => ({
    mes: MESES_LABEL[m.mes.split("-")[1]] || m.mes,
    Entradas: m.entradas,
    Saidas: m.saidas,
    "Saldo Acumulado": m.saldo_acumulado,
  }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Fluxo de Caixa — {ano}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ fontSize: 12 }} />
            <Legend />
            <Bar dataKey="Entradas" fill="#22c55e" radius={[3, 3, 0, 0]} opacity={0.8} />
            <Bar dataKey="Saidas" fill="#ef4444" radius={[3, 3, 0, 0]} opacity={0.8} />
            <Line type="monotone" dataKey="Saldo Acumulado" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
