"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { Wallet, TrendingUp, Award, Gift, Target } from "lucide-react";

interface CompResult {
  salario_base: number;
  comissao_calculada: number;
  comissao_detalhes: { base_nome: string; base_valor: number; percentual: number };
  bonus: number;
  beneficios: number;
  beneficios_detalhes: { va: number; vt: number; outros: number; descricao: string | null };
  total_bruto: number;
  ote: number;
  ote_pct: number;
  meta_atingida: boolean;
  meta_pct: number;
  contratos: number;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function SalarioPage() {
  const { user } = useAuth();
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [comp, setComp] = useState<CompResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [noConfig, setNoConfig] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setNoConfig(false);
    fetch(`/api/compensation/calculate?mes=${mes}`)
      .then((r) => {
        if (r.status === 404) { setNoConfig(true); setComp(null); return null; }
        return r.json();
      })
      .then((data) => { if (data && !data.error) setComp(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, mes]);

  if (loading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Salario e Comissao</h1>
        <div className="flex bg-muted rounded-lg p-0.5">
          {MESES.map((label, i) => {
            const m = `2026-${String(i + 1).padStart(2, "0")}`;
            return (
              <button key={m} onClick={() => setMes(m)}
                className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${mes === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {noConfig && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <Wallet size={32} className="mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Compensacao nao configurada para {MESES[parseInt(mes.slice(5)) - 1]}</p>
            <p className="text-xs text-muted-foreground">Solicite ao administrador para configurar seu salario, comissao e beneficios.</p>
          </CardContent>
        </Card>
      )}

      {comp && (
        <>
          {/* OTE Progress */}
          {comp.ote > 0 && (
            <Card className="border-green-500/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Target size={12} /> OTE (On-Target Earnings)</p>
                  <span className="text-xs font-mono">{formatCurrency(comp.total_bruto)} / {formatCurrency(comp.ote)}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div className={`h-3 rounded-full transition-all ${comp.ote_pct >= 100 ? "bg-green-400" : comp.ote_pct >= 70 ? "bg-yellow-400" : "bg-red-400"}`}
                    style={{ width: `${Math.min(comp.ote_pct, 100)}%` }} />
                </div>
                <p className="text-right text-[10px] text-muted-foreground mt-1">{comp.ote_pct.toFixed(0)}%</p>
              </CardContent>
            </Card>
          )}

          {/* Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground">Salario Base</p>
                <p className="text-lg font-bold">{formatCurrency(comp.salario_base)}</p>
              </CardContent>
            </Card>
            <Card className="border-green-500/20">
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingUp size={10} /> Comissao</p>
                <p className="text-lg font-bold text-green-400">{formatCurrency(comp.comissao_calculada)}</p>
                <p className="text-[9px] text-muted-foreground">{comp.comissao_detalhes.percentual}% s/ {comp.comissao_detalhes.base_nome}</p>
              </CardContent>
            </Card>
            <Card className={comp.bonus > 0 ? "border-yellow-500/20" : ""}>
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Award size={10} /> Bonus</p>
                <p className="text-lg font-bold text-yellow-400">{formatCurrency(comp.bonus)}</p>
                {comp.meta_atingida && <Badge className="text-[8px] bg-green-500/15 text-green-400">Meta atingida</Badge>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-2">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Gift size={10} /> Beneficios</p>
                <p className="text-lg font-bold">{formatCurrency(comp.beneficios)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Total */}
          <Card className="border-foreground/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Total Bruto</p>
                <p className="text-2xl font-bold">{formatCurrency(comp.total_bruto)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Detalhes */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Detalhamento</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b"><span>Salario Base</span><span className="font-mono">{formatCurrency(comp.salario_base)}</span></div>
                <div className="flex justify-between py-1 border-b">
                  <span>Comissao ({comp.comissao_detalhes.percentual}% de {formatCurrency(comp.comissao_detalhes.base_valor)} {comp.comissao_detalhes.base_nome})</span>
                  <span className="font-mono text-green-400">{formatCurrency(comp.comissao_calculada)}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span>Contratos no mes</span><span className="font-mono">{comp.contratos}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span>Meta atingida ({comp.meta_pct.toFixed(0)}%)</span>
                  <span>{comp.meta_atingida ? "Sim" : "Nao"}</span>
                </div>
                <div className="flex justify-between py-1 border-b"><span>Bonus</span><span className="font-mono text-yellow-400">{formatCurrency(comp.bonus)}</span></div>
                {comp.beneficios_detalhes.va > 0 && <div className="flex justify-between py-1 border-b"><span>Vale Alimentacao</span><span className="font-mono">{formatCurrency(comp.beneficios_detalhes.va)}</span></div>}
                {comp.beneficios_detalhes.vt > 0 && <div className="flex justify-between py-1 border-b"><span>Vale Transporte</span><span className="font-mono">{formatCurrency(comp.beneficios_detalhes.vt)}</span></div>}
                {comp.beneficios_detalhes.outros > 0 && <div className="flex justify-between py-1 border-b"><span>Outros Beneficios {comp.beneficios_detalhes.descricao ? `(${comp.beneficios_detalhes.descricao})` : ""}</span><span className="font-mono">{formatCurrency(comp.beneficios_detalhes.outros)}</span></div>}
                <div className="flex justify-between py-2 font-bold text-sm"><span>TOTAL BRUTO</span><span className="font-mono">{formatCurrency(comp.total_bruto)}</span></div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
