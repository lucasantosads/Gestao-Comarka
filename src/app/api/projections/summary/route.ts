/**
 * GET /api/projections/summary
 * Agrega dados do Meta Ads + CRM (Supabase) + Dashboard em um único response.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { metaFetchPaginated } from "@/lib/meta-fetch";

export const revalidate = 60; // KPI aggregation

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function fetchMetaSummary() {
  const now = new Date();
  const since = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const until = now.toISOString().split("T")[0];

  const result = await metaFetchPaginated<Record<string, unknown>>({
    endpoint: "insights",
    fields: "spend,impressions,clicks,actions,ctr,frequency",
    params: { level: "account" },
    since,
    until,
    // No status filter — capture spend from all campaigns (active + paused)
  });

  if (result.error || result.data.length === 0) return null;

  let totalSpend = 0;
  let totalLeads = 0;
  let totalCtr = 0;
  let totalFreq = 0;
  let count = 0;

  for (const row of result.data) {
    totalSpend += parseFloat(String(row.spend || "0"));
    const actions = row.actions as { action_type: string; value: string }[] | undefined;
    if (actions) {
      for (const a of actions) {
        if (["lead", "onsite_conversion.messaging_first_reply", "onsite_conversion.lead_grouped"].includes(a.action_type)) {
          totalLeads += parseInt(a.value);
        }
      }
    }
    totalCtr += parseFloat(String(row.ctr || "0"));
    totalFreq += parseFloat(String(row.frequency || "0"));
    count++;
  }

  return {
    spend: totalSpend,
    leads: totalLeads,
    cpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
    ctr: count > 0 ? totalCtr / count : 0,
    frequency: count > 0 ? totalFreq / count : 0,
    budgetMonthly: totalSpend,
  };
}

async function fetchCrmSummary() {
  const mes = getCurrentMonth();

  const [{ data: leads }, { data: lancamentos }] = await Promise.all([
    supabase.from("leads_crm").select("etapa").eq("mes_referencia", mes),
    supabase.from("lancamentos_diarios").select("reunioes_marcadas,reunioes_feitas,ganhos").eq("mes_referencia", mes),
  ]);

  if (!leads) return null;

  const totalLeads = leads.length;
  const qualified = leads.filter((l) => !["oportunidade", "lead_qualificado"].includes(l.etapa)).length;
  const closedDeals = leads.filter((l) => l.etapa === "comprou").length;

  const marcadas = (lancamentos || []).reduce((s: number, l: { reunioes_marcadas: number }) => s + l.reunioes_marcadas, 0);
  const feitas = (lancamentos || []).reduce((s: number, l: { reunioes_feitas: number }) => s + l.reunioes_feitas, 0);
  const noShow = marcadas - feitas;
  const ganhos = (lancamentos || []).reduce((s: number, l: { ganhos: number }) => s + l.ganhos, 0);

  const safe = (n: number, d: number) => d > 0 ? n / d : 0;

  return {
    totalLeads,
    qualifiedLeads: qualified,
    scheduledMeetings: marcadas,
    completedMeetings: feitas,
    noShowCount: noShow,
    closedDeals: ganhos || closedDeals,
    avgResponseTimeMinutes: 0,
    taxaQualificacao: safe(qualified, totalLeads),
    taxaAgendamento: safe(marcadas, totalLeads),
    taxaNoShow: safe(noShow, marcadas),
    taxaFechamento: safe(ganhos || closedDeals, feitas),
  };
}

async function fetchDashSummary() {
  const mes = getCurrentMonth();
  const now = new Date();
  const until = now.toISOString().split("T")[0];

  const [{ data: config }, { data: lancamentos }, { data: adsPerf }] = await Promise.all([
    supabase.from("config_mensal").select("leads_totais,investimento").eq("mes_referencia", mes).single(),
    supabase.from("lancamentos_diarios").select("mrr_dia,ganhos").eq("mes_referencia", mes),
    supabase.from("ads_performance").select("spend,leads").gte("data_ref", mes + "-01").lte("data_ref", until),
  ]);

  const mrr = (lancamentos || []).reduce((s: number, l: { mrr_dia: number }) => s + Number(l.mrr_dia), 0);
  const ganhos = (lancamentos || []).reduce((s: number, l: { ganhos: number }) => s + l.ganhos, 0);
  const ticketMedio = ganhos > 0 ? mrr / ganhos : 0;

  // Use Meta Ads real spend/leads when available
  const metaSpend = (adsPerf || []).reduce((s: number, r: { spend: number }) => s + Number(r.spend), 0);
  const metaLeads = (adsPerf || []).reduce((s: number, r: { leads: number }) => s + Number(r.leads), 0);

  return {
    ticketMedio,
    metaMensalSalva: null,
    investimento: metaSpend > 0 ? metaSpend : Number(config?.investimento ?? 0),
    leadsTotais: metaLeads > 0 ? metaLeads : (config?.leads_totais ?? 0),
  };
}

async function fetchHistorico(mesesAtras: number) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - mesesAtras, 1);
  const mes = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  // Last day of that month
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0);
  const until = `${mes}-${String(lastDay.getDate()).padStart(2, "0")}`;

  const [{ data: config }, { data: lancamentos }, { data: leads }, { data: adsPerf }] = await Promise.all([
    supabase.from("config_mensal").select("leads_totais,investimento").eq("mes_referencia", mes).single(),
    supabase.from("lancamentos_diarios").select("reunioes_marcadas,reunioes_feitas,ganhos,mrr_dia,ltv").eq("mes_referencia", mes),
    supabase.from("leads_crm").select("etapa,valor_total_projeto").eq("mes_referencia", mes),
    supabase.from("ads_performance").select("spend,leads").gte("data_ref", mes + "-01").lte("data_ref", until),
  ]);

  const lanc = lancamentos || [];
  const lds = leads || [];
  const marcadas = lanc.reduce((s: number, l: { reunioes_marcadas: number }) => s + l.reunioes_marcadas, 0);
  const feitas = lanc.reduce((s: number, l: { reunioes_feitas: number }) => s + l.reunioes_feitas, 0);
  const ganhos = lanc.reduce((s: number, l: { ganhos: number }) => s + l.ganhos, 0);
  const mrr = lanc.reduce((s: number, l: { mrr_dia: number }) => s + Number(l.mrr_dia), 0);
  const ltv = lds.filter((l) => l.etapa === "comprou").reduce((s: number, l: { valor_total_projeto: number }) => s + Number(l.valor_total_projeto || 0), 0);

  // Use Meta Ads data when available, fallback to config_mensal
  const metaSpend = (adsPerf || []).reduce((s: number, r: { spend: number }) => s + Number(r.spend), 0);
  const metaLeads = (adsPerf || []).reduce((s: number, r: { leads: number }) => s + Number(r.leads), 0);
  const totalLeads = metaLeads > 0 ? metaLeads : (config?.leads_totais ?? lds.length);
  const investimento = metaSpend > 0 ? metaSpend : Number(config?.investimento ?? 0);
  const safe = (n: number, d: number) => d > 0 ? n / d : 0;

  return {
    mes,
    leads: totalLeads,
    investimento,
    reunioesAgendadas: marcadas,
    reunioesFeitas: feitas,
    noShow: marcadas - feitas,
    contratos: ganhos,
    mrr,
    ltv,
    ticketMedio: ganhos > 0 ? mrr / ganhos : 0,
    cpl: safe(investimento, totalLeads),
    taxaNoShow: safe(marcadas - feitas, marcadas),
    taxaFechamento: safe(ganhos, feitas),
    taxaLeadReuniao: safe(feitas, totalLeads),
  };
}

export async function GET() {
  try {
    // Fetch 12 months of history + current data in parallel
    const histPromises = Array.from({ length: 12 }, (_, i) => fetchHistorico(i + 1).catch(() => null));

    const [metaData, crmData, dashData, ...histResults] = await Promise.all([
      fetchMetaSummary().catch(() => null),
      fetchCrmSummary().catch(() => null),
      fetchDashSummary().catch(() => null),
      ...histPromises,
    ]);

    return NextResponse.json({
      meta: metaData,
      crm: crmData,
      dash: dashData,
      // Array of 12 months (index 0 = last month, index 11 = 12 months ago)
      meses: histResults,
      // Backwards compat
      historico: {
        mesAnterior: histResults[0],
        mes2: histResults[1],
        mes3: histResults[2],
      },
    });
  } catch (err) {
    console.error("[projections/summary] Erro:", err);
    return NextResponse.json({ meta: null, crm: null, dash: null, meses: [], historico: null, error: String(err) }, { status: 500 });
  }
}
