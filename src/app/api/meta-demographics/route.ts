/**
 * GET /api/meta-demographics?since=YYYY-MM-DD&until=YYYY-MM-DD&breakdown=age_gender|region|device|platform
 * 
 * Retorna insights com breakdowns demográficos da conta de anúncios.
 * Breakdowns suportados:
 *  - age_gender: idade + gênero
 *  - region: estado/região
 *  - device: dispositivo (mobile, desktop, tablet)
 *  - platform: plataforma (facebook, instagram, audience_network)
 */
import { NextRequest, NextResponse } from "next/server";

export const revalidate = 300;

const META_TOKEN = process.env.META_ADS_ACCESS_TOKEN || "";
const META_ACCOUNT = process.env.META_ADS_ACCOUNT_ID || "";
const BASE = "https://graph.facebook.com/v21.0";

interface MetaAction {
    action_type: string;
    value: string;
}

interface MetaInsightRow {
    age?: string;
    gender?: string;
    region?: string;
    country?: string;
    device_platform?: string;
    publisher_platform?: string;
    platform_position?: string;
    impressions?: string;
    clicks?: string;
    spend?: string;
    ctr?: string;
    cpc?: string;
    actions?: MetaAction[];
}

export interface DemographicRow {
    label: string;
    sublabel?: string;
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
    cpl: number;
    ctr: number;
    cpc: number;
}

// Map de breakdowns válidos
const BREAKDOWN_MAP: Record<string, { breakdowns: string; extraFields?: string }> = {
    age_gender: { breakdowns: "age,gender" },
    region: { breakdowns: "region" },
    device: { breakdowns: "device_platform" },
    platform: { breakdowns: "publisher_platform,platform_position" },
};

function extractLeads(actions?: MetaAction[]): number {
    if (!actions) return 0;
    return actions
        .filter((a) => ["lead", "onsite_conversion.messaging_first_reply", "onsite_conversion.lead_grouped"].includes(a.action_type))
        .reduce((s, a) => s + parseInt(a.value || "0"), 0);
}

export async function GET(req: NextRequest) {
    if (!META_TOKEN || !META_ACCOUNT) {
        return NextResponse.json({ data: [], error: "META_ADS credentials not configured" }, { status: 500 });
    }

    const since = req.nextUrl.searchParams.get("since") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const until = req.nextUrl.searchParams.get("until") || new Date().toISOString().split("T")[0];
    const breakdownKey = req.nextUrl.searchParams.get("breakdown") || "age_gender";

    const config = BREAKDOWN_MAP[breakdownKey];
    if (!config) {
        return NextResponse.json({ data: [], error: `Invalid breakdown: ${breakdownKey}` }, { status: 400 });
    }

    try {
        const params = new URLSearchParams({
            access_token: META_TOKEN,
            fields: "impressions,clicks,spend,ctr,cpc,actions",
            time_range: JSON.stringify({ since, until }),
            breakdowns: config.breakdowns,
            level: "account",
            limit: "500",
        });

        const res = await fetch(`${BASE}/${META_ACCOUNT}/insights?${params.toString()}`);
        if (!res.ok) {
            const errText = await res.text();
            return NextResponse.json({ data: [], error: `Meta API ${res.status}: ${errText.slice(0, 200)}` }, { status: 500 });
        }

        const body = await res.json();
        const rows: DemographicRow[] = (body.data || []).map((row: MetaInsightRow) => {
            const spend = parseFloat(row.spend || "0");
            const impressions = parseInt(row.impressions || "0");
            const clicks = parseInt(row.clicks || "0");
            const leads = extractLeads(row.actions);
            const cpl = leads > 0 ? spend / leads : 0;
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            const cpc = parseFloat(String(row.cpc || "0"));

            let label = "";
            let sublabel: string | undefined;

            switch (breakdownKey) {
                case "age_gender":
                    label = row.age || "Desconhecido";
                    sublabel = row.gender === "male" ? "Masculino" : row.gender === "female" ? "Feminino" : row.gender || "Todos";
                    break;
                case "region":
                    label = row.region || "Desconhecido";
                    sublabel = row.country;
                    break;
                case "device":
                    label = row.device_platform === "mobile_app" || row.device_platform === "mobile_web" ? "Mobile" :
                        row.device_platform === "desktop" ? "Desktop" :
                            row.device_platform || "Desconhecido";
                    break;
                case "platform":
                    label = row.publisher_platform === "facebook" ? "Facebook" :
                        row.publisher_platform === "instagram" ? "Instagram" :
                            row.publisher_platform === "audience_network" ? "Audience Network" :
                                row.publisher_platform === "messenger" ? "Messenger" :
                                    row.publisher_platform || "Outro";
                    sublabel = row.platform_position ? row.platform_position.replace(/_/g, " ") : undefined;
                    break;
            }

            return { label, sublabel, spend, impressions, clicks, leads, cpl, ctr, cpc };
        });

        return NextResponse.json({ data: rows, breakdown: breakdownKey });
    } catch (e) {
        return NextResponse.json({ data: [], error: String(e) }, { status: 500 });
    }
}
