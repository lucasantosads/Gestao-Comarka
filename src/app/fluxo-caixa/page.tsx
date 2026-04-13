"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { FluxoCaixaChart } from "@/components/financeiro/FluxoCaixaChart";
import { DollarSign, TrendingUp, TrendingDown, Shield } from "lucide-react";

interface FluxoMes { mes: string; entradas: number; saidas: number; saldo: number; saldo_acumulado: number }

const MESES_LABEL: Record<string, string> = {
  "01": "Janeiro", "02": "Fevereiro", "03": "Marco", "04": "Abril", "05": "Maio", "06": "Junho",
  "07": "Julho", "08": "Agosto", "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
};

export default function FluxoCaixaPage() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [meses, setMeses] = useState<FluxoMes[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/financeiro/fluxo-caixa?ano=${ano}`)
      .then((r) => r.json())
      .then((d) => { setMeses(d.meses || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [ano]);

  const mesesComDados = meses.filter((m) => m.entradas > 0 || m.saidas > 0);
  const saldoAtual = meses.length > 0 ? meses[meses.length - 1].saldo_acumulado : 0;
  const mediaEntradas = mesesComDados.length > 0 ? mesesComDados.reduce((s, m) => s + m.entradas, 0) / mesesComDados.length : 0;
  const mediaSaidas = mesesComDados.length > 0 ? mesesComDados.reduce((s, m) => s + m.saidas, 0) / mesesComDados.length : 0;
  const runway = mediaSaidas > 0 ? saldoAtual / mediaSaidas : Infinity;

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="text-sm bg-transparent border rounded-lg px-3 py-2">
          {[2024, 2025, 2026, 2027].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <DollarSign size={16} className="mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Saldo Acumulado</p>
            <p className={`text-xl font-bold ${saldoAtual >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrency(saldoAtual)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingUp size={16} className="mx-auto mb-1 text-green-400" />
            <p className="text-xs text-muted-foreground">Media Entradas/mes</p>
            <p className="text-xl font-bold text-green-400">{formatCurrency(mediaEntradas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingDown size={16} className="mx-auto mb-1 text-red-400" />
            <p className="text-xs text-muted-foreground">Media Saidas/mes</p>
            <p className="text-xl font-bold text-red-400">{formatCurrency(mediaSaidas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Shield size={16} className="mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Runway</p>
            <p className={`text-xl font-bold ${isFinite(runway) ? (runway >= 6 ? "text-green-400" : runway >= 3 ? "text-yellow-400" : "text-red-400") : "text-green-400"}`}>{isFinite(runway) ? `${runway.toFixed(1)} meses` : "∞"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      <FluxoCaixaChart ano={ano} />

      {/* Tabela */}
      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saidas</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Acumulado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meses.map((m) => {
                const mesNum = m.mes.split("-")[1];
                const hasData = m.entradas > 0 || m.saidas > 0;
                return (
                  <TableRow key={m.mes} className={!hasData ? "opacity-30" : ""}>
                    <TableCell className="font-medium text-sm">{MESES_LABEL[mesNum] || m.mes}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-green-400">{formatCurrency(m.entradas)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-red-400">{formatCurrency(m.saidas)}</TableCell>
                    <TableCell className={`text-right font-mono text-sm ${m.saldo >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrency(m.saldo)}</TableCell>
                    <TableCell className={`text-right font-mono text-sm font-bold ${m.saldo_acumulado >= 0 ? "" : "text-red-400"}`}>{formatCurrency(m.saldo_acumulado)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
