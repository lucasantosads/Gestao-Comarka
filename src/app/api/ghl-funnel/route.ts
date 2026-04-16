/**
 * GET /api/ghl-funnel
 * Lê dados do funil GHL do Supabase (sincronizados via n8n a cada 4h).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 300; // GHL funnel

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

export async function GET() {
  try {
    // Get the most recent snapshot timestamp first, then filter to only those rows
    const { data: latestSnapshot } = await supabase
      .from("ghl_funnel_snapshot")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1);

    const latestTs = latestSnapshot?.[0]?.updated_at;

    let funnelQuery = supabase.from("ghl_funnel_snapshot").select("*").order("pipeline_name").order("stage_position");
    if (latestTs) {
      funnelQuery = funnelQuery.eq("updated_at", latestTs);
    }

    const [{ data: funnel }, { data: alerts }] = await Promise.all([
      funnelQuery,
      supabase.from("ghl_sdr_alerts").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    const rows = (funnel || []) as {
      pipeline_name: string; pipeline_id: string; stage_name: string;
      stage_position: number; opp_count: number; won_count: number;
      lost_count: number; open_count: number; monetary_value: number;
      updated_at: string;
    }[];

    const alertRows = (alerts || []) as { tipo: string; msg: string; count: number }[];

    // Group by pipeline
    const pipelineMap = new Map<string, typeof rows>();
    rows.forEach((r) => {
      const arr = pipelineMap.get(r.pipeline_name) || [];
      arr.push(r);
      pipelineMap.set(r.pipeline_name, arr);
    });

    // SDR funnel
    let sdrFunnel = null;
    const sdrRows = pipelineMap.get("SDR");
    if (sdrRows && sdrRows.length > 0) {
      const total = sdrRows.reduce((s, r) => s + r.opp_count, 0);
      const qualificados = sdrRows.find((r) => r.stage_name === "Qualificado")?.opp_count || 0;
      const agendou = sdrRows.find((r) => r.stage_name.includes("Agendou"))?.opp_count || 0;
      const desqualificados = sdrRows.find((r) => r.stage_name === "Desqualificado")?.opp_count || 0;

      sdrFunnel = {
        total,
        stages: sdrRows.map((r) => ({
          name: r.stage_name,
          count: r.opp_count,
          pct: total > 0 ? (r.opp_count / total) * 100 : 0,
        })),
        taxaQualificacao: total > 0 ? qualificados / total : 0,
        taxaAgendamento: total > 0 ? agendou / total : 0,
        taxaDesqualificacao: total > 0 ? desqualificados / total : 0,
      };
    }

    // Closer funnels
    const closerFunnels: {
      name: string; total: number; comprou: number; desistiu: number;
      aberto: number; taxaFechamento: number; valorTotal: number; ticketMedio: number;
    }[] = [];

    pipelineMap.forEach((pRows, pName) => {
      if (!pName.toLowerCase().includes("closer")) return;
      const total = pRows.reduce((s, r) => s + r.opp_count, 0);
      const comprou = pRows.find((r) => r.stage_name.toLowerCase() === "comprou")?.opp_count || 0;
      const desistiu = pRows.find((r) => r.stage_name.toLowerCase() === "desistiu")?.opp_count || 0;
      const aberto = total - comprou - desistiu;
      const valorTotal = pRows.find((r) => r.stage_name.toLowerCase() === "comprou")?.monetary_value || 0;
      const totalDecidido = comprou + desistiu;

      closerFunnels.push({
        name: pName.replace("Closer - ", ""),
        total, comprou, desistiu, aberto,
        taxaFechamento: totalDecidido > 0 ? comprou / totalDecidido : 0,
        valorTotal,
        ticketMedio: comprou > 0 ? valorTotal / comprou : 0,
      });
    });

    return NextResponse.json({
      sdr: sdrFunnel,
      sdrAlerts: alertRows.filter((a) => a.tipo !== "none"),
      closers: closerFunnels,
      updatedAt: rows[0]?.updated_at || null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
