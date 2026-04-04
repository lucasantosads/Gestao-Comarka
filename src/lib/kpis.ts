import type { LancamentoDiario, ConfigMensal, Contrato, LeadCrm } from "@/types/database";

export interface KpiData {
  leads: number;
  investimento: number;
  reunioesAgendadas: number;
  reunioesFeitas: number;
  noShow: number;
  percentNoShow: number;
  contratosGanhos: number;
  ltvTotal: number;
  mrrTotal: number;
  comissoesTotal: number;
  custoLead: number;
  percentLeadsReuniao: number;
  custoReuniaoFeita: number;
  percentLeadsContrato: number;
  cacMarketing: number;
  cacAproximado: number;
  ticketMedio: number;
  roas: number;
  resultadoTime: number;
}

export function calcKpis(
  lancamentos: LancamentoDiario[],
  config: ConfigMensal | null,
  opts?: { contratos?: Contrato[]; crmLeads?: LeadCrm[] }
): KpiData {
  const leads = config?.leads_totais ?? 0;
  const investimento = Number(config?.investimento ?? 0);

  const reunioesAgendadas = lancamentos.reduce((s, l) => s + l.reunioes_marcadas, 0);
  const reunioesFeitas = lancamentos.reduce((s, l) => s + l.reunioes_feitas, 0);
  const noShow = reunioesAgendadas - reunioesFeitas;
  const contratosGanhos = lancamentos.reduce((s, l) => s + l.ganhos, 0);
  const mrrTotal = lancamentos.reduce((s, l) => s + Number(l.mrr_dia), 0);
  const comprouLeads = opts?.crmLeads?.filter((l) => l.etapa === "comprou");
  const ltvTotal = comprouLeads && comprouLeads.length > 0
    ? comprouLeads.reduce((s, l) => s + Number(l.valor_total_projeto || 0), 0)
    : opts?.contratos
      ? opts.contratos.reduce((s, c) => s + Number(c.valor_total_projeto), 0)
      : lancamentos.reduce((s, l) => s + Number(l.ltv), 0);
  const comissoesTotal = mrrTotal * 0.1;

  const safe = (n: number, d: number) => (d > 0 ? n / d : 0);

  return {
    leads,
    investimento,
    reunioesAgendadas,
    reunioesFeitas,
    noShow,
    percentNoShow: safe(noShow, reunioesAgendadas) * 100,
    contratosGanhos,
    ltvTotal,
    mrrTotal,
    comissoesTotal,
    custoLead: safe(investimento, leads),
    percentLeadsReuniao: safe(reunioesFeitas, leads) * 100,
    custoReuniaoFeita: safe(investimento, reunioesFeitas),
    percentLeadsContrato: safe(contratosGanhos, leads) * 100,
    cacMarketing: safe(investimento, contratosGanhos),
    cacAproximado: safe(investimento + comissoesTotal, contratosGanhos),
    ticketMedio: safe(mrrTotal, contratosGanhos),
    roas: safe(mrrTotal, investimento),
    resultadoTime: mrrTotal - (comissoesTotal + investimento),
  };
}

export function trend(current: number, previous: number): "up" | "down" | "neutral" {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "neutral";
}
