import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

const META_BASE = "https://graph.facebook.com/v21.0";

const ETAPAS_QUALIFICADAS = [
  "reuniao_agendada",
  "follow_up",
  "proposta_enviada",
  "assinatura_contrato",
  "comprou",
];

type Periodo = "mes_atual" | "3m" | "6m" | "12m";
type Comparativo = "periodo_anterior" | "mesmo_periodo_ano_anterior";

function resolvePeriodo(p: Periodo): { since: Date; until: Date } {
  const until = new Date();
  const since = new Date(until);
  if (p === "mes_atual") {
    since.setDate(1);
  } else if (p === "3m") {
    since.setMonth(since.getMonth() - 2);
    since.setDate(1);
  } else if (p === "6m") {
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
  } else {
    since.setMonth(since.getMonth() - 11);
    since.setDate(1);
  }
  return { since, until };
}

function shiftRange(r: { since: Date; until: Date }, modo: Comparativo) {
  const since = new Date(r.since);
  const until = new Date(r.until);
  if (modo === "mesmo_periodo_ano_anterior") {
    since.setFullYear(since.getFullYear() - 1);
    until.setFullYear(until.getFullYear() - 1);
  } else {
    const diff = r.until.getTime() - r.since.getTime();
    until.setTime(r.since.getTime() - 86400000);
    since.setTime(until.getTime() - diff);
  }
  return { since, until };
}

function toIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function mesesEntre(since: Date, until: Date): string[] {
  const out: string[] = [];
  const cur = new Date(since);
  cur.setDate(1);
  const fim = new Date(until.getFullYear(), until.getMonth(), 1);
  while (cur <= fim) {
    out.push(cur.toISOString().slice(0, 7));
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

async function fetchCampaignRange(
  campaignId: string,
  since: string,
  until: string
): Promise<{ spend: number; leads: number } | null> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) return null;
  const params = new URLSearchParams({
    access_token: token,
    fields: "spend,actions",
    time_range: JSON.stringify({ since, until }),
    level: "campaign",
  });
  try {
    const res = await fetch(`${META_BASE}/${campaignId}/insights?${params.toString()}`);
    if (!res.ok) return null;
    const body = await res.json();
    const row = body.data?.[0];
    if (!row) return { spend: 0, leads: 0 };
    const spend = parseFloat(row.spend || "0");
    let leads = 0;
    for (const a of row.actions || []) {
      if (
        [
          "lead",
          "onsite_conversion.messaging_first_reply",
          "onsite_conversion.lead_grouped",
        ].includes(a.action_type)
      ) {
        leads += parseInt(a.value);
      }
    }
    return { spend, leads };
  } catch {
    return null;
  }
}

async function fetchCampaignMonthly(
  campaignId: string,
  since: string,
  until: string
): Promise<{ month: string; spend: number; leads: number }[]> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) return [];
  const params = new URLSearchParams({
    access_token: token,
    fields: "spend,actions",
    time_range: JSON.stringify({ since, until }),
    time_increment: "monthly",
    level: "campaign",
  });
  try {
    const res = await fetch(`${META_BASE}/${campaignId}/insights?${params.toString()}`);
    if (!res.ok) return [];
    const body = await res.json();
    return (body.data || []).map((row: { date_start: string; spend: string; actions?: { action_type: string; value: string }[] }) => {
      let leads = 0;
      for (const a of row.actions || []) {
        if (
          [
            "lead",
            "onsite_conversion.messaging_first_reply",
            "onsite_conversion.lead_grouped",
          ].includes(a.action_type)
        ) {
          leads += parseInt(a.value);
        }
      }
      return {
        month: row.date_start?.slice(0, 7) || "",
        spend: parseFloat(row.spend || "0"),
        leads,
      };
    });
  } catch {
    return [];
  }
}

/**
 * GET /api/clientes/[id]/performance?periodo=mes_atual|3m|6m|12m&comparativo=periodo_anterior|mesmo_periodo_ano_anterior
 *
 * [id] = clientes_receita.id (entrada_id).
 * Retorna:
 *  - cliente (cadastro + mirror com novos campos)
 *  - metricas_periodo: spend, leads, cpl, roas, taxa_qualif, pct_meta
 *  - metricas_comparativo: mesmo bloco do período comparativo
 *  - historico_mensal: últimos 12m de spend/leads/cpl
 *  - leads_individuais: leads_crm do período (ordenado por data desc)
 *  - timeline: otimizacoes + reunioes (com snapshot)
 *  - teses, alertas, meta_historico
 *  - benchmark_nicho (CPL e ROAS médio dos outros do mesmo nicho, anonimizados)
 *  - alerta_sem_leads (spend > 0 e 0 leads nos últimos 3 dias)
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const periodo = (searchParams.get("periodo") || "mes_atual") as Periodo;
    const comparativo = (searchParams.get("comparativo") || "periodo_anterior") as Comparativo;

    const range = resolvePeriodo(periodo);
    const comp = shiftRange(range, comparativo);

    const { data: entrada, error: errE } = await supabase
      .from("clientes_receita")
      .select("id, nome, status_financeiro, valor_mensal, categoria")
      .eq("id", id)
      .maybeSingle();
    if (errE) return NextResponse.json({ error: errE.message }, { status: 500 });
    if (!entrada) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const { data: mirror, error: errM } = await supabase
      .from("clientes_notion_mirror")
      .select(
        "notion_id, entrada_id, cliente, status, situacao, nicho, analista, fb_url, gads_url, tiktok_url, otimizacao, meta_campaign_id, meta_adset_id, meta_leads_mes, meta_leads_semana, meta_roas_minimo, score_saude, score_calculado_em, risco_churn, risco_churn_motivo, risco_churn_acao, risco_calculado_em"
      )
      .eq("entrada_id", id)
      .maybeSingle();
    if (errM) return NextResponse.json({ error: errM.message }, { status: 500 });

    const notionId = mirror?.notion_id || null;
    const campaignId = mirror?.meta_campaign_id || null;

    // Satélites
    const [
      { data: teses },
      { data: otims },
      { data: reunioes },
      { data: alertas },
      { data: metaHist },
    ] = await Promise.all([
      notionId
        ? supabase
            .from("clientes_teses")
            .select("id, nome_tese, tipo, status, orcamento, data_ativacao, observacoes")
            .eq("notion_id", notionId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      notionId
        ? supabase
            .from("otimizacoes_historico")
            .select(
              "id, data, data_confirmacao, feito, comentarios, proxima_vez, solicitado, snapshot_metricas"
            )
            .eq("notion_id", notionId)
            .is("deleted_at", null)
            .order("data", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] }),
      notionId
        ? supabase
            .from("reunioes_cliente")
            .select("id, data_reuniao, resumo, tipo, snapshot_metricas")
            .eq("cliente_notion_id", notionId)
            .order("data_reuniao", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] }),
      notionId
        ? supabase
            .from("alertas_cliente")
            .select("id, tipo, mensagem, criado_em, metadata")
            .eq("cliente_notion_id", notionId)
            .is("resolvido_em", null)
            .order("criado_em", { ascending: false })
        : Promise.resolve({ data: [] }),
      notionId
        ? supabase
            .from("clientes_meta_historico")
            .select("meta_campaign_id, meta_adset_id, vigencia_inicio, vigencia_fim")
            .eq("cliente_notion_id", notionId)
            .order("vigencia_inicio", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    // ===== Leads do período e do comparativo (leads_crm por campaign_id) =====
    let totalLeads = 0;
    let qualificados = 0;
    let totalLeadsComp = 0;
    let qualificadosComp = 0;
    let leadsIndividuais: Array<{
      id: string;
      nome: string | null;
      etapa: string | null;
      telefone: string | null;
      ghl_created_at: string | null;
      valor_total_projeto: number | null;
    }> = [];

    if (campaignId) {
      const [{ data: leadsP }, { data: leadsC }] = await Promise.all([
        supabase
          .from("leads_crm")
          .select("id, nome, etapa, telefone, ghl_created_at, valor_total_projeto")
          .eq("campaign_id", campaignId)
          .gte("ghl_created_at", toIso(range.since) + "T00:00:00")
          .lte("ghl_created_at", toIso(range.until) + "T23:59:59")
          .order("ghl_created_at", { ascending: false })
          .limit(500),
        supabase
          .from("leads_crm")
          .select("id, etapa", { count: "exact" })
          .eq("campaign_id", campaignId)
          .gte("ghl_created_at", toIso(comp.since) + "T00:00:00")
          .lte("ghl_created_at", toIso(comp.until) + "T23:59:59"),
      ]);

      leadsIndividuais = (leadsP || []) as typeof leadsIndividuais;
      totalLeads = leadsIndividuais.length;
      qualificados = leadsIndividuais.filter((l) =>
        ETAPAS_QUALIFICADAS.includes(l.etapa || "")
      ).length;
      totalLeadsComp = (leadsC || []).length;
      qualificadosComp = (leadsC || []).filter((l) =>
        ETAPAS_QUALIFICADAS.includes(l.etapa || "")
      ).length;
    }

    // ===== Spend do período, comparativo e histórico mensal (Meta API) =====
    let spend = 0;
    let spendComp = 0;
    let historicoMensal: { month: string; spend: number; leads: number; cpl: number }[] = [];
    let historicoMensalAnoAnterior: { month: string; spend: number; leads: number }[] = [];

    if (campaignId) {
      // 12 meses para histórico principal
      const hist12since = new Date();
      hist12since.setMonth(hist12since.getMonth() - 11);
      hist12since.setDate(1);
      const hist12until = new Date();

      const [curRange, cmpRange, monthly, monthlyYA] = await Promise.all([
        fetchCampaignRange(campaignId, toIso(range.since), toIso(range.until)),
        fetchCampaignRange(campaignId, toIso(comp.since), toIso(comp.until)),
        fetchCampaignMonthly(campaignId, toIso(hist12since), toIso(hist12until)),
        // Histórico mês-a-mês do mesmo período do ano anterior (para comparativo de gráfico)
        fetchCampaignMonthly(
          campaignId,
          toIso(new Date(hist12since.getFullYear() - 1, hist12since.getMonth(), 1)),
          toIso(new Date(hist12until.getFullYear() - 1, hist12until.getMonth(), hist12until.getDate()))
        ),
      ]);

      spend = curRange?.spend || 0;
      spendComp = cmpRange?.spend || 0;

      // Merge leads_crm (qualif) com monthly Meta
      const mesesList = mesesEntre(hist12since, hist12until);
      const { data: leadsHist } = await supabase
        .from("leads_crm")
        .select("mes_referencia, etapa")
        .eq("campaign_id", campaignId)
        .in("mes_referencia", mesesList);
      const leadsPorMes = new Map<string, { total: number; qual: number }>();
      for (const l of leadsHist || []) {
        const m = (l.mes_referencia as string) || "";
        const b = leadsPorMes.get(m) || { total: 0, qual: 0 };
        b.total += 1;
        if (ETAPAS_QUALIFICADAS.includes(l.etapa || "")) b.qual += 1;
        leadsPorMes.set(m, b);
      }

      const monthlyMap = new Map(monthly.map((r) => [r.month, r]));
      historicoMensal = mesesList.map((mes) => {
        const meta = monthlyMap.get(mes);
        const leadsCrm = leadsPorMes.get(mes)?.total || 0;
        const spendMes = meta?.spend || 0;
        return {
          month: mes,
          spend: spendMes,
          leads: leadsCrm || meta?.leads || 0, // preferimos CRM; fallback Meta
          cpl: leadsCrm > 0 ? spendMes / leadsCrm : meta?.leads ? spendMes / meta.leads : 0,
        };
      });
      historicoMensalAnoAnterior = monthlyYA.map((r) => ({
        month: r.month,
        spend: r.spend,
        leads: r.leads,
      }));
    }

    const ltv = Number(entrada.valor_mensal || 0) * 12;
    const metricas_periodo = {
      spend,
      total_leads: totalLeads,
      leads_qualificados: qualificados,
      cpl: totalLeads > 0 ? spend / totalLeads : 0,
      roas: spend > 0 ? ltv / spend : 0,
      taxa_qualificacao: totalLeads > 0 ? qualificados / totalLeads : 0,
      pct_meta_leads: mirror?.meta_leads_mes
        ? Math.round((totalLeads / mirror.meta_leads_mes) * 100)
        : null,
    };
    const metricas_comparativo = {
      spend: spendComp,
      total_leads: totalLeadsComp,
      leads_qualificados: qualificadosComp,
      cpl: totalLeadsComp > 0 ? spendComp / totalLeadsComp : 0,
      roas: spendComp > 0 ? ltv / spendComp : 0,
      taxa_qualificacao: totalLeadsComp > 0 ? qualificadosComp / totalLeadsComp : 0,
    };

    // ===== Alerta "sem leads" (spend>0 e 0 leads nos últimos 3 dias) =====
    let alerta_sem_leads = false;
    if (campaignId) {
      const since3 = new Date();
      since3.setDate(since3.getDate() - 2);
      const r3 = await fetchCampaignRange(campaignId, toIso(since3), toIso(new Date()));
      const { count: leads3 } = await supabase
        .from("leads_crm")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .gte("ghl_created_at", toIso(since3) + "T00:00:00");
      alerta_sem_leads = (r3?.spend || 0) > 0 && (leads3 || 0) === 0;
    }

    // ===== Benchmark do nicho =====
    type BenchComparativo = {
      rotulo: string;
      score: number | null;
      cpl: number | null;
      roas: number | null;
      is_self: boolean;
    };
    let benchmark: {
      nicho: string | null;
      total_clientes: number;
      score_medio: number | null;
      cpl_medio: number | null;
      roas_medio: number | null;
      comparativo: BenchComparativo[];
    } = {
      nicho: mirror?.nicho || null,
      total_clientes: 0,
      score_medio: null,
      cpl_medio: null,
      roas_medio: null,
      comparativo: [],
    };

    if (mirror?.nicho) {
      const { data: pares } = await supabase
        .from("clientes_notion_mirror")
        .select("notion_id, cliente, score_saude, meta_campaign_id, entrada_id")
        .eq("nicho", mirror.nicho);

      // Para cada par, busca spend/leads do período e valor_mensal do entrada_id
      const entradaIds = (pares || []).map((p) => p.entrada_id).filter(Boolean) as string[];
      const { data: entradasPares } = entradaIds.length
        ? await supabase
            .from("clientes_receita")
            .select("id, valor_mensal")
            .in("id", entradaIds)
        : { data: [] };
      const valorPorEntrada = new Map<string, number>();
      for (const e of entradasPares || []) {
        valorPorEntrada.set(e.id, Number(e.valor_mensal || 0));
      }

      // Fetch spend em batch (chunk 8) só para os pares que têm campaign
      const pareCampaigns = (pares || [])
        .map((p) => p.meta_campaign_id)
        .filter((c): c is string => !!c);
      const spendPareMap = new Map<string, number>();
      const leadsPareMap = new Map<string, number>();

      if (pareCampaigns.length > 0) {
        // leads_crm agregado (uma query só)
        const { data: leadsPar } = await supabase
          .from("leads_crm")
          .select("campaign_id")
          .in("campaign_id", pareCampaigns)
          .gte("ghl_created_at", toIso(range.since) + "T00:00:00")
          .lte("ghl_created_at", toIso(range.until) + "T23:59:59");
        for (const l of leadsPar || []) {
          const cid = l.campaign_id as string;
          leadsPareMap.set(cid, (leadsPareMap.get(cid) || 0) + 1);
        }

        const chunks: string[][] = [];
        for (let i = 0; i < pareCampaigns.length; i += 8)
          chunks.push(pareCampaigns.slice(i, i + 8));
        for (const chunk of chunks) {
          await Promise.all(
            chunk.map(async (cid) => {
              const r = await fetchCampaignRange(cid, toIso(range.since), toIso(range.until));
              if (r) spendPareMap.set(cid, r.spend);
            })
          );
        }
      }

      const scores: number[] = [];
      const cpls: number[] = [];
      const roass: number[] = [];
      let letra = 0;
      const comparativo: BenchComparativo[] = (pares || [])
        .map((p) => {
          const cid = p.meta_campaign_id;
          const sp = cid ? spendPareMap.get(cid) || 0 : 0;
          const lp = cid ? leadsPareMap.get(cid) || 0 : 0;
          const ltvP = (valorPorEntrada.get(p.entrada_id || "") || 0) * 12;
          const cpl = lp > 0 ? sp / lp : null;
          const roasP = sp > 0 ? ltvP / sp : null;
          if (typeof p.score_saude === "number") scores.push(p.score_saude);
          if (cpl != null) cpls.push(cpl);
          if (roasP != null) roass.push(roasP);
          const isSelf = p.notion_id === notionId;
          return {
            rotulo: isSelf
              ? mirror.cliente || entrada.nome
              : `Cliente ${String.fromCharCode(65 + letra++)}`,
            score: p.score_saude ?? null,
            cpl,
            roas: roasP,
            is_self: isSelf,
          };
        })
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

      benchmark = {
        nicho: mirror.nicho,
        total_clientes: (pares || []).length,
        score_medio: scores.length
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null,
        cpl_medio: cpls.length ? cpls.reduce((a, b) => a + b, 0) / cpls.length : null,
        roas_medio: roass.length ? roass.reduce((a, b) => a + b, 0) / roass.length : null,
        comparativo,
      };
    }

    // ===== Timeline =====
    type TimelineItem = {
      tipo: "otimizacao" | "reuniao";
      data: string;
      titulo: string;
      detalhe: string | null;
      confirmado: boolean;
      snapshot: Record<string, unknown> | null;
    };
    const timeline: TimelineItem[] = [];
    for (const o of (otims || []) as Array<{
      data: string;
      comentarios: string | null;
      proxima_vez: string | null;
      solicitado: string | null;
      data_confirmacao: string | null;
      feito: string | null;
      snapshot_metricas: Record<string, unknown> | null;
    }>) {
      const detalheParts = [o.proxima_vez, o.solicitado].filter(Boolean).join(" — ");
      timeline.push({
        tipo: "otimizacao",
        data: o.data,
        titulo: o.comentarios || "Otimização",
        detalhe: detalheParts || null,
        confirmado: !!o.data_confirmacao || !!(o.feito && o.feito !== "Não"),
        snapshot: o.snapshot_metricas || null,
      });
    }
    for (const r of (reunioes || []) as Array<{
      data_reuniao: string;
      resumo: string | null;
      tipo: string | null;
      snapshot_metricas: Record<string, unknown> | null;
    }>) {
      timeline.push({
        tipo: "reuniao",
        data: r.data_reuniao,
        titulo: r.tipo || "Reunião",
        detalhe: r.resumo || null,
        confirmado: true,
        snapshot: r.snapshot_metricas || null,
      });
    }
    timeline.sort((a, b) => b.data.localeCompare(a.data));

    return NextResponse.json({
      periodo,
      comparativo,
      range: { since: toIso(range.since), until: toIso(range.until) },
      range_comparativo: { since: toIso(comp.since), until: toIso(comp.until) },
      cliente: {
        entrada_id: entrada.id,
        notion_id: notionId,
        nome: mirror?.cliente || entrada.nome,
        nicho: mirror?.nicho || null,
        categoria: entrada.categoria,
        status: mirror?.status || null,
        status_financeiro: entrada.status_financeiro,
        situacao: mirror?.situacao || null,
        analista: mirror?.analista || null,
        valor_mensal: Number(entrada.valor_mensal || 0),
        ltv_12m: ltv,
        meta_campaign_id: campaignId,
        meta_adset_id: mirror?.meta_adset_id || null,
        meta_leads_mes: mirror?.meta_leads_mes || null,
        meta_roas_minimo: mirror?.meta_roas_minimo || null,
        fb_url: mirror?.fb_url || null,
        gads_url: mirror?.gads_url || null,
        tiktok_url: mirror?.tiktok_url || null,
        score_saude: mirror?.score_saude ?? null,
        score_calculado_em: mirror?.score_calculado_em || null,
        risco_churn: mirror?.risco_churn || null,
        risco_churn_motivo: mirror?.risco_churn_motivo || null,
        risco_churn_acao: mirror?.risco_churn_acao || null,
        risco_calculado_em: mirror?.risco_calculado_em || null,
      },
      metricas_periodo,
      metricas_comparativo,
      historico_mensal: historicoMensal,
      historico_mensal_ano_anterior: historicoMensalAnoAnterior,
      leads_individuais: leadsIndividuais,
      alerta_sem_leads,
      teses: teses || [],
      timeline,
      benchmark,
      alertas: alertas || [],
      meta_historico: metaHist || [],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
