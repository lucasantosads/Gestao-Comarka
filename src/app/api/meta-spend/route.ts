/**
 * GET /api/meta-spend?since=2026-04-01&until=2026-04-04
 *     [&campaign_id=123] — filtra a uma campanha específica (usa endpoint /{campaign_id}/insights)
 *
 * Puxa spend, leads e CPL direto da Meta Marketing API.
 * Retorna o valor REAL sem depender do n8n sync.
 * Default: últimos 30 dias se since/until não forem passados.
 *
 * Usa getCachedMetaData para cache em memória (TTL 5min para spend).
 */
import { NextRequest, NextResponse } from "next/server";
import { getCachedMetaData, TTL_REALTIME } from "@/lib/meta-cache";

export const revalidate = 120; // Meta Ads data

const TOKEN = () => process.env.META_ADS_ACCESS_TOKEN || "";
const ACCOUNT = () => process.env.META_ADS_ACCOUNT_ID || "";
const BASE = "https://graph.facebook.com/v21.0";

function defaultRange(): { since: string; until: string } {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 29);
  return {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaign_id");
  const def = defaultRange();
  const since = searchParams.get("since") || def.since;
  const until = searchParams.get("until") || def.until;

  const token = TOKEN();
  const account = ACCOUNT();

  if (!token || !account) {
    return NextResponse.json({ error: "META_ADS credentials not configured" }, { status: 500 });
  }

  try {
    // Endpoint muda quando filtramos por campanha:
    //  - campanha: /{campaign_id}/insights com level=campaign
    //  - conta:    /{account_id}/insights com level=account
    const insightsTarget = campaignId ? campaignId : account;
    const level = campaignId ? "campaign" : "account";

    const params = new URLSearchParams({
      access_token: token,
      fields: "spend,actions,impressions,clicks,ctr,frequency,cost_per_action_type,campaign_name",
      time_range: JSON.stringify({ since, until }),
      level,
    });

    const cacheKey = `spend:${insightsTarget}:${since}:${until}`;
    const cached = await getCachedMetaData<{ data: unknown[] }>(
      cacheKey,
      { target: insightsTarget, since, until, level },
      TTL_REALTIME,
      async () => {
        const res = await fetch(`${BASE}/${insightsTarget}/insights?${params.toString()}`);
        if (!res.ok) {
          const errText = await res.text();
          let errMsg = `Meta API ${res.status}`;
          try { errMsg = JSON.parse(errText)?.error?.message || errMsg; } catch {}
          throw new Error(errMsg);
        }
        return res.json();
      },
    );

    const body = cached.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (body.data || []) as any[];

    let totalSpend = 0;
    let totalLeads = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalCtr = 0;
    let totalFreq = 0;
    let metaCpl = 0;
    let count = 0;

    for (const row of rows) {
      totalSpend += parseFloat(row.spend || "0");
      totalImpressions += parseInt(row.impressions || "0");
      totalClicks += parseInt(row.clicks || "0");
      totalCtr += parseFloat(row.ctr || "0");
      totalFreq += parseFloat(row.frequency || "0");
      count++;

      // Count leads from actions
      const actions = row.actions as { action_type: string; value: string }[] | undefined;
      if (actions) {
        for (const a of actions) {
          if (["lead", "onsite_conversion.messaging_first_reply", "onsite_conversion.lead_grouped"].includes(a.action_type)) {
            totalLeads += parseInt(a.value);
          }
        }
      }

      // Get Meta's own CPL from cost_per_action_type
      const costPerAction = row.cost_per_action_type as { action_type: string; value: string }[] | undefined;
      if (costPerAction) {
        for (const c of costPerAction) {
          if (["lead", "onsite_conversion.messaging_first_reply", "onsite_conversion.lead_grouped"].includes(c.action_type)) {
            metaCpl = parseFloat(c.value);
            break;
          }
        }
      }
    }

    const cplCalculado = totalLeads > 0 ? totalSpend / totalLeads : 0;

    // Also get per-campaign breakdown for average CPL (cached)
    const campaignParams = new URLSearchParams({
      access_token: token,
      fields: "campaign_name,spend,actions",
      time_range: JSON.stringify({ since, until }),
      level: "campaign",
      limit: "500",
    });

    const campaignCached = await getCachedMetaData<{ data: unknown[] }>(
      `spend-campaigns:${account}:${since}:${until}`,
      { target: account, since, until, level: "campaign" },
      TTL_REALTIME,
      async () => {
        const r = await fetch(`${BASE}/${account}/insights?${campaignParams.toString()}`);
        if (!r.ok) return { data: [] };
        return r.json();
      },
    );
    const campaignCPLs: { name: string; spend: number; leads: number; cpl: number }[] = [];

    {
      const campaignBody = campaignCached.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of ((campaignBody.data || []) as any[])) {
        const spend = parseFloat(row.spend || "0");
        let leads = 0;
        const actions = row.actions as { action_type: string; value: string }[] | undefined;
        if (actions) {
          for (const a of actions) {
            if (["lead", "onsite_conversion.messaging_first_reply", "onsite_conversion.lead_grouped"].includes(a.action_type)) {
              leads += parseInt(a.value);
            }
          }
        }
        if (leads > 0) {
          campaignCPLs.push({ name: row.campaign_name, spend, leads, cpl: spend / leads });
        }
      }
    }

    const cplMedioCampanhas = campaignCPLs.length > 0
      ? campaignCPLs.reduce((s, c) => s + c.cpl, 0) / campaignCPLs.length
      : cplCalculado;

    return NextResponse.json({
      spend: totalSpend,
      leads: totalLeads,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: count > 0 ? totalCtr / count : 0,
      frequency: count > 0 ? totalFreq / count : 0,
      cplMeta: metaCpl,           // CPL reportado pelo Meta
      cplCalculado,               // spend / leads
      cplPonderado: cplCalculado, // CPL ponderado (totalSpend/totalLeads) — métrica primária
      cplMedioCampanhas,          // média simples dos CPLs por campanha — métrica secundária
      campanhas: campaignCPLs,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
