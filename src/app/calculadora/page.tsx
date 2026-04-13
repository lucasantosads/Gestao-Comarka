"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { calcularMetaReversa, getDiasUteisDoMes, getDiasUteisAte } from "@/lib/calculos";
import { getCurrentMonth } from "@/lib/format";
import { Calculator } from "lucide-react";
import { CurrencyInput } from "@/components/currency-input";

export default function CalculadoraPage() {
  const [mrrAlvo, setMrrAlvo] = useState(50000);
  const [taxaConv, setTaxaConv] = useState(15);
  const [taxaNoShow, setTaxaNoShow] = useState(30);
  const [ticketMedio, setTicketMedio] = useState(1700);
  const [numClosers, setNumClosers] = useState(3);
  const [diasUteis, setDiasUteis] = useState(22);
  const [ritmoAtual, setRitmoAtual] = useState(0);
  const [resultado, setResultado] = useState<ReturnType<typeof calcularMetaReversa> | null>(null);
  const [melhorMrr, setMelhorMrr] = useState({ valor: 0, mes: "" });

  useEffect(() => {
    // Load historical averages
    Promise.all([
      supabase.from("lancamentos_diarios").select("*"),
      supabase.from("contratos").select("mrr, mes_referencia"),
      supabase.from("closers").select("id").eq("ativo", true),
    ]).then(([{ data: lancs }, { data: cts }, { data: cls }]) => {
      const allLanc = lancs || [];
      const allCts = cts || [];

      if (allLanc.length > 0) {
        const feitas = allLanc.reduce((s: number, l: { reunioes_feitas: number }) => s + l.reunioes_feitas, 0);
        const contratos = allLanc.reduce((s: number, l: { ganhos: number }) => s + l.ganhos, 0);
        const marcadas = allLanc.reduce((s: number, l: { reunioes_marcadas: number }) => s + l.reunioes_marcadas, 0);
        if (feitas > 0) setTaxaConv(Math.round((contratos / feitas) * 100));
        if (marcadas > 0) setTaxaNoShow(Math.round(((marcadas - feitas) / marcadas) * 100));
      }

      if (allCts.length > 0) {
        const totalMrr = allCts.reduce((s: number, c: { mrr: number }) => s + Number(c.mrr), 0);
        setTicketMedio(Math.round(totalMrr / allCts.length));

        // Best month
        const porMes: Record<string, number> = {};
        allCts.forEach((c: { mes_referencia: string; mrr: number }) => {
          porMes[c.mes_referencia] = (porMes[c.mes_referencia] || 0) + Number(c.mrr);
        });
        const best = Object.entries(porMes).sort(([, a], [, b]) => b - a)[0];
        if (best) setMelhorMrr({ valor: best[1], mes: best[0] });
      }

      setNumClosers((cls || []).length || 3);

      // Ritmo atual: contratos por dia útil no mês atual
      const mesAtual = getCurrentMonth();
      const ctsMes = allCts.filter((c: { mes_referencia: string }) => c.mes_referencia === mesAtual);
      const diasAte = getDiasUteisAte(mesAtual, new Date());
      setRitmoAtual(diasAte > 0 ? ctsMes.length / diasAte : 0);

      const diasRestantes = getDiasUteisDoMes(mesAtual) - diasAte;
      setDiasUteis(Math.max(diasRestantes, 1));
    });
  }, []);

  function calcular() {
    setResultado(calcularMetaReversa({ mrrAlvo, taxaConv, taxaNoShow, ticketMedio, diasUteis, closers: numClosers, ritmoAtual }));
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Calculadora de Meta</h1>
      <p className="text-muted-foreground">Defina o objetivo e descubra o que precisa acontecer</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Inputs */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Objetivo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Quero fechar de MRR</Label>
                <CurrencyInput value={mrrAlvo} onChange={setMrrAlvo} />
              </div>
              <div className="space-y-2"><Label>Taxa conversao (%)</Label><Input type="number" min={1} max={100} value={taxaConv} onChange={(e) => setTaxaConv(Number(e.target.value))} /></div>
              <div className="space-y-2"><Label>Taxa no show (%)</Label><Input type="number" min={0} max={100} value={taxaNoShow} onChange={(e) => setTaxaNoShow(Number(e.target.value))} /></div>
              <div className="space-y-2"><Label>Ticket medio</Label><CurrencyInput value={ticketMedio} onChange={setTicketMedio} min={1} /></div>
              <div className="space-y-2"><Label>Dias uteis restantes</Label><Input type="number" min={1} value={diasUteis} onChange={(e) => setDiasUteis(Number(e.target.value))} /></div>
              <div className="space-y-2"><Label>Closers ativos</Label><Input type="number" min={1} value={numClosers} onChange={(e) => setNumClosers(Number(e.target.value))} /></div>
              <Button onClick={calcular} className="w-full" size="lg"><Calculator size={18} className="mr-2" />Calcular</Button>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-3 space-y-4">
          {resultado ? (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">Para atingir {formatCurrency(mrrAlvo)} de MRR:</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Contratos necessarios", value: resultado.contratos },
                    { label: "Reuniões que precisam fechar", value: resultado.reunioesFeitas },
                    { label: "Reuniões que precisam marcar", value: `${resultado.reunioesMarcadas} (+${taxaNoShow}% no show)` },
                    { label: "Leads necessarios", value: resultado.leadsNecessarios },
                  ].map((r) => (
                    <div key={r.label} className="flex justify-between p-3 bg-muted rounded-lg">
                      <span className="text-sm text-muted-foreground">{r.label}</span>
                      <span className="font-bold text-lg">{r.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Por closer (÷ {numClosers})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Contratos/closer</span><span className="font-bold">{resultado.contratosPerCloser.toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Reunioes feitas/closer</span><span className="font-bold">{resultado.reunioesPerCloser.toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Contratos/dia util</span><span className="font-bold">{resultado.contratosPerDia.toFixed(1)}/dia</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Reunioes/dia util</span><span className="font-bold">{resultado.reunioesPerDia.toFixed(1)}/dia</span></div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  {resultado.viabilidade === "viavel" && (
                    <><Badge className="bg-green-500/20 text-green-500 text-lg px-4 py-1 mb-2">Viavel</Badge><p className="text-sm text-muted-foreground">Ritmo atual compativel com a meta</p></>
                  )}
                  {resultado.viabilidade === "desafiador" && (
                    <><Badge className="bg-yellow-500/20 text-yellow-500 text-lg px-4 py-1 mb-2">Desafiador</Badge><p className="text-sm text-muted-foreground">Necessario aumentar {resultado.deltaRitmo.toFixed(0)}% o volume</p></>
                  )}
                  {resultado.viabilidade === "fora_do_alcance" && (
                    <><Badge className="bg-red-500/20 text-red-500 text-lg px-4 py-1 mb-2">Fora do alcance</Badge><p className="text-sm text-muted-foreground">Necessario +1 closer ou dobrar leads</p></>
                  )}
                  {melhorMrr.valor > 0 && (
                    <p className="text-xs text-muted-foreground mt-3">Melhor resultado historico: {formatCurrency(melhorMrr.valor)} ({melhorMrr.mes})</p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card><CardContent className="p-12 text-center text-muted-foreground">Preencha os parametros e clique em Calcular</CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}
