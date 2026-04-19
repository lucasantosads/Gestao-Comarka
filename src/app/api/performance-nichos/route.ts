import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
);

const META_BASE = "https://graph.facebook.com/v21.0";
const TOKEN = () => process.env.META_ADS_ACCESS_TOKEN || "";
const ACCOUNT = () => process.env.META_ADS_ACCOUNT_ID || "";

interface SpendResult { campaign_id: string; spend: number; leads: number }

async function fetchMetaSpendByCampaigns(campaignIds: string[], since: string, until: string): Promise<SpendResult[]> {
  const token = TOKEN();
  if (!token || campaignIds.length === 0) return [];

  const results: SpendResult[] = [];
  // Batch: usar account-level insights com level=campaign e filtrar depois
  const params = new URLSearchParams({
    access_token: token,
    fields: "campaign_id,campaign_name,spend,actions",
    time_range: JSON.stringify({ since, until }),
    level: "campaign",
    limit: "500",
  });

  const account = ACCOUNT();
  let url: string | null = `${META_BASE}/${account}/insights?${params.toString()}`;
  const allRows: any[] = [];

  while (url) {
    const res: Response = await fetch(url);
    if (!res.ok) break;
    const body = await res.json() as { data?: any[]; paging?: { next?: string } };
    allRows.push(...(body.data || []));
    url = body.paging?.next || null;
  }

  const idSet = new Set(campaignIds);
  for (const row of allRows) {
    if (!idSet.has(row.campaign_id)) continue;
    let leads = 0;
    for (const a of (row.actions || []) as { action_type: string; value: string }[]) {
      if (["lead", "onsite_conversion.messaging_first_reply", "onsite_conversion.lead_grouped"].includes(a.action_type)) {
        leads += parseInt(a.value);
      }
    }
    results.push({ campaign_id: row.campaign_id, spend: parseFloat(row.spend || "0"), leads });
  }

  return results;
}

/**
 * GET /api/performance-nichos?since=...&until=...&mes=...
 * Retorna dados agregados de performance por nicho e tese.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const mes = searchParams.get("mes") || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const since = searchParams.get("since") || `${mes}-01`;
    const untilDate = new Date(since);
    untilDate.setMonth(untilDate.getMonth() + 1);
    untilDate.setDate(0);
    const until = searchParams.get("until") || untilDate.toISOString().slice(0, 10);

    // Buscar tudo em paralelo
    const [
      { data: nichos },
      { data: teses },
      { data: vinculos },
      { data: leads },
      { data: contratos },
      { data: lancamentos },
      { data: manualData },
      { data: clientesVinc },
    ] = await Promise.all([
      supabase.from("nichos").select("id, nome").is("deleted_at", null).order("nome"),
      supabase.from("teses").select("id, nome, nicho_id").is("deleted_at", null).order("nome"),
      supabase.from("campanhas_nichos").select("campaign_id, nicho_id, tese_id, cliente_id").eq("confirmado", true).is("deleted_at", null),
      supabase.from("leads_crm").select("id, nicho_id, tese_id, etapa, closer_id, mensalidade, valor_total_projeto, ad_id, campaign_id, created_at, ghl_created_at")
        .gte("ghl_created_at", since).lte("ghl_created_at", until + "T23:59:59"),
      supabase.from("contratos").select("id, mrr, mes_referencia, closer_id, cliente_nome")
        .gte("data_fechamento", since).lte("data_fechamento", until),
      supabase.from("lancamentos_diarios").select("reunioes_feitas, reunioes_agendadas, no_show, data")
        .gte("data", since).lte("data", until),
      supabase.from("performance_manual").select("*").eq("mes_referencia", mes),
      supabase.from("clientes_nichos_teses").select("cliente_id, nicho_id, tese_id").is("deleted_at", null),
    ]);

    // Investimento Meta por campanha
    const campaignIds = (vinculos || []).map((v: any) => v.campaign_id);
    const metaSpend = await fetchMetaSpendByCampaigns(campaignIds, since, until);

    // Map campaign → nicho/tese
    const campMap = new Map<string, { nicho_id: string | null; tese_id: string | null }>();
    for (const v of vinculos || []) campMap.set(v.campaign_id, { nicho_id: v.nicho_id, tese_id: v.tese_id });

    // Agregar spend por nicho e tese
    const spendByNicho = new Map<string, { spend: number; metaLeads: number }>();
    const spendByTese = new Map<string, { spend: number; metaLeads: number }>();

    for (const ms of metaSpend) {
      const vinc = campMap.get(ms.campaign_id);
      if (!vinc) continue;
      if (vinc.nicho_id) {
        const cur = spendByNicho.get(vinc.nicho_id) || { spend: 0, metaLeads: 0 };
        cur.spend += ms.spend;
        cur.metaLeads += ms.leads;
        spendByNicho.set(vinc.nicho_id, cur);
      }
      if (vinc.tese_id) {
        const cur = spendByTese.get(vinc.tese_id) || { spend: 0, metaLeads: 0 };
        cur.spend += ms.spend;
        cur.metaLeads += ms.leads;
        spendByTese.set(vinc.tese_id, cur);
      }
    }

    // Leads por nicho/tese
    const leadsByNicho = new Map<string, any[]>();
    const leadsByTese = new Map<string, any[]>();
    const leadsNaoAtribuidos: any[] = [];

    for (const l of leads || []) {
      if (l.nicho_id) {
        const arr = leadsByNicho.get(l.nicho_id) || [];
        arr.push(l);
        leadsByNicho.set(l.nicho_id, arr);
      }
      if (l.tese_id) {
        const arr = leadsByTese.get(l.tese_id) || [];
        arr.push(l);
        leadsByTese.set(l.tese_id, arr);
      }
      if (!l.nicho_id) leadsNaoAtribuidos.push(l);
    }

    // Lancamentos totais
    const totalReunioes = { feitas: 0, agendadas: 0, noShow: 0 };
    for (const l of lancamentos || []) {
      totalReunioes.feitas += l.reunioes_feitas || 0;
      totalReunioes.agendadas += l.reunioes_agendadas || 0;
      totalReunioes.noShow += l.no_show || 0;
    }

    // LTV de contratos
    const totalLtv = (contratos || []).reduce((s: number, c: any) => s + (Number(c.mrr) || 0) * 6, 0);

    // Totais globais
    let totalSpend = 0, totalMetaLeads = 0;
    spendByNicho.forEach((v) => { totalSpend += v.spend; totalMetaLeads += v.metaLeads; });
    // Inclui spend de campanhas sem vínculo de nicho
    for (const ms of metaSpend) {
      if (!campMap.get(ms.campaign_id)?.nicho_id) {
        totalSpend += ms.spend;
        totalMetaLeads += ms.leads;
      }
    }

    const totalLeads = (leads || []).length;
    const totalComprou = (leads || []).filter((l: any) => l.etapa === "comprou").length;

    // Performance por nicho
    const porNicho = (nichos || []).map((n: any) => {
      const sp = spendByNicho.get(n.id) || { spend: 0, metaLeads: 0 };
      const ls = leadsByNicho.get(n.id) || [];
      const comprou = ls.filter((l: any) => l.etapa === "comprou").length;
      const man = (manualData || []).filter((m: any) => m.nicho_id === n.id && !m.tese_id);
      return {
        id: n.id, nome: n.nome,
        investimento: sp.spend, metaLeads: sp.metaLeads,
        leads: ls.length, comprou,
        cpl: ls.length > 0 ? sp.spend / ls.length : 0,
        conversao: ls.length > 0 ? (comprou / ls.length) * 100 : 0,
        contratos_manual: man.reduce((s: number, m: any) => s + (m.contratos_fechados || 0), 0),
        faturamento_manual: man.reduce((s: number, m: any) => s + Number(m.faturamento_total || 0), 0),
      };
    });

    // Performance por tese
    const porTese = (teses || []).map((t: any) => {
      const sp = spendByTese.get(t.id) || { spend: 0, metaLeads: 0 };
      const ls = leadsByTese.get(t.id) || [];
      const comprou = ls.filter((l: any) => l.etapa === "comprou").length;
      const man = (manualData || []).filter((m: any) => m.tese_id === t.id);
      const nichoNome = (nichos || []).find((n: any) => n.id === t.nicho_id)?.nome || "";
      return {
        id: t.id, nome: t.nome, nicho_id: t.nicho_id, nicho_nome: nichoNome,
        investimento: sp.spend, metaLeads: sp.metaLeads,
        leads: ls.length, comprou,
        cpl: ls.length > 0 ? sp.spend / ls.length : 0,
        conversao: ls.length > 0 ? (comprou / ls.length) * 100 : 0,
        contratos_manual: man.reduce((s: number, m: any) => s + (m.contratos_fechados || 0), 0),
        faturamento_manual: man.reduce((s: number, m: any) => s + Number(m.faturamento_total || 0), 0),
      };
    });

    return NextResponse.json({
      global: {
        investimento: totalSpend,
        leads: totalLeads,
        metaLeads: totalMetaLeads,
        cpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
        reunioes: totalReunioes,
        conversao: totalLeads > 0 ? (totalComprou / totalLeads) * 100 : 0,
        roas: totalSpend > 0 && totalLtv > 0 ? totalLtv / totalSpend : null,
        ltv: totalLtv,
        contratos: (contratos || []).length,
      },
      porNicho,
      porTese,
      naoAtribuidos: leadsNaoAtribuidos.length,
      leadsNaoAtribuidos: leadsNaoAtribuidos.slice(0, 100).map((l: any) => ({ id: l.id, nome: l.nome || "—", etapa: l.etapa })),
      clientesVinculos: clientesVinc || [],
      mes,
      since,
      until,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH — salvar performance_manual
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { nicho_id, tese_id, cliente_id, mes_referencia, contratos_fechados, faturamento_total } = body;
    if (!mes_referencia) return NextResponse.json({ error: "mes_referencia obrigatório" }, { status: 400 });

    const { data, error } = await supabase.from("performance_manual").upsert({
      nicho_id: nicho_id || null,
      tese_id: tese_id || null,
      cliente_id: cliente_id || null,
      mes_referencia,
      contratos_fechados: contratos_fechados || 0,
      faturamento_total: faturamento_total || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "nicho_id,tese_id,cliente_id,mes_referencia" }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
