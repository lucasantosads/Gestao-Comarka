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
  entradaTotal: number;
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
  opts?: { contratos?: Contrato[]; crmLeads?: LeadCrm[]; metaSpend?: number; metaLeads?: number }
): KpiData {
  // Leads: CRM a partir de abril/2026, config_mensal para meses anteriores, Meta como último fallback
  const mesRef = config?.mes_referencia || "";
  const usarCrm = mesRef >= "2026-04" && opts?.crmLeads?.length;
  const leads = usarCrm ? opts!.crmLeads!.length : (config?.leads_totais || opts?.metaLeads || 0);
  const investimento = opts?.metaSpend != null ? opts.metaSpend : Number(config?.investimento ?? 0);

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
  const entradaTotal = comprouLeads && comprouLeads.length > 0
    ? comprouLeads.reduce((s, l) => s + Number(l.valor_entrada || 0), 0)
    : opts?.contratos
      ? opts.contratos.reduce((s, c) => s + Number(c.valor_entrada || 0), 0)
      : 0;
  // Caixa real que entrou no mês pelos contratos novos, respeitando o flag
  // entrada_e_primeiro_mes. Quando true, não soma MRR + entrada (duplicaria o
  // primeiro mês). Quando false, soma os dois. Fallback para contratos antigos
  // sem o flag: assume entrada_e_primeiro_mes=true (default seguro).
  const caixaContratosNovos = opts?.contratos
    ? opts.contratos.reduce((s, c) => {
        const ent = Number(c.valor_entrada || 0);
        const mrr = Number(c.mrr || 0);
        const primeiro = (c as Contrato).entrada_e_primeiro_mes ?? true;
        return s + (primeiro ? Math.max(ent, mrr) : ent + mrr);
      }, 0)
    : mrrTotal + entradaTotal;
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
    entradaTotal,
    comissoesTotal,
    custoLead: safe(investimento, leads),
    percentLeadsReuniao: safe(reunioesFeitas, leads) * 100,
    custoReuniaoFeita: safe(investimento, reunioesFeitas),
    percentLeadsContrato: safe(contratosGanhos, leads) * 100,
    cacMarketing: safe(investimento, contratosGanhos),
    cacAproximado: safe(investimento + comissoesTotal, contratosGanhos),
    ticketMedio: safe(mrrTotal, contratosGanhos),
    roas: safe(ltvTotal, investimento),
    resultadoTime: caixaContratosNovos - (comissoesTotal + investimento),
  };
}

export function trend(current: number, previous: number): "up" | "down" | "neutral" {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "neutral";
}
