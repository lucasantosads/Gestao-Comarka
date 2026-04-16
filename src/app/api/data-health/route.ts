/**
 * GET /api/data-health
 * Audita a completude dos dados nas tabelas críticas.
 * Não retorna conteúdo sensível — só contagens e métricas de cobertura.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { attributionStartDate } from "@/lib/trafego-attribution";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

interface Check {
  id: string;
  label: string;
  status: "ok" | "warn" | "error";
  value: string;
  detail?: string;
  fix?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function count(table: string, filter?: (q: any) => any): Promise<number> {
  let q: any = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: c } = await q;
  return c || 0;
}

export async function GET() {
  const checks: Check[] = [];
  const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const now = new Date();
  const mesAtual = now.toISOString().slice(0, 7);
  const attrStart = await attributionStartDate();
  const attrStartDate = attrStart.slice(0, 10);

  // 1. leads_crm: cobertura de atribuição — agora calculada SOMENTE a partir do corte
  // Usa ghl_created_at (data real no GHL), não created_at (data de INSERT no Supabase)
  const { count: totalLeads } = await supabase.from("leads_crm").select("*", { count: "exact", head: true }).gte("ghl_created_at", attrStart);
  const { count: leadsComAdId } = await supabase.from("leads_crm").select("*", { count: "exact", head: true }).gte("ghl_created_at", attrStart).not("ad_id", "is", null);
  const { count: leadsMesAtual } = await supabase.from("leads_crm").select("*", { count: "exact", head: true }).eq("mes_referencia", mesAtual);
  const tot = totalLeads || 0;
  const withAd = leadsComAdId || 0;
  const pctAtribuidos = tot > 0 ? (withAd / tot) * 100 : 0;
  checks.push({
    id: "leads_attribution",
    label: `Atribuição de leads (após ${attrStartDate})`,
    status: pctAtribuidos < 30 ? "error" : pctAtribuidos < 70 ? "warn" : "ok",
    value: `${pctAtribuidos.toFixed(1)}% (${withAd}/${tot})`,
    detail: pctAtribuidos < 30
      ? `Taxa ainda baixa pós-corte. Leads órfãos depois de ${attrStartDate} indicam integração Meta→GHL não populando attributionSource.`
      : "Leads com ad_id populado permitem cruzamento com ads_performance.",
    fix: pctAtribuidos < 70
      ? "GHL → Settings → Integrations → Facebook → habilitar Pull Ad Data. Depois rodar POST /api/sync?source=ghl."
      : undefined,
  });

  // 2. leads_crm: volume do mês atual
  checks.push({
    id: "leads_mes_atual",
    label: `Leads no mês ${mesAtual}`,
    status: !leadsMesAtual ? "error" : leadsMesAtual < 10 ? "warn" : "ok",
    value: String(leadsMesAtual || 0),
    detail: !leadsMesAtual ? "Nenhum lead no mês atual" : undefined,
  });

  // 3. ads_metadata: staleness
  const { data: lastAd } = await supabase.from("ads_metadata").select("updated_at").order("updated_at", { ascending: false }).limit(1);
  const lastSync = lastAd?.[0]?.updated_at;
  const hoursSince = lastSync ? Math.round((Date.now() - new Date(lastSync).getTime()) / 3600000) : null;
  checks.push({
    id: "ads_metadata_sync",
    label: "ads_metadata — última sync",
    status: hoursSince === null ? "error" : hoursSince > 48 ? "error" : hoursSince > 24 ? "warn" : "ok",
    value: hoursSince === null ? "nunca" : hoursSince < 1 ? "agora" : hoursSince < 24 ? `há ${hoursSince}h` : `há ${Math.round(hoursSince / 24)}d`,
    fix: hoursSince !== null && hoursSince > 24 ? "POST /api/sync?source=meta" : undefined,
  });

  // 4. ads_metadata: ads ACTIVE no DB vs ads com performance recente (reconciliação)
  const { data: activeAds } = await supabase.from("ads_metadata").select("ad_id").eq("status", "ACTIVE");
  const { data: perfRecent } = await supabase.from("ads_performance").select("ad_id").gte("data_ref", d7).limit(5000);
  const perfAdIds = new Set((perfRecent || []).map((p) => p.ad_id));
  const activeCount = (activeAds || []).length;
  const activeComPerf = (activeAds || []).filter((a) => perfAdIds.has(a.ad_id)).length;
  const activeSemPerf = activeCount - activeComPerf;
  checks.push({
    id: "ads_metadata_reconciled",
    label: "Ads ACTIVE sem performance recente",
    status: activeCount === 0 ? "ok" : activeSemPerf / activeCount > 0.5 ? "error" : activeSemPerf / activeCount > 0.2 ? "warn" : "ok",
    value: `${activeSemPerf} de ${activeCount}`,
    detail: activeSemPerf > 0
      ? `${activeComPerf} ads ACTIVE têm delivery nos últimos 7 dias. ${activeSemPerf} são provavelmente fantasma.`
      : undefined,
    fix: activeSemPerf > 0 ? "POST /api/sync?source=meta (reconciliação automática arquiva fantasmas)" : undefined,
  });

  // 5. ads_performance: gap de dias
  const { data: perfDates } = await supabase.from("ads_performance").select("data_ref").gte("data_ref", d7).order("data_ref", { ascending: false });
  const diasComDados = new Set((perfDates || []).map((p) => p.data_ref)).size;
  checks.push({
    id: "ads_performance_coverage",
    label: "Dias com dados de performance (últimos 7)",
    status: diasComDados < 5 ? "error" : diasComDados < 7 ? "warn" : "ok",
    value: `${diasComDados} / 7`,
  });

  // 6. Gap Meta leads vs CRM attribution — janela a partir do corte
  const gapSince = attrStartDate > d7 ? attrStartDate : d7;
  const { data: perfLeads } = await supabase.from("ads_performance").select("leads").gte("data_ref", gapSince);
  const metaLeads = (perfLeads || []).reduce((s, p) => s + (p.leads || 0), 0);
  const { count: attrLeads } = await supabase.from("leads_ads_attribution").select("*", { count: "exact", head: true }).gte("created_at", attrStart);
  const gapPct = metaLeads > 0 ? ((metaLeads - (attrLeads || 0)) / metaLeads) * 100 : 0;
  checks.push({
    id: "meta_crm_gap",
    label: `Gap Meta ↔ CRM (desde ${gapSince})`,
    status: gapPct > 50 ? "error" : gapPct > 20 ? "warn" : "ok",
    value: `${gapPct.toFixed(0)}% de perda`,
    detail: `Meta reporta ${metaLeads} leads · CRM atribuiu ${attrLeads || 0}`,
    fix: gapPct > 20 ? "Consequência direta de atribuição quebrada — ver checagem leads_attribution." : undefined,
  });

  // 6b. Inconsistências pós-corte: ad_ids do CRM que não existem em ads_metadata
  const { data: crmAds } = await supabase.from("leads_crm").select("ad_id").gte("ghl_created_at", attrStart).not("ad_id", "is", null);
  const crmAdIds = Array.from(new Set((crmAds || []).map((x) => x.ad_id).filter(Boolean)));
  let orphanCount = 0;
  if (crmAdIds.length > 0) {
    const { data: knownAds } = await supabase.from("ads_metadata").select("ad_id").in("ad_id", crmAdIds);
    const known = new Set((knownAds || []).map((x) => x.ad_id));
    orphanCount = crmAdIds.filter((id) => !known.has(id)).length;
  }
  checks.push({
    id: "crm_orphan_ads",
    label: "ad_ids em leads_crm sem match em ads_metadata",
    status: orphanCount === 0 ? "ok" : "warn",
    value: `${orphanCount} / ${crmAdIds.length}`,
    detail: orphanCount > 0 ? "Leads referenciam anúncios que não estão em ads_metadata — sync do Meta pode estar incompleto ou os ads foram deletados." : "Todos os ad_ids do CRM encontram o anúncio correspondente.",
    fix: orphanCount > 0 ? "POST /api/sync?source=meta para repopular ads_metadata." : undefined,
  });

  // 7. team_commission_config
  const configCount = await count("team_commission_config");
  checks.push({
    id: "commission_config",
    label: "team_commission_config",
    status: configCount === 0 ? "warn" : "ok",
    value: `${configCount} colaboradores configurados`,
    detail: configCount === 0 ? "Nenhum colaborador com metas cadastradas — card de comissão em /equipe mostra vazio." : undefined,
    fix: configCount === 0 ? "Admin entra em /equipe → cada membro → configurar meta_reunioes_mes, meta_vendas_mes, ote_base." : undefined,
  });

  // 8. team_notion_mirror: whitespace em cargos
  const { data: teamMembers } = await supabase.from("team_notion_mirror").select("nome,cargo");
  const dirty = (teamMembers || []).filter((m) => m.cargo && m.cargo !== m.cargo.trim());
  checks.push({
    id: "team_cargos_whitespace",
    label: "Cargos com whitespace em team_notion_mirror",
    status: dirty.length === 0 ? "ok" : "warn",
    value: `${dirty.length} linha(s)`,
    fix: dirty.length > 0 ? "SQL: UPDATE team_notion_mirror SET cargo = TRIM(cargo) WHERE cargo <> TRIM(cargo)" : undefined,
  });

  // 9. creative_scores cobertura
  const creativeScoresCount = await count("creative_scores");
  checks.push({
    id: "creative_scores",
    label: "creative_scores populados",
    status: creativeScoresCount === 0 ? "error" : creativeScoresCount < 10 ? "warn" : "ok",
    value: String(creativeScoresCount),
    detail: creativeScoresCount < 10 ? "Cobertura baixa — consequência direta de atribuição quebrada." : undefined,
  });

  const errorCount = checks.filter((c) => c.status === "error").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const overall: "healthy" | "degraded" | "critical" = errorCount > 0 ? "critical" : warnCount > 0 ? "degraded" : "healthy";

  return NextResponse.json({
    overall,
    checked_at: new Date().toISOString(),
    summary: { ok: checks.length - errorCount - warnCount, warn: warnCount, error: errorCount },
    checks,
  });
}
