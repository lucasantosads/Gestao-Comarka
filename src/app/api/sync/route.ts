/**
 * POST /api/sync?source=meta|ghl|all
 * Sync rápido — apenas oportunidades e metadata. Sem busca individual de contatos.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const GHL_API_KEY = process.env.GHL_API_KEY!;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID!;
const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_HEADERS = { Authorization: `Bearer ${GHL_API_KEY}`, Version: "2021-07-28", "Content-Type": "application/json" };

const SOCIAL_SELLING_ID = "ZDPE5d5UKi8mDQRaVw8o";

// Custom field IDs do GHL — verificados via /locations/{id}/customFields em 2026-04-08.
// Se forem recriados no GHL, atualizar aqui.
const GHL_CUSTOM_FIELDS = {
  AD_ID: "IOPAIb5b5D2V39G4GC7S",       // Display: "Ad ID" (fieldKey bagunçado como utm_medium)
  UTM_CAMPAIGN: "NRAY4NXlrj7sBdaV3Uji",
  UTM_CONTENT: "yFzqxS2ttcjfXd3V76rz",
  CLICK_ID: "kj0UISs5M4uAFFLgEtdW",    // ctwa_clid / gclid
} as const;

interface GhlCustomField { id: string; fieldValue?: unknown; fieldValueString?: string }
interface GhlAttributionSource {
  sessionSource?: string | null; url?: string | null; medium?: string | null;
  ctwaClid?: string | null; adName?: string | null; adId?: string | null;
  utmSource?: string | null; campaign?: string | null;
}
interface GhlContactFull {
  id: string;
  customFields?: GhlCustomField[];
  attributionSource?: GhlAttributionSource;
  lastAttributionSource?: GhlAttributionSource;
}

function extractCfString(fields: GhlCustomField[] | undefined, id: string): string | null {
  const f = fields?.find((x) => x.id === id);
  if (!f) return null;
  const v = f.fieldValueString ?? (typeof f.fieldValue === "string" ? f.fieldValue : null);
  return v && v.trim() ? v.trim() : null;
}

// Cache em memória por execução — evita re-fetch do mesmo contato
const contactCache = new Map<string, GhlContactFull | null>();

async function fetchContactFull(contactId: string): Promise<GhlContactFull | null> {
  if (contactCache.has(contactId)) return contactCache.get(contactId)!;
  try {
    const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, { headers: GHL_HEADERS });
    if (!res.ok) { contactCache.set(contactId, null); return null; }
    const data = await res.json();
    const contact = data.contact as GhlContactFull | undefined;
    contactCache.set(contactId, contact || null);
    return contact || null;
  } catch {
    contactCache.set(contactId, null);
    return null;
  }
}

// Mapeamento dos estágios REAIS do GHL (auditado em 2026-04-08 via
// GET /opportunities/pipelines) para os valores canônicos usados internamente.
// Chave é case-insensitive — nomeNormalizado (lowercase + trim) abaixo.
// Pipelines cobertos: Closer-Lucas, Closer-Mariana, Closer-Rogerio, SDR.
// UUID v4 regex — valida se uma string é um UUID válido (usado para filtrar
// closer_id do GHL, que pode retornar IDs não-UUID como "gsp0Dhh8mSbhdu4MHXp0").
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

const ETAPA_MAP: Record<string, string> = {
  // Genéricos
  "new": "oportunidade",
  "oportunidade": "oportunidade",

  // SDR pipeline
  "acolhimento inicial": "oportunidade",
  "follow up (fora da janela)": "follow_up",
  "qualificado": "qualificado",
  "agendou reunião": "reuniao_agendada",
  "agendou reuniao": "reuniao_agendada",
  "no show": "no_show",
  "remarketing": "remarketing",
  "desqualificado": "desqualificado",

  // Closer pipelines
  "reunião agendada": "reuniao_agendada",
  "reuniao agendada": "reuniao_agendada",
  "reunião feita": "reuniao_feita",
  "reuniao feita": "reuniao_feita",
  "proposta enviada": "proposta_enviada",
  "ligação": "ligacao",
  "ligacao": "ligacao",
  "follow up": "follow_up",
  "follow-up": "follow_up",
  "contrato": "assinatura_contrato",
  "assinatura de contrato": "assinatura_contrato",
  "assinatura": "assinatura_contrato",
  "comprou": "comprou",
  "won": "comprou",
  "desistiu": "desistiu",
  "lost": "desistiu",
  "abandonou": "desistiu",
};

async function syncGHL(days: number) {
  const results: { pipelines: number; opportunities: number; errors: number; error_samples?: string[]; error?: string } = { pipelines: 0, opportunities: 0, errors: 0 };

  const pipRes = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`, { headers: GHL_HEADERS });
  if (!pipRes.ok) return { ...results, error: `GHL pipelines: ${pipRes.status}` };
  const pipData = await pipRes.json();
  const pipelines = (pipData.pipelines || []).filter((p: { id: string }) => p.id !== SOCIAL_SELLING_ID);
  results.pipelines = pipelines.length;

  for (const pipeline of pipelines) {
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const oppRes = await fetch(
        `${GHL_BASE}/opportunities/search?location_id=${GHL_LOCATION_ID}&pipeline_id=${pipeline.id}&limit=100&page=${page}`,
        { headers: GHL_HEADERS }
      );
      if (!oppRes.ok) { results.errors++; break; }
      const oppData = await oppRes.json();
      const opps = oppData.opportunities || [];

      // Monta as rows em memória; upsert em batch no final da página.
      // Paralelo (limit=8) para fetchContactFull apenas em opps recentes.
      const daysAgoDate = new Date(Date.now() - days * 86400000).toISOString();
      const recentOpps = opps.filter((o: { createdAt?: string; dateAdded?: string; contactId?: string; contact?: { id?: string }, updatedAt?: string }) => {
        const created = o.createdAt || o.dateAdded || o.updatedAt || null;
        const cid = o.contact?.id || o.contactId;
        return cid && created && created >= daysAgoDate;
      });
      // Pré-carrega contatos recentes em paralelo (bounded concurrency via chunks)
      for (let i = 0; i < recentOpps.length; i += 8) {
        const chunk = recentOpps.slice(i, i + 8);
        await Promise.all(chunk.map((o: { contact?: { id?: string }; contactId?: string }) => {
          const cid = o.contact?.id || o.contactId;
          return cid ? fetchContactFull(cid) : Promise.resolve(null);
        }));
      }

      const rows: Record<string, unknown>[] = [];
      for (const opp of opps) {
        const contact = opp.contact || {};
        const contactId = contact.id || opp.contactId;
        const stageName = opp.pipelineStageId ? (pipeline.stages || []).find((s: { id: string }) => s.id === opp.pipelineStageId)?.name : null;
        const stageKey = (stageName || "").trim().toLowerCase();
        const etapa = ETAPA_MAP[stageKey] || "oportunidade";

        const fullContact = contactId ? (contactCache.get(contactId) || null) : null;
        const attr = fullContact?.attributionSource || fullContact?.lastAttributionSource || null;
        const cf = fullContact?.customFields;

        const adIdFromAttr = attr?.adId || null;
        const adIdFromCf = extractCfString(cf, GHL_CUSTOM_FIELDS.AD_ID);
        const ad_id = adIdFromAttr || adIdFromCf || null;
        const ad_name = attr?.adName || null;
        const ctwa_clid = attr?.ctwaClid || extractCfString(cf, GHL_CUSTOM_FIELDS.CLICK_ID);
        const utm_campaign = attr?.campaign || extractCfString(cf, GHL_CUSTOM_FIELDS.UTM_CAMPAIGN);
        const utm_content = extractCfString(cf, GHL_CUSTOM_FIELDS.UTM_CONTENT);
        const utm_medium = attr?.medium || null;
        const utm_source = attr?.utmSource || null;
        const session_source = attr?.sessionSource || null;
        const landing_url = attr?.url || null;

        rows.push({
          ghl_opportunity_id: opp.id,
          ghl_contact_id: contactId,
          ghl_pipeline_id: pipeline.id,
          nome: contact.name || contact.firstName || opp.name || "Sem nome",
          telefone: contact.phone || "",
          email: contact.email || "",
          etapa,
          closer_id: isUuid(opp.assignedTo) ? opp.assignedTo : null,
          ghl_created_at: opp.createdAt || null,
          mes_referencia: (opp.createdAt || new Date().toISOString()).slice(0, 7),
          canal_aquisicao: opp.source || session_source || "Desconhecido",
          ad_id,
          ad_name,
          ctwa_clid,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          session_source,
          origem_utm: landing_url,
        });
      }

      // Upsert em batch de toda a página
      const { error } = await supabase.from("leads_crm").upsert(rows, {
        onConflict: "ghl_opportunity_id",
        ignoreDuplicates: false,
      });
      if (error) {
        results.errors += rows.length;
        if (!results.error_samples) results.error_samples = [];
        if (results.error_samples.length < 3) {
          results.error_samples.push(`${error.code}: ${error.message}`);
        }
      } else {
        results.opportunities += rows.length;
      }

      hasMore = opps.length === 100;
      page++;
    }
  }

  return results;
}

async function syncMeta(days: number) {
  const results = { days, ads_synced: 0, perf_synced: 0, error: null as string | null };

  const token = process.env.META_ADS_ACCESS_TOKEN || "";
  const account = process.env.META_ADS_ACCOUNT_ID || "";
  const BASE = "https://graph.facebook.com/v21.0";

  if (!token || !account) {
    results.error = "META_ADS credentials not configured";
    return results;
  }

  const hoje = new Date();
  const since = new Date(hoje);
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split("T")[0];
  const hojeStr = hoje.toISOString().split("T")[0];

  try {
    // Sync ads_metadata (com creative body/title/thumbnail)
    const adsParams = new URLSearchParams({
      access_token: token,
      fields: "id,name,status,campaign{id,name,objective},adset{id,name},creative{body,title,thumbnail_url,image_url,link_url,call_to_action_type,object_story_spec}",
      limit: "50",
    });
    const adsRes = await fetch(`${BASE}/${account}/ads?${adsParams.toString()}`);
    const adsFromMeta: string[] = [];
    if (adsRes.ok) {
      const adsBody = await adsRes.json();
      for (const ad of (adsBody.data || [])) {
        if (ad.status === "DELETED") continue;
        adsFromMeta.push(ad.id);

        const spec = ad.creative?.object_story_spec as any;
        const highResImg = spec?.video_data?.image_url || spec?.link_data?.image_url || spec?.photo_data?.url;

        const { error } = await supabase.from("ads_metadata").upsert({
          ad_id: ad.id, ad_name: ad.name,
          campaign_id: ad.campaign?.id || null, campaign_name: ad.campaign?.name || null,
          adset_id: ad.adset?.id || null, adset_name: ad.adset?.name || null,
          objetivo: ad.campaign?.objective || null, status: ad.status,
          thumbnail_url: ad.creative?.thumbnail_url || null,
          image_url: highResImg || ad.creative?.image_url || null,
          ad_body: ad.creative?.body || null,
          ad_title: ad.creative?.title || null,
          link_url: ad.creative?.link_url || null,
          call_to_action_type: ad.creative?.call_to_action_type || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "ad_id" });
        if (!error) results.ads_synced++;
      }
      if (adsFromMeta.length > 0) {
        const { data: existing } = await supabase.from("ads_metadata").select("ad_id,status");
        const stale = (existing || [])
          .filter((e) => e.status !== "ARCHIVED" && e.status !== "DELETED" && !adsFromMeta.includes(e.ad_id))
          .map((e) => e.ad_id);
        if (stale.length > 0) {
          await supabase.from("ads_metadata")
            .update({ status: "ARCHIVED", updated_at: new Date().toISOString() })
            .in("ad_id", stale);
        }
      }
    }

    // Sync ads_performance (dinamico baseado no param days)
    const perfParams = new URLSearchParams({
      access_token: token,
      fields: "ad_id,ad_name,impressions,clicks,spend,actions,ctr,cpc,frequency,date_start",
      time_range: JSON.stringify({ since: sinceStr, until: hojeStr }),
      time_increment: "1", level: "ad", limit: "500",
    });
    // Paginação completa — itera todas as páginas de insights
    let perfUrl: string | undefined = `${BASE}/${account}/insights?${perfParams.toString()}`;
    while (perfUrl) {
      const perfRes: Response = await fetch(perfUrl);
      if (!perfRes.ok) break;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const perfBody: { data?: any[]; paging?: { next?: string } } = await perfRes.json();
      for (const row of (perfBody.data || [])) {
        const leads = (row.actions || [])
          .filter((a: { action_type: string }) => ["lead", "onsite_conversion.messaging_first_reply", "onsite_conversion.lead_grouped"].includes(a.action_type))
          .reduce((s: number, a: { value: string }) => s + parseInt(a.value), 0);
        const spend = parseFloat(row.spend || "0");
        await supabase.from("ads_performance").upsert({
          ad_id: row.ad_id, data_ref: row.date_start,
          impressoes: parseInt(row.impressions || "0"), cliques: parseInt(row.clicks || "0"),
          spend, leads, cpl: leads > 0 ? spend / leads : 0,
          ctr: parseFloat(row.ctr || "0"), cpc: parseFloat(row.cpc || "0"),
          frequencia: parseFloat(row.frequency || "0"),
        }, { onConflict: "ad_id,data_ref" });
        results.perf_synced++;
      }
      perfUrl = perfBody.paging?.next;
    }
  } catch (e) {
    results.error = String(e);
  }

  return results;
}

export async function POST(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source") || "all";
  const days = parseInt(req.nextUrl.searchParams.get("days") || "90"); // 90 dias para cobrir filtros de "3 meses"
  const startTime = Date.now();
  const results: Record<string, unknown> = {};

  const tasks: Promise<void>[] = [];

  if (source === "ghl" || source === "all") {
    tasks.push(syncGHL(days).then(res => { results.ghl = res; }));
  }
  if (source === "meta" || source === "all") {
    tasks.push(syncMeta(days).then(res => { results.meta = res; }));
  }

  await Promise.all(tasks);

  results.duration_ms = Date.now() - startTime;
  results.synced_at = new Date().toISOString();
  return NextResponse.json(results);
}
