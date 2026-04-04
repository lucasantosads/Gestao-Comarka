"use client";
import { useEffect, useState, useMemo } from "react";

interface MetaSummary { spend: number; leads: number; cpl: number; ctr: number; frequency: number; budgetMonthly: number }
interface CrmSummary { totalLeads: number; qualifiedLeads: number; scheduledMeetings: number; completedMeetings: number; noShowCount: number; closedDeals: number; avgResponseTimeMinutes: number; taxaQualificacao: number; taxaAgendamento: number; taxaNoShow: number; taxaFechamento: number }
interface DashSummary { ticketMedio: number; metaMensalSalva: number | null; investimento: number; leadsTotais: number }

export interface Alert {
  id: string;
  categoria: "orcamento" | "criativo" | "crm" | "funil";
  severidade: "critico" | "atencao" | "ok";
  titulo: string;
  descricao: string;
}

interface ProjectionInputs {
  metaReunioes: number;
  ticketMedio: number;
  taxaFechamento: number;
}

export function useProjectionData(inputs: ProjectionInputs) {
  const [metaData, setMetaData] = useState<MetaSummary | null>(null);
  const [crmData, setCrmData] = useState<CrmSummary | null>(null);
  const [dashData, setDashData] = useState<DashSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch("/api/projections/summary")
      .then((r) => r.json())
      .then((data) => {
        setMetaData(data.meta);
        setCrmData(data.crm);
        setDashData(data.dash);
        if (data.error) setError(data.error);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setIsLoading(false));
  }, []);

  const projection = useMemo(() => {
    const taxaQualif = crmData?.taxaQualificacao ?? 0.25;
    const taxaAgend = crmData?.taxaAgendamento ?? 0.30;
    const taxaNoShow = crmData?.taxaNoShow ?? 0.20;
    const cpl = metaData?.cpl ?? 50;
    const budgetAtual = metaData?.budgetMonthly ?? dashData?.investimento ?? 0;

    const metaR = inputs.metaReunioes || 1;
    const convChain = taxaQualif * taxaAgend * (1 - taxaNoShow);

    const leadsNecessarios = convChain > 0 ? Math.ceil(metaR / convChain) : 0;
    const qualificadosNecessarios = (taxaAgend * (1 - taxaNoShow)) > 0 ? Math.ceil(metaR / (taxaAgend * (1 - taxaNoShow))) : 0;
    const agendamentosNecessarios = (1 - taxaNoShow) > 0 ? Math.ceil(metaR / (1 - taxaNoShow)) : 0;
    const budgetNecessario = leadsNecessarios * cpl;
    const budgetGap = Math.max(0, budgetNecessario - budgetAtual);
    const clientesFechados = Math.round(metaR * (1 - taxaNoShow) * inputs.taxaFechamento * 10) / 10;
    const faturamentoProjetado = clientesFechados * inputs.ticketMedio;
    const reunioesPerdidas = Math.round(metaR * taxaNoShow);

    // Com budget atual, quantos leads/reuniões consigo?
    const leadsComBudgetAtual = cpl > 0 ? Math.floor(budgetAtual / cpl) : 0;
    const reunioesComBudgetAtual = Math.floor(leadsComBudgetAtual * convChain);

    return {
      leadsNecessarios,
      qualificadosNecessarios,
      agendamentosNecessarios,
      budgetNecessario,
      budgetGap,
      clientesFechados,
      faturamentoProjetado,
      reunioesPerdidas,
      leadsComBudgetAtual,
      reunioesComBudgetAtual,
    };
  }, [inputs, metaData, crmData, dashData]);

  const alerts = useMemo(() => {
    const list: Alert[] = [];
    const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (metaData) {
      if (metaData.frequency > 5) list.push({ id: "freq-crit", categoria: "criativo", severidade: "critico", titulo: "Frequência crítica", descricao: `Frequência de ${metaData.frequency.toFixed(1)}x — audiência saturada. Rotacione criativos urgentemente.` });
      else if (metaData.frequency > 3.5) list.push({ id: "freq-attn", categoria: "criativo", severidade: "atencao", titulo: "Frequência alta", descricao: `Frequência de ${metaData.frequency.toFixed(1)}x — próximo do limite. Considere novos criativos.` });

      if (metaData.ctr < 0.8) list.push({ id: "ctr-crit", categoria: "criativo", severidade: "critico", titulo: "CTR muito baixo", descricao: `CTR de ${metaData.ctr.toFixed(2)}% — criativos não estão gerando cliques. Revise copywriting e visuais.` });
      else if (metaData.ctr < 1.2) list.push({ id: "ctr-attn", categoria: "criativo", severidade: "atencao", titulo: "CTR abaixo do ideal", descricao: `CTR de ${metaData.ctr.toFixed(2)}% — ideal acima de 1.5%. Teste novos formatos.` });

      if (metaData.cpl > 80) list.push({ id: "cpl-attn", categoria: "criativo", severidade: "atencao", titulo: "CPL elevado", descricao: `CPL de R$ ${fmt(metaData.cpl)} — acima do benchmark de R$ 70. Otimize segmentação e criativos.` });
    }

    if (crmData) {
      if (crmData.taxaNoShow > 0.4) list.push({ id: "noshow-crit", categoria: "crm", severidade: "critico", titulo: "No-show crítico", descricao: `Taxa de no-show de ${(crmData.taxaNoShow * 100).toFixed(0)}% — quase metade das reuniões são perdidas. Implemente confirmação 24h antes.` });
      else if (crmData.taxaNoShow > 0.25) list.push({ id: "noshow-attn", categoria: "crm", severidade: "atencao", titulo: "No-show alto", descricao: `Taxa de no-show de ${(crmData.taxaNoShow * 100).toFixed(0)}% — ideal abaixo de 20%.` });

      if (crmData.avgResponseTimeMinutes > 60) list.push({ id: "resp-crit", categoria: "crm", severidade: "critico", titulo: "Tempo de resposta lento", descricao: `Tempo médio de ${crmData.avgResponseTimeMinutes} minutos — leads esfriam. Ideal: < 15 minutos.` });

      if (crmData.taxaQualificacao < 0.20) list.push({ id: "qualif-attn", categoria: "funil", severidade: "atencao", titulo: "Baixa qualificação", descricao: `Apenas ${(crmData.taxaQualificacao * 100).toFixed(0)}% dos leads são qualificados — ideal acima de 25%.` });
    }

    if (projection.budgetGap > 0) {
      const budgetAtual = metaData?.budgetMonthly ?? dashData?.investimento ?? 0;
      const gapPct = budgetAtual > 0 ? (projection.budgetGap / budgetAtual) * 100 : 100;
      const sev = gapPct > 50 ? "critico" : "atencao";
      list.push({ id: "budget-gap", categoria: "orcamento", severidade: sev as "critico" | "atencao", titulo: "Orçamento insuficiente", descricao: `Orçamento atual de R$ ${fmt(budgetAtual)} gera ~${projection.leadsComBudgetAtual} leads. Para ${inputs.metaReunioes} reuniões, precisa de R$ ${fmt(projection.budgetNecessario)} (+R$ ${fmt(projection.budgetGap)}/mês).` });
    }

    // Ordenar: critico primeiro
    list.sort((a, b) => (a.severidade === "critico" ? -1 : a.severidade === "atencao" ? 0 : 1) - (b.severidade === "critico" ? -1 : b.severidade === "atencao" ? 0 : 1));

    return list;
  }, [metaData, crmData, dashData, projection, inputs]);

  return { metaData, crmData, dashData, projection, alerts, isLoading, error };
}
