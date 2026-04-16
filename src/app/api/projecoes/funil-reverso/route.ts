/**
 * POST /api/projecoes/funil-reverso
 * Cálculo de funil reverso: dado meta de contratos/MRR, calcula leads necessários.
 *
 * Body: { meta_contratos, meta_mrr, usar_taxas_manuais, noshow_rate_override, taxas_override }
 *
 * NUNCA sobrescreve taxas com flag _manual = true.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 0;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

interface FunilReversoBody {
  meta_contratos?: number;
  meta_mrr?: number;
  usar_taxas_manuais?: boolean;
  noshow_rate_override?: number;
  taxas_override?: {
    taxa_lead_para_qualificado?: number;
    taxa_qualificado_para_reuniao?: number;
    taxa_reuniao_para_proposta?: number;
    taxa_proposta_para_fechamento?: number;
    noshow_rate?: number;
  };
}

async function fetchTaxasHistoricas(meses: number) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/projecoes/taxas-historicas?meses=${meses}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Falha ao buscar taxas históricas");
  return res.json();
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const body: FunilReversoBody = await req.json();
    const { meta_contratos, meta_mrr, usar_taxas_manuais, noshow_rate_override, taxas_override } = body;

    if (!meta_contratos && !meta_mrr) {
      return NextResponse.json({ error: "meta_contratos ou meta_mrr é obrigatório" }, { status: 400 });
    }

    // Buscar taxas históricas e config
    const mesAtual = getCurrentMonth();
    const [historicasRes, { data: configAtual }, { data: lancamentos }, { data: contratos }] = await Promise.all([
      fetchTaxasHistoricas(3),
      supabase.from("config_mensal").select("*").eq("mes_referencia", mesAtual).single(),
      supabase.from("lancamentos_diarios").select("mrr_dia,ganhos").eq("mes_referencia", mesAtual),
      supabase.from("contratos").select("mrr").eq("mes_referencia", mesAtual),
    ]);

    const cfg = configAtual || {};
    const hist = historicasRes.taxas_historicas;

    // Determinar taxas a usar
    let taxas = {
      taxa_lead_para_qualificado: hist.taxa_lead_para_qualificado || 0.15,
      taxa_qualificado_para_reuniao: hist.taxa_qualificado_para_reuniao || 0.40,
      taxa_reuniao_para_proposta: hist.taxa_reuniao_para_proposta || 0.60,
      taxa_proposta_para_fechamento: hist.taxa_proposta_para_fechamento || 0.25,
      noshow_rate: hist.noshow_rate || 0.20,
    };

    // Se usar_taxas_manuais, priorizar manuais onde flag = true
    if (usar_taxas_manuais) {
      if (cfg.funil_lead_para_qualificado_manual && cfg.funil_lead_para_qualificado != null)
        taxas.taxa_lead_para_qualificado = cfg.funil_lead_para_qualificado;
      if (cfg.funil_qualificado_para_reuniao_manual && cfg.funil_qualificado_para_reuniao != null)
        taxas.taxa_qualificado_para_reuniao = cfg.funil_qualificado_para_reuniao;
      if (cfg.funil_reuniao_para_proposta_manual && cfg.funil_reuniao_para_proposta != null)
        taxas.taxa_reuniao_para_proposta = cfg.funil_reuniao_para_proposta;
      if (cfg.funil_proposta_para_fechamento_manual && cfg.funil_proposta_para_fechamento != null)
        taxas.taxa_proposta_para_fechamento = cfg.funil_proposta_para_fechamento;
      if (cfg.noshow_rate_manual && cfg.noshow_rate != null)
        taxas.noshow_rate = cfg.noshow_rate;
    }

    // taxas_override (modo simulação) sobrescreve tudo
    if (taxas_override) {
      if (taxas_override.taxa_lead_para_qualificado != null)
        taxas.taxa_lead_para_qualificado = taxas_override.taxa_lead_para_qualificado;
      if (taxas_override.taxa_qualificado_para_reuniao != null)
        taxas.taxa_qualificado_para_reuniao = taxas_override.taxa_qualificado_para_reuniao;
      if (taxas_override.taxa_reuniao_para_proposta != null)
        taxas.taxa_reuniao_para_proposta = taxas_override.taxa_reuniao_para_proposta;
      if (taxas_override.taxa_proposta_para_fechamento != null)
        taxas.taxa_proposta_para_fechamento = taxas_override.taxa_proposta_para_fechamento;
      if (taxas_override.noshow_rate != null)
        taxas.noshow_rate = taxas_override.noshow_rate;
    }

    if (noshow_rate_override != null) {
      taxas.noshow_rate = noshow_rate_override;
    }

    // CPL médio histórico
    const investimento = cfg.investimento || 0;
    const leadsTotais = cfg.leads_totais || 0;
    const cplMedio = leadsTotais > 0 ? investimento / leadsTotais : 50;

    // Orçamento atual
    const orcamentoAtual = investimento;

    // Ticket médio dos contratos do mês
    const contratosData = contratos || [];
    const ticketMedio = contratosData.length > 0
      ? contratosData.reduce((s, c) => s + Number(c.mrr || 0), 0) / contratosData.length
      : 1800;

    // Meta de contratos: explícita ou calculada via MRR
    const metaContratos = meta_contratos || (meta_mrr && ticketMedio > 0 ? Math.ceil(meta_mrr / ticketMedio) : 0);

    // Fórmulas de funil reverso
    const propostas_necessarias = taxas.taxa_proposta_para_fechamento > 0
      ? metaContratos / taxas.taxa_proposta_para_fechamento : 0;
    const reunioes_necessarias = taxas.taxa_reuniao_para_proposta > 0
      ? propostas_necessarias / taxas.taxa_reuniao_para_proposta : 0;
    const reunioes_com_noshow = (1 - taxas.noshow_rate) > 0
      ? reunioes_necessarias / (1 - taxas.noshow_rate) : reunioes_necessarias;
    const qualificados_necessarios = taxas.taxa_qualificado_para_reuniao > 0
      ? reunioes_com_noshow / taxas.taxa_qualificado_para_reuniao : 0;
    const leads_necessarios = taxas.taxa_lead_para_qualificado > 0
      ? qualificados_necessarios / taxas.taxa_lead_para_qualificado : 0;
    const investimento_necessario = Math.round(leads_necessarios * cplMedio * 100) / 100;
    const delta_orcamento = investimento_necessario - orcamentoAtual;

    // Comparativos históricos (1M, 3M, 12M)
    const comparativos: Record<string, unknown> = {};
    for (const periodo of [1, 3, 12]) {
      try {
        const compRes = await fetchTaxasHistoricas(periodo);
        comparativos[`${periodo}M`] = {
          taxas: compRes.taxas_historicas,
          volumes: compRes.volumes,
        };
      } catch {
        comparativos[`${periodo}M`] = null;
      }
    }

    // Gargalo identificado: etapa com maior perda proporcional
    const etapas = [
      { nome: "lead_para_qualificado", taxa: taxas.taxa_lead_para_qualificado, perda: 1 - taxas.taxa_lead_para_qualificado },
      { nome: "qualificado_para_reuniao", taxa: taxas.taxa_qualificado_para_reuniao, perda: 1 - taxas.taxa_qualificado_para_reuniao },
      { nome: "reuniao_para_proposta", taxa: taxas.taxa_reuniao_para_proposta, perda: 1 - taxas.taxa_reuniao_para_proposta },
      { nome: "proposta_para_fechamento", taxa: taxas.taxa_proposta_para_fechamento, perda: 1 - taxas.taxa_proposta_para_fechamento },
    ];
    const gargalo = etapas.reduce((max, e) => e.perda > max.perda ? e : max, etapas[0]);

    // Ações sugeridas baseadas no gargalo
    const acoesPorGargalo: Record<string, string[]> = {
      lead_para_qualificado: [
        "Revisar critérios de qualificação do SDR",
        "Melhorar segmentação de anúncios para atrair leads mais qualificados",
        "Implementar lead scoring automatizado",
      ],
      qualificado_para_reuniao: [
        "Reduzir tempo entre qualificação e agendamento",
        "Implementar confirmação automática 24h antes via WhatsApp",
        "Treinar SDR em técnicas de agendamento assertivo",
      ],
      reuniao_para_proposta: [
        "Revisar script de proposta comercial",
        "Treinar closers em diagnóstico de necessidades do cliente",
        "Criar proposta-modelo personalizada por nicho jurídico",
      ],
      proposta_para_fechamento: [
        "Revisar follow-up pós-proposta (ideal: 24h, 48h, 7d)",
        "Analisar objeções mais frequentes e criar rebuttals",
        "Oferecer condição especial de urgência para acelerar decisão",
      ],
    };

    const acoes_sugeridas = acoesPorGargalo[gargalo.nome] || [];

    // Impacto de redução do no-show
    const impacto_reducao_noshow = [];
    for (let reducao = 5; reducao <= 20; reducao += 5) {
      const novaNoshow = Math.max(0, taxas.noshow_rate - reducao / 100);
      const novasReunioes = (1 - novaNoshow) > 0
        ? reunioes_necessarias / (1 - novaNoshow) : reunioes_necessarias;
      const reunioesAMais = reunioes_com_noshow - novasReunioes;
      const contratosAdicionais = reunioesAMais * taxas.taxa_reuniao_para_proposta * taxas.taxa_proposta_para_fechamento;
      impacto_reducao_noshow.push({
        reducao_pct: reducao,
        noshow_resultante: novaNoshow,
        reunioes_a_mais: Math.round(reunioesAMais),
        contratos_adicionais: Math.round(contratosAdicionais * 100) / 100,
      });
    }

    return NextResponse.json({
      meta_contratos: metaContratos,
      meta_mrr: meta_mrr || metaContratos * ticketMedio,
      ticket_medio: ticketMedio,
      taxas_utilizadas: taxas,
      funil: {
        leads_necessarios: Math.ceil(leads_necessarios),
        qualificados_necessarios: Math.ceil(qualificados_necessarios),
        reunioes_com_noshow: Math.ceil(reunioes_com_noshow),
        reunioes_necessarias: Math.ceil(reunioes_necessarias),
        propostas_necessarias: Math.ceil(propostas_necessarias),
        contratos_projetados: metaContratos,
      },
      financeiro: {
        cpl_medio: cplMedio,
        investimento_necessario,
        orcamento_atual: orcamentoAtual,
        delta_orcamento,
      },
      comparativos,
      gargalo_identificado: {
        etapa: gargalo.nome,
        taxa_atual: gargalo.taxa,
        perda_pct: gargalo.perda,
      },
      acoes_sugeridas,
      impacto_reducao_noshow,
    });
  } catch (err) {
    console.error("[projecoes/funil-reverso] Erro:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
