/**
 * POST /api/lead-events
 * Registra evento do funil e recalcula scores do criativo.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateCompositeScore } from "@/lib/traffic/score-calculator";

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lead_id, event_type, closer_id, mrr_value, notes } = body;

    if (!lead_id || !event_type) {
      return NextResponse.json({ error: "lead_id e event_type são obrigatórios" }, { status: 400 });
    }

    // 1. Buscar ad_id do lead (de leads_ads_attribution ou leads_crm)
    let ad_id: string | null = null;
    const { data: attr } = await supabase
      .from("leads_ads_attribution")
      .select("ad_id, adset_id, campaign_id")
      .eq("lead_id", lead_id)
      .single();

    if (attr?.ad_id) {
      ad_id = attr.ad_id;
    } else {
      // Fallback: buscar de leads_crm
      const { data: crm } = await supabase
        .from("leads_crm")
        .select("ad_id")
        .eq("ghl_contact_id", lead_id)
        .single();
      if (crm?.ad_id) ad_id = crm.ad_id;
    }

    // 2. Inserir evento
    const { error: insertErr } = await supabase.from("lead_funnel_events").insert({
      lead_id,
      ad_id,
      event_type,
      closer_id: closer_id || null,
      mrr_value: mrr_value || 0,
      notes: notes || null,
      event_at: new Date().toISOString(),
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 3. Recalcular creative_scores para o ad_id
    if (ad_id) {
      await recalculateCreativeScore(ad_id);

      // 4. Recalcular audience_performance se tiver adset_id
      if (attr?.adset_id) {
        await recalculateAudienceScore(attr.adset_id);
      }
    }

    return NextResponse.json({ success: true, ad_id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function recalculateCreativeScore(adId: string) {
  // Buscar contagens do funil
  const { data: events } = await supabase
    .from("lead_funnel_events")
    .select("event_type, mrr_value")
    .eq("ad_id", adId);

  if (!events) return;

  const count = (type: string) => events.filter((e) => e.event_type === type).length;
  const total_leads = count("entrada");
  const qualified_leads = count("qualificado");
  const disqualified_leads = count("desqualificado");
  const meetings_scheduled = count("reuniao_agendada");
  const meetings_held = count("reuniao_realizada");
  const no_shows = count("no_show");
  const proposals_sent = count("proposta_enviada");
  const contracts_closed = count("contrato_fechado");
  const total_mrr = events
    .filter((e) => e.event_type === "contrato_fechado")
    .reduce((s, e) => s + Number(e.mrr_value || 0), 0);

  // Buscar spend do Meta
  const { data: perfData } = await supabase
    .from("ads_performance")
    .select("spend")
    .eq("ad_id", adId);
  const spend = (perfData || []).reduce((s, r) => s + Number(r.spend), 0);

  // Buscar metadata
  const { data: meta } = await supabase
    .from("ads_metadata")
    .select("ad_name, campaign_id, campaign_name, adset_id, adset_name")
    .eq("ad_id", adId)
    .single();

  // Calcular score e alertas
  const { composite_score, alert_status, alert_message } = calculateCompositeScore({
    total_leads, qualified_leads, meetings_scheduled,
    meetings_held, contracts_closed, no_shows,
  });

  // Upsert
  await supabase.from("creative_scores").upsert({
    ad_id: adId,
    ad_name: meta?.ad_name || null,
    campaign_id: meta?.campaign_id || null,
    campaign_name: meta?.campaign_name || null,
    adset_id: meta?.adset_id || null,
    adset_name: meta?.adset_name || null,
    total_leads, qualified_leads, disqualified_leads,
    meetings_scheduled, meetings_held, no_shows,
    proposals_sent, contracts_closed, total_mrr, spend,
    composite_score, alert_status, alert_message,
    last_updated: new Date().toISOString(),
  }, { onConflict: "ad_id" });
}

async function recalculateAudienceScore(adsetId: string) {
  // Buscar todos ad_ids deste adset
  const { data: ads } = await supabase
    .from("ads_metadata")
    .select("ad_id, adset_name, campaign_id, campaign_name")
    .eq("adset_id", adsetId);

  if (!ads || ads.length === 0) return;

  const adIds = ads.map((a) => a.ad_id);

  // Buscar eventos de todos os ads do adset
  const { data: events } = await supabase
    .from("lead_funnel_events")
    .select("event_type, mrr_value")
    .in("ad_id", adIds);

  if (!events) return;

  const count = (type: string) => events.filter((e) => e.event_type === type).length;
  const total_leads = count("entrada");
  const qualified_leads = count("qualificado");
  const meetings = count("reuniao_realizada");
  const contracts = count("contrato_fechado");
  const total_mrr = events
    .filter((e) => e.event_type === "contrato_fechado")
    .reduce((s, e) => s + Number(e.mrr_value || 0), 0);

  const { data: perfData } = await supabase
    .from("ads_performance")
    .select("spend")
    .in("ad_id", adIds);
  const spend = (perfData || []).reduce((s, r) => s + Number(r.spend), 0);

  const { composite_score, alert_status } = calculateCompositeScore({
    total_leads, qualified_leads,
    meetings_scheduled: count("reuniao_agendada"),
    meetings_held: meetings,
    contracts_closed: contracts,
    no_shows: count("no_show"),
  });

  await supabase.from("audience_performance").upsert({
    adset_id: adsetId,
    adset_name: ads[0]?.adset_name || null,
    campaign_id: ads[0]?.campaign_id || null,
    campaign_name: ads[0]?.campaign_name || null,
    total_leads, qualified_leads, meetings, contracts,
    total_mrr, spend, composite_score, alert_status,
    last_updated: new Date().toISOString(),
  }, { onConflict: "adset_id" });
}
