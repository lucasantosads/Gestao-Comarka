"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { CustosFixosTable } from "@/components/financeiro/CustosFixosTable";
import { LancarDespesaModal } from "@/components/financeiro/LancarDespesaModal";
import { Users, Building, CreditCard, DollarSign, AlertTriangle } from "lucide-react";

interface CustosData {
  folha: { total: number };
  fixos: { total: number };
  parcelamentos: { itens: { nome: string; parcelas_restantes: number | null }[]; total: number };
  total_geral: number;
}

export default function CustosFixosPage() {
  const [data, setData] = useState<CustosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch("/api/financeiro/custos-fixos")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [key]);

  const parcelamentosUrgentes = data?.parcelamentos.itens.filter((p) => p.parcelas_restantes !== null && p.parcelas_restantes <= 2) || [];

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Custos Fixos e Parcelamentos</h1>
        <LancarDespesaModal onSaved={() => setKey((k) => k + 1)} />
      </div>

      {/* Alerta parcelamentos */}
      {parcelamentosUrgentes.length > 0 && (
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-400 flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{parcelamentosUrgentes.length} parcelamento{parcelamentosUrgentes.length > 1 ? "s" : ""} com menos de 2 parcelas restantes: {parcelamentosUrgentes.map((p) => p.nome).join(", ")}</span>
        </div>
      )}

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Users size={16} className="mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Folha</p>
              <p className="text-xl font-bold">{formatCurrency(data.folha.total)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Building size={16} className="mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Fixos</p>
              <p className="text-xl font-bold">{formatCurrency(data.fixos.total)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <CreditCard size={16} className="mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Parcelamentos</p>
              <p className="text-xl font-bold">{formatCurrency(data.parcelamentos.total)}</p>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="pt-4 pb-3 text-center">
              <DollarSign size={16} className="mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">Total Mensal</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(data.total_geral)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela detalhada */}
      <CustosFixosTable key={key} />
    </div>
  );
}
