import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
);

const META_BASE = "https://graph.facebook.com/v21.0";
const TOKEN = () => process.env.META_ADS_ACCESS_TOKEN || "";
const ACCOUNT_ID = "act_2851365261838044";

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  account_id: string;
}

async function fetchMetaCampaigns(): Promise<MetaCampaign[]> {
  const token = TOKEN();
  if (!token) return [];

  const all: MetaCampaign[] = [];
  let nextUrl: string | null = `${META_BASE}/${ACCOUNT_ID}/campaigns?fields=id,name,status,account_id&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]&limit=500&access_token=${token}`;

  while (nextUrl) {
    const resp: Response = await fetch(nextUrl);
    if (!resp.ok) break;
    const json = await resp.json() as { data?: MetaCampaign[]; paging?: { next?: string } };
    all.push(...(json.data || []));
    nextUrl = json.paging?.next || null;
  }

  return all;
}

function tryMatch(
  campaignName: string,
  nichos: { id: string; nome: string }[],
  teses: { id: string; nome: string; nicho_id: string }[],
): { nicho_id: string | null; tese_id: string | null; matched: boolean } {
  const norm = normalize(campaignName);

  let bestNicho: { id: string; nome: string } | null = null;
  let bestNichoLen = 0;

  for (const n of nichos) {
    const nn = normalize(n.nome);
    if (norm.includes(nn) && nn.length > bestNichoLen) {
      bestNicho = n;
      bestNichoLen = nn.length;
    }
  }

  if (!bestNicho) return { nicho_id: null, tese_id: null, matched: false };

  // Procura tese do nicho encontrado
  const tesesDoNicho = teses.filter((t) => t.nicho_id === bestNicho!.id);
  let bestTese: { id: string; nome: string } | null = null;
  let bestTeseLen = 0;

  for (const t of tesesDoNicho) {
    const tn = normalize(t.nome);
    if (norm.includes(tn) && tn.length > bestTeseLen) {
      bestTese = t;
      bestTeseLen = tn.length;
    }
  }

  if (!bestTese) return { nicho_id: bestNicho.id, tese_id: null, matched: false };

  return { nicho_id: bestNicho.id, tese_id: bestTese.id, matched: true };
}

// GET: busca campanhas Meta e faz match
export async function GET() {
  try {
    // Buscar catálogo e campanhas em paralelo
    const [campaigns, { data: nichos }, { data: teses }, { data: existentes }] = await Promise.all([
      fetchMetaCampaigns(),
      supabase.from("nichos").select("id, nome").is("deleted_at", null),
      supabase.from("teses").select("id, nome, nicho_id").is("deleted_at", null),
      supabase.from("campanhas_nichos").select("*").is("deleted_at", null),
    ]);

    const existMap = new Map((existentes || []).map((e: { campaign_id: string }) => [e.campaign_id, e]));

    const matched: unknown[] = [];
    const unmatched: unknown[] = [];
    const confirmed: unknown[] = [];

    for (const camp of campaigns) {
      const exist = existMap.get(camp.id) as { confirmado: boolean; vinculo_automatico: boolean; nicho_id: string | null; tese_id: string | null; id: string } | undefined;

      if (exist?.confirmado) {
        confirmed.push({ ...exist, campaign_name: camp.name, campaign_status: camp.status });
        continue;
      }

      if (exist && !exist.confirmado) {
        // Já processada, aguardando confirmação
        if (exist.vinculo_automatico) {
          matched.push({ ...exist, campaign_name: camp.name, campaign_status: camp.status });
        } else {
          unmatched.push({ ...exist, campaign_name: camp.name, campaign_status: camp.status });
        }
        continue;
      }

      // Nova campanha — tentar match
      const result = tryMatch(camp.name, nichos || [], teses || []);

      const row = {
        campaign_id: camp.id,
        campaign_name: camp.name,
        cliente_id: null,
        nicho_id: result.nicho_id,
        tese_id: result.tese_id,
        vinculo_automatico: result.matched,
        confirmado: false,
      };

      const { data: inserted } = await supabase.from("campanhas_nichos").insert(row).select().single();

      if (result.matched) {
        matched.push({ ...(inserted || row), campaign_status: camp.status });
      } else {
        unmatched.push({ ...(inserted || row), campaign_status: camp.status });
      }
    }

    return NextResponse.json({
      matched,
      unmatched,
      confirmed,
      total: campaigns.length,
      pendentes: matched.length + unmatched.length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH: confirmar ou corrigir vínculo
export async function PATCH(req: NextRequest) {
  try {
    const { id, nicho_id, tese_id } = await req.json();
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

    const update: Record<string, unknown> = { confirmado: true };
    if (nicho_id !== undefined) update.nicho_id = nicho_id;
    if (tese_id !== undefined) update.tese_id = tese_id;

    const { error } = await supabase.from("campanhas_nichos").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
