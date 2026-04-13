/**
 * GET /api/meta-audiences
 * Puxa targeting de cada adset (interesses, públicos, demografias)
 * e cruza com performance de insights.
 */
import { NextResponse } from "next/server";
import { metaFetchPaginated } from "@/lib/meta-fetch";

export const revalidate = 300; // 5 min cache

interface MetaTargetingItem {
    id: string;
    name: string;
}

interface MetaAdSetRaw {
    id: string;
    name: string;
    status: string;
    campaign?: { id: string; name: string; objective?: string };
    targeting?: {
        age_min?: number;
        age_max?: number;
        genders?: number[];
        geo_locations?: {
            countries?: string[];
            cities?: { key: string; name: string }[];
            regions?: { key: string; name: string }[];
        };
        interests?: MetaTargetingItem[];
        behaviors?: MetaTargetingItem[];
        custom_audiences?: MetaTargetingItem[];
        excluded_custom_audiences?: MetaTargetingItem[];
        flexible_spec?: Array<{
            interests?: MetaTargetingItem[];
            behaviors?: MetaTargetingItem[];
        }>;
        publisher_platforms?: string[];
    };
}

export interface AudienceItem {
    tipo: "interest" | "behavior" | "custom_audience" | "lookalike";
    id: string;
    name: string;
}

export interface AdSetAudience {
    adset_id: string;
    adset_name: string;
    campaign_id: string;
    campaign_name: string;
    status: string;
    age_min?: number;
    age_max?: number;
    genders?: string[];
    locations?: string[];
    audiences: AudienceItem[];
}

export async function GET() {
    const result = await metaFetchPaginated<MetaAdSetRaw>({
        endpoint: "adsets",
        fields: "id,name,status,campaign{id,name,objective},targeting",
        params: { limit: "500" },
    });

    if (result.error && result.data.length === 0) {
        return NextResponse.json({ data: [], error: result.error }, { status: 500 });
    }

    const adsets: AdSetAudience[] = result.data
        .filter((as) => as.status !== "DELETED")
        .map((as) => {
            const t = as.targeting;
            const audiences: AudienceItem[] = [];

            // Direct interests
            if (t?.interests) {
                for (const i of t.interests) {
                    audiences.push({ tipo: "interest", id: i.id, name: i.name });
                }
            }

            // Flexible spec interests/behaviors
            if (t?.flexible_spec) {
                for (const spec of t.flexible_spec) {
                    if (spec.interests) {
                        for (const i of spec.interests) {
                            if (!audiences.find((a) => a.id === i.id)) {
                                audiences.push({ tipo: "interest", id: i.id, name: i.name });
                            }
                        }
                    }
                    if (spec.behaviors) {
                        for (const b of spec.behaviors) {
                            if (!audiences.find((a) => a.id === b.id)) {
                                audiences.push({ tipo: "behavior", id: b.id, name: b.name });
                            }
                        }
                    }
                }
            }

            // Behaviors
            if (t?.behaviors) {
                for (const b of t.behaviors) {
                    if (!audiences.find((a) => a.id === b.id)) {
                        audiences.push({ tipo: "behavior", id: b.id, name: b.name });
                    }
                }
            }

            // Custom audiences
            if (t?.custom_audiences) {
                for (const ca of t.custom_audiences) {
                    const isLookalike = ca.name?.toLowerCase().includes("lookalike") || ca.name?.toLowerCase().includes("semelhante");
                    audiences.push({ tipo: isLookalike ? "lookalike" : "custom_audience", id: ca.id, name: ca.name });
                }
            }

            // Gender mapping
            const genderMap: Record<number, string> = { 1: "Masculino", 2: "Feminino" };
            const genders = t?.genders?.map((g) => genderMap[g] || `${g}`);

            // Locations
            const locations: string[] = [];
            if (t?.geo_locations?.countries) locations.push(...t.geo_locations.countries);
            if (t?.geo_locations?.cities) locations.push(...t.geo_locations.cities.map((c) => c.name));
            if (t?.geo_locations?.regions) locations.push(...t.geo_locations.regions.map((r) => r.name));

            return {
                adset_id: as.id,
                adset_name: as.name,
                campaign_id: as.campaign?.id || "",
                campaign_name: as.campaign?.name || "",
                status: as.status,
                age_min: t?.age_min,
                age_max: t?.age_max,
                genders,
                locations: locations.length > 0 ? locations : undefined,
                audiences,
            };
        });

    return NextResponse.json({ data: adsets, error: result.error });
}
