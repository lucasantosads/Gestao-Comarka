/**
 * POST /api/trafego/performance-temporal
 * Cron diário às 05h. Protegido por CRON_SECRET.
 * Calcula performance por dia da semana × hora para cada cliente.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resultados = { clientes_processados: 0, registros_upserted: 0, erros: [] as string[] };

  try {
    // Clientes com meta_campaign_id
    const { data: clientes } = await supabase
      .from("clientes_notion_mirror")
      .select("notion_id, cliente, meta_campaign_id")
      .not("meta_campaign_id", "is", null)
      .neq("status", "Cancelado");

    if (!clientes || clientes.length === 0) {
      return NextResponse.json({ ...resultados, message: "Nenhum cliente com campaign vinculada" });
    }

    // Leads dos últimos 30 dias
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: leads } = await supabase
      .from("leads_crm")
      .select("campaign_id, ghl_created_at, etapa")
      .gte("ghl_created_at", d30)
      .not("ghl_created_at", "is", null);

    // Ads performance últimos 30 dias
    const d30str = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const { data: perfAll } = await supabase
      .from("ads_performance")
      .select("ad_id, data_ref, spend, leads")
      .gte("data_ref", d30str);

    // Ads metadata para mapear ad_id → campaign_id
    const { data: metadataAll } = await supabase
      .from("ads_metadata")
      .select("ad_id, campaign_id");
    const adToCampaign = new Map<string, string>();
    for (const m of metadataAll || []) {
      if (m.campaign_id) adToCampaign.set(m.ad_id, m.campaign_id);
    }

    const mesRef = new Date().toISOString().split("T")[0].slice(0, 7) + "-01";
    const etapasQualificadas = new Set(["reuniao_agendada", "reuniao_feita", "proposta_enviada", "negociacao", "assinatura_contrato", "comprou"]);

    for (const cliente of clientes) {
      try {
        const campaignId = cliente.meta_campaign_id;
        if (!campaignId) continue;

        // Leads desse cliente
        const clienteLeads = (leads || []).filter((l) => l.campaign_id === campaignId);
        if (clienteLeads.length === 0) continue;

        // Spend por data para esse campaign
        const campaignAdIds = (metadataAll || [])
          .filter((m) => m.campaign_id === campaignId)
          .map((m) => m.ad_id);
        const campaignPerf = (perfAll || []).filter((p) => campaignAdIds.includes(p.ad_id));

        // Agrupar spend por data
        const spendByDate = new Map<string, number>();
        for (const p of campaignPerf) {
          spendByDate.set(p.data_ref, (spendByDate.get(p.data_ref) || 0) + Number(p.spend));
        }

        // Agrupar leads por dia_semana × hora
        const grid: Record<string, { leads: number; qualificados: number; spend: number }> = {};

        for (const lead of clienteLeads) {
          if (!lead.ghl_created_at) continue;
          const dt = new Date(lead.ghl_created_at);
          const diaSemana = dt.getDay();
          const hora = dt.getHours();
          const key = `${diaSemana}-${hora}`;

          if (!grid[key]) grid[key] = { leads: 0, qualificados: 0, spend: 0 };
          grid[key].leads++;
          if (etapasQualificadas.has(lead.etapa)) {
            grid[key].qualificados++;
          }
        }

        // Distribuir spend proporcionalmente
        const totalSpend30d = Array.from(spendByDate.values()).reduce((s, v) => s + v, 0);
        const totalLeads30d = clienteLeads.length;
        const spendPorLead = totalLeads30d > 0 ? totalSpend30d / totalLeads30d : 0;

        // Upsert cada slot
        for (const [key, data] of Object.entries(grid)) {
          const [ds, h] = key.split("-").map(Number);
          const cplMedio = data.leads > 0 ? spendPorLead : null;
          const taxaQual = data.leads > 0 ? (data.qualificados / data.leads) * 100 : null;
          const totalSpend = data.leads * spendPorLead;

          const { error } = await supabase
            .from("trafego_performance_temporal")
            .upsert({
              cliente_id: cliente.notion_id,
              dia_semana: ds,
              hora: h,
              mes_referencia: mesRef,
              total_leads: data.leads,
              cpl_medio: cplMedio,
              taxa_qualificacao: taxaQual,
              total_spend: totalSpend,
              calculado_em: new Date().toISOString(),
            }, { onConflict: "cliente_id,dia_semana,hora,mes_referencia" });

          if (error) {
            resultados.erros.push(`Upsert ${key} cliente ${cliente.notion_id}: ${error.message}`);
          } else {
            resultados.registros_upserted++;
          }
        }

        resultados.clientes_processados++;
      } catch (e) {
        resultados.erros.push(`Cliente ${cliente.notion_id}: ${e}`);
      }
    }
  } catch (e) {
    resultados.erros.push(String(e));
  }

  return NextResponse.json(resultados);
}
