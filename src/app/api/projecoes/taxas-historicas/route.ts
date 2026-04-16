/**
 * GET /api/projecoes/taxas-historicas
 * Calcula taxas reais do funil com base em leads_crm e lancamentos_diarios.
 * Param: meses (1 | 3 | 6 | 12, default 3)
 *
 * Retorna taxas calculadas + taxas manuais de config_mensal + flag de qual está ativa.
 * NUNCA sobrescreve taxas com flag _manual = true.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthsRange(meses: number): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = 1; i <= meses; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

export async function GET(req: NextRequest) {
  try {
    const mesesParam = req.nextUrl.searchParams.get("meses");
    const meses = [1, 3, 6, 12].includes(Number(mesesParam)) ? Number(mesesParam) : 3;
    const months = getMonthsRange(meses);
    const mesAtual = getCurrentMonth();

    // Buscar dados em paralelo
    const [
      { data: leads },
      { data: lancamentos },
      { data: configAtual },
    ] = await Promise.all([
      supabase
        .from("leads_crm")
        .select("id,etapa,mes_referencia,data_reuniao_agendada,data_proposta_enviada,data_comprou,data_assinatura")
        .in("mes_referencia", months),
      supabase
        .from("lancamentos_diarios")
        .select("mes_referencia,reunioes_marcadas,reunioes_feitas,ganhos")
        .in("mes_referencia", months),
      supabase
        .from("config_mensal")
        .select("*")
        .eq("mes_referencia", mesAtual)
        .single(),
    ]);

    const allLeads = leads || [];
    const allLanc = lancamentos || [];

    // Totais por período
    const totalLeads = allLeads.length;

    // Qualificados: leads que saíram de oportunidade/lead_qualificado
    const qualificados = allLeads.filter((l) =>
      !["oportunidade", "lead_qualificado", "desqualificado", "desistiu"].includes(l.etapa)
    ).length;

    // Reuniões agendadas (leads com data_reuniao_agendada)
    const reunioesAgendadas = allLeads.filter((l) => l.data_reuniao_agendada).length;

    // Reuniões feitas (de lancamentos_diarios)
    const reunioesFeitas = allLanc.reduce((s, l) => s + (l.reunioes_feitas || 0), 0);

    // Propostas enviadas
    const propostas = allLeads.filter((l) => l.data_proposta_enviada).length;

    // Contratos fechados
    const contratosFechados = allLeads.filter((l) =>
      l.etapa === "comprou" || l.etapa === "assinatura_contrato"
    ).length;
    // Fallback de ganhos de lancamentos
    const ganhosLanc = allLanc.reduce((s, l) => s + (l.ganhos || 0), 0);
    const contratos = Math.max(contratosFechados, ganhosLanc);

    // No-show: reuniões marcadas - feitas
    const reunioesMarcadas = allLanc.reduce((s, l) => s + (l.reunioes_marcadas || 0), 0);
    const noShowCount = reunioesMarcadas - reunioesFeitas;

    // Calcular taxas
    const safe = (n: number, d: number) => (d > 0 ? n / d : 0);

    const taxas_historicas = {
      taxa_lead_para_qualificado: safe(qualificados, totalLeads),
      taxa_qualificado_para_reuniao: safe(reunioesFeitas, qualificados),
      taxa_reuniao_para_proposta: safe(propostas, reunioesFeitas),
      taxa_proposta_para_fechamento: safe(contratos, propostas),
      noshow_rate: safe(noShowCount, reunioesMarcadas),
      tempo_medio_ciclo_total: 0, // Sem tabela leads_ciclo_etapas, não calculável
    };

    // Taxas manuais de config_mensal
    const cfg = configAtual || {};
    const taxas_manuais = {
      taxa_lead_para_qualificado: cfg.funil_lead_para_qualificado ?? null,
      taxa_qualificado_para_reuniao: cfg.funil_qualificado_para_reuniao ?? null,
      taxa_reuniao_para_proposta: cfg.funil_reuniao_para_proposta ?? null,
      taxa_proposta_para_fechamento: cfg.funil_proposta_para_fechamento ?? null,
      noshow_rate: cfg.noshow_rate ?? null,
    };

    const flags_manual = {
      taxa_lead_para_qualificado: cfg.funil_lead_para_qualificado_manual === true,
      taxa_qualificado_para_reuniao: cfg.funil_qualificado_para_reuniao_manual === true,
      taxa_reuniao_para_proposta: cfg.funil_reuniao_para_proposta_manual === true,
      taxa_proposta_para_fechamento: cfg.funil_proposta_para_fechamento_manual === true,
      noshow_rate: cfg.noshow_rate_manual === true,
    };

    // Taxas ativas: manual se flag = true E valor existe, senão histórico
    const taxas_ativas: Record<string, { valor: number; fonte: "manual" | "historico" }> = {};
    for (const key of Object.keys(taxas_historicas) as (keyof typeof taxas_historicas)[]) {
      if (key === "tempo_medio_ciclo_total") continue;
      const manualKey = key as keyof typeof flags_manual;
      if (flags_manual[manualKey] && taxas_manuais[manualKey] !== null) {
        taxas_ativas[key] = { valor: taxas_manuais[manualKey] as number, fonte: "manual" };
      } else {
        taxas_ativas[key] = { valor: taxas_historicas[key], fonte: "historico" };
      }
    }

    // Volumes brutos para contexto
    const volumes = {
      total_leads: totalLeads,
      qualificados,
      reunioes_agendadas: reunioesMarcadas,
      reunioes_feitas: reunioesFeitas,
      propostas,
      contratos,
      noshow: noShowCount,
      periodo_meses: meses,
    };

    return NextResponse.json({
      taxas_historicas,
      taxas_manuais,
      flags_manual,
      taxas_ativas,
      volumes,
      meta_mrr: cfg.meta_mrr ?? null,
      meta_mrr_manual: cfg.meta_mrr_manual === true,
      meta_contratos: cfg.meta_contratos ?? null,
      meta_contratos_manual: cfg.meta_contratos_manual === true,
    });
  } catch (err) {
    console.error("[projecoes/taxas-historicas] Erro:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
