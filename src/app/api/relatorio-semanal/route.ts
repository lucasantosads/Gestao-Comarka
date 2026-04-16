import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60; // KPI aggregation

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dataInicio = searchParams.get("data_inicio");
  const dataFim = searchParams.get("data_fim");

  if (!dataInicio || !dataFim) {
    return NextResponse.json({ error: "data_inicio e data_fim são obrigatórios" }, { status: 400 });
  }

  // Período anterior (mesma duração)
  const inicio = new Date(dataInicio + "T00:00:00");
  const fim = new Date(dataFim + "T23:59:59");
  const dias = Math.ceil((fim.getTime() - inicio.getTime()) / 86400000);
  const prevFim = new Date(inicio);
  prevFim.setDate(prevFim.getDate() - 1);
  const prevInicio = new Date(prevFim);
  prevInicio.setDate(prevInicio.getDate() - dias);
  const prevInicioStr = prevInicio.toISOString().split("T")[0];
  const prevFimStr = prevFim.toISOString().split("T")[0];

  // Buscar dados
  const [{ data: perf }, { data: prevPerf }, { data: leads }, { data: prevLeads }, { data: meta }] = await Promise.all([
    supabase.from("ads_performance").select("*").gte("data_ref", dataInicio).lte("data_ref", dataFim).limit(365),
    supabase.from("ads_performance").select("*").gte("data_ref", prevInicioStr).lte("data_ref", prevFimStr).limit(365),
    supabase.from("leads_ads_attribution").select("*").gte("created_at", dataInicio + "T00:00:00").lte("created_at", dataFim + "T23:59:59").limit(1000),
    supabase.from("leads_ads_attribution").select("*").gte("created_at", prevInicioStr + "T00:00:00").lte("created_at", prevFimStr + "T23:59:59").limit(1000),
    supabase.from("ads_metadata").select("*"),
  ]);

  const perfData = perf || [];
  const prevPerfData = prevPerf || [];
  const leadsData = leads || [];
  const prevLeadsData = prevLeads || [];
  const metaData = meta || [];

  function calcMetrics(p: typeof perfData, l: typeof leadsData) {
    const spend = p.reduce((s, r) => s + Number(r.spend), 0);
    const metaLeads = p.reduce((s, r) => s + r.leads, 0);
    const crmLeads = l.length;
    const totalLeads = crmLeads > 0 ? crmLeads : metaLeads;
    const qualificados = l.filter((r) => !["novo", "oportunidade"].includes(r.estagio_crm)).length;
    const reunioes = l.filter((r) => ["reuniao_agendada", "proposta_enviada", "assinatura_contrato", "comprou", "fechado"].includes(r.estagio_crm)).length;
    const fechamentos = l.filter((r) => r.estagio_crm === "comprou" || r.estagio_crm === "fechado").length;
    const receita = l.reduce((s, r) => s + Number(r.receita_gerada || 0), 0);
    const cpl = totalLeads > 0 ? spend / totalLeads : 0;
    const taxaQualificacao = totalLeads > 0 ? (qualificados / totalLeads) * 100 : 0;
    const roas = spend > 0 ? receita / spend : 0;
    return { investimento_total: spend, total_leads: totalLeads, meta_leads: metaLeads, crm_leads: crmLeads, cpl_medio: cpl, leads_qualificados: qualificados, taxa_qualificacao: taxaQualificacao, reunioes_realizadas: reunioes, fechamentos, receita_gerada: receita, roas };
  }

  const atual = calcMetrics(perfData, leadsData);
  const anterior = calcMetrics(prevPerfData, prevLeadsData);

  const delta = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : 0;

  // Top 3 anúncios por leads
  const adMap = new Map<string, { nome: string; leads: number; cpl: number; spend: number }>();
  perfData.forEach((p) => {
    const existing = adMap.get(p.ad_id) || { nome: "", leads: 0, cpl: 0, spend: 0 };
    existing.spend += Number(p.spend);
    existing.leads += p.leads;
    adMap.set(p.ad_id, existing);
  });
  metaData.forEach((m: { ad_id: string; ad_name: string | null }) => {
    const existing = adMap.get(m.ad_id);
    if (existing) existing.nome = m.ad_name || m.ad_id;
  });
  const topAnuncios = Array.from(adMap.values())
    .map((a) => ({ ...a, cpl: a.leads > 0 ? a.spend / a.leads : 0 }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 3);

  return NextResponse.json({
    periodo: { inicio: dataInicio, fim: dataFim },
    resumo: atual,
    top_anuncios: topAnuncios,
    comparativo: {
      leads_delta_pct: delta(atual.total_leads, anterior.total_leads),
      cpl_delta_pct: delta(atual.cpl_medio, anterior.cpl_medio),
      investimento_delta_pct: delta(atual.investimento_total, anterior.investimento_total),
      qualificacao_delta_pct: delta(atual.taxa_qualificacao, anterior.taxa_qualificacao),
    },
  });
}
