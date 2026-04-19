import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
);

/**
 * GET — Atribui automaticamente nicho/tese aos leads que têm ad_id
 * preenchido e que ainda não têm nicho_id (ou não são manuais).
 *
 * Cadeia: lead.ad_id → ads_metadata.campaign_id → campanhas_nichos.nicho_id/tese_id
 */
export async function GET() {
  try {
    // Leads sem nicho e não-manuais
    const { data: leads } = await supabase
      .from("leads_crm")
      .select("id, ad_id, campaign_id")
      .is("nicho_id", null)
      .or("atribuicao_manual.is.null,atribuicao_manual.eq.false")
      .not("ad_id", "is", null)
      .limit(1000);

    if (!leads || leads.length === 0) {
      return NextResponse.json({ atribuidos: 0, total_processados: 0 });
    }

    // Busca campaign_ids dos ads
    const adIds = Array.from(new Set(leads.map((l) => l.ad_id).filter(Boolean))) as string[];
    const { data: adsMeta } = await supabase
      .from("ads_metadata")
      .select("ad_id, campaign_id")
      .in("ad_id", adIds);

    const adToCampaign = new Map<string, string>();
    for (const am of adsMeta || []) {
      if (am.campaign_id) adToCampaign.set(am.ad_id, am.campaign_id);
    }

    // Busca vinculos confirmados de campanhas
    const campSet = new Set<string>();
    adToCampaign.forEach((v) => campSet.add(v));
    leads.forEach((l) => { if (l.campaign_id) campSet.add(l.campaign_id); });
    const campaignIds = Array.from(campSet);
    if (campaignIds.length === 0) {
      return NextResponse.json({ atribuidos: 0, total_processados: leads.length });
    }

    const { data: vinculos } = await supabase
      .from("campanhas_nichos")
      .select("campaign_id, nicho_id, tese_id")
      .in("campaign_id", campaignIds)
      .eq("confirmado", true)
      .is("deleted_at", null);

    const campToVinculo = new Map<string, { nicho_id: string; tese_id: string }>();
    for (const v of vinculos || []) {
      if (v.nicho_id && v.tese_id) campToVinculo.set(v.campaign_id, { nicho_id: v.nicho_id, tese_id: v.tese_id });
    }

    let atribuidos = 0;
    for (const lead of leads) {
      // Tenta via ad_id → campaign_id
      let campId = lead.ad_id ? adToCampaign.get(lead.ad_id) : null;
      // Fallback: campaign_id direto no lead
      if (!campId && lead.campaign_id) campId = lead.campaign_id;
      if (!campId) continue;

      const vinc = campToVinculo.get(campId);
      if (!vinc) continue;

      const { error } = await supabase
        .from("leads_crm")
        .update({ nicho_id: vinc.nicho_id, tese_id: vinc.tese_id, atribuicao_manual: false })
        .eq("id", lead.id);

      if (!error) atribuidos++;
    }

    return NextResponse.json({ atribuidos, total_processados: leads.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * PATCH — Atribuição manual de nicho/tese a um lead específico
 */
export async function PATCH(req: NextRequest) {
  try {
    const { lead_id, nicho_id, tese_id } = await req.json();
    if (!lead_id || !nicho_id || !tese_id) {
      return NextResponse.json({ error: "lead_id, nicho_id e tese_id obrigatórios" }, { status: 400 });
    }

    const { error } = await supabase
      .from("leads_crm")
      .update({ nicho_id, tese_id, atribuicao_manual: true })
      .eq("id", lead_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
