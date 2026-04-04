"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/format";

interface BonusData {
  nome: string;
  nivel: string;
  salarioFixo: number;
  mrr: number;
  contratos: number;
  reunioesFeitas: number;
  metaContratos: number;
  metaConvReuniao: number;
  metaConvMql: number;
  metaTicket: number;
  metaSetorBatida: boolean;
  metaIndBatida: boolean;
  ticketMedio: number;
  diasPassados: number;
  diasTotais: number;
}

export function calcBonus(d: BonusData) {
  const comissaoBase = d.mrr * 0.10;
  const taxaConvReuniao = d.reunioesFeitas > 0 ? (d.contratos / d.reunioesFeitas) * 100 : 0;
  const bonusReuniaoRate = d.nivel === "senior" ? 0.03 : d.nivel === "pleno" ? 0.025 : 0.02;
  const bonusReuniao = taxaConvReuniao >= d.metaConvReuniao ? d.mrr * bonusReuniaoRate : 0;
  const bonusTMRate = d.nivel === "senior" ? 0.025 : d.nivel === "pleno" ? 0.02 : 0.015;
  const bonusTM = d.ticketMedio >= d.metaTicket ? d.mrr * bonusTMRate : 0;
  const bonusSetorRate = d.nivel === "senior" ? 0.035 : d.nivel === "pleno" ? 0.03 : 0.025;
  const bonusSetor = d.metaSetorBatida && d.metaIndBatida ? d.mrr * bonusSetorRate : 0;
  const total = comissaoBase + bonusReuniao + bonusTM + bonusSetor;
  const projecao = d.diasPassados > 0 ? total / (d.diasPassados / d.diasTotais) : total;

  return {
    comissaoBase,
    bonusReuniao, bonusReuniaoOk: taxaConvReuniao >= d.metaConvReuniao, taxaConvReuniao,
    bonusTM, bonusTMOk: d.ticketMedio >= d.metaTicket,
    bonusSetor, bonusSetorOk: d.metaSetorBatida && d.metaIndBatida,
    total, projecao,
  };
}

export function BonusCard({ data }: { data: BonusData }) {
  const b = calcBonus(data);
  const nivelLabel = data.nivel === "senior" ? "Senior" : data.nivel === "pleno" ? "Pleno" : "Junior";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{data.nome}</CardTitle>
          <Badge variant="outline">{nivelLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {data.salarioFixo > 0 && <div className="flex justify-between text-muted-foreground"><span>Salario fixo</span><span>{formatCurrency(data.salarioFixo)}</span></div>}
        <div className="flex justify-between"><span>Comissao base (10%)</span><span className="font-medium">{formatCurrency(b.comissaoBase)}</span></div>
        <div className="flex justify-between items-center">
          <span>Bonus Reuniao {b.bonusReuniaoOk ? "✅" : "❌"}</span>
          <span className="font-medium">{formatCurrency(b.bonusReuniao)}</span>
        </div>
        <div className="text-xs text-muted-foreground ml-4">Conv: {formatPercent(b.taxaConvReuniao)} (meta: {formatPercent(data.metaConvReuniao)})</div>
        <div className="flex justify-between items-center">
          <span>Bonus Ticket Medio {b.bonusTMOk ? "✅" : "❌"}</span>
          <span className="font-medium">{formatCurrency(b.bonusTM)}</span>
        </div>
        <div className="text-xs text-muted-foreground ml-4">TM: {formatCurrency(data.ticketMedio)} (meta: {formatCurrency(data.metaTicket)})</div>
        <div className="flex justify-between items-center">
          <span>Bonus Setor {b.bonusSetorOk ? "✅" : "⏳"}</span>
          <span className="font-medium">{formatCurrency(b.bonusSetor)}</span>
        </div>
        <div className="border-t pt-2 flex justify-between font-bold">
          <span>TOTAL ESTIMADO</span><span className="text-green-500">{formatCurrency(b.total)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Projecao fim do mes</span><span>{formatCurrency(b.projecao)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
