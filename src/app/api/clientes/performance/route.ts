import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

interface PeriodRange {
  since: string; // YYYY-MM-DD
  until: string;
  mesesRef: string[]; // lista de 'YYYY-MM' cobertos
}

function resolvePeriodo(p: Periodo): PeriodRange {
  const hoje = new Date();
  const until = hoje.toISOString().slice(0, 10);
  const since = new Date(hoje);

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

  const mesesRef: string[] = [];
  const cur = new Date(since);
  while (cur <= hoje) {
    mesesRef.push(cur.toISOString().slice(0, 7));
    cur.setMonth(cur.getMonth() + 1);
  }

  return { since: since.toISOString().slice(0, 10), until, mesesRef };
}

interface MetaInsightRow {
  spend: string;
  actions?: { action_type: string; value: string }[];
}

async function fetchCampaignSpend(
  campaignId: string,
  since: string,
  until: string
): Promise<{ spend: number; leadsMeta: number } | null> {
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
    const row = (body.data?.[0] as MetaInsightRow) || null;
    if (!row) return { spend: 0, leadsMeta: 0 };
    const spend = parseFloat(row.spend || "0");
    let leadsMeta = 0;
    for (const a of row.actions || []) {
      if (
        [
          "lead",
          "onsite_conversion.messaging_first_reply",
          "onsite_conversion.lead_grouped",
        ].includes(a.action_type)
      ) {
        leadsMeta += parseInt(a.value);
      }
    }
    return { spend, leadsMeta };
  } catch {
    return null;
  }
}

/**
 * GET /api/clientes/performance
 *   ?nicho=...&tese_id=...&risco=baixo|medio|alto&gestor_id=...&periodo=mes_atual|3m|6m|12m
 *
 * Retorna clientes ativos com métricas já calculadas server-side
 * (spend, leads, cpl, roas, taxa_qualificacao, pct_meta_leads, dias_sem_otimizacao, dias_sem_lead).
 * Spend vem sempre direto da Meta API (campaign-level), nunca do n8n sync.
 *
 * Filtro por gestor: se o usuário logado não for admin, força filtro pelo seu próprio
 * nome em clientes_notion_mirror.analista (o projeto não tem tabela `gestores`; analista
 * é o texto do nome do employee responsável pelo cliente).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filtroNicho = searchParams.get("nicho");
    const filtroTeseId = searchParams.get("tese_id");
    const filtroRisco = searchParams.get("risco") as "baixo" | "medio" | "alto" | null;
    const filtroGestorId = searchParams.get("gestor_id"); // uuid de employees
    const periodo = (searchParams.get("periodo") || "mes_atual") as Periodo;

    const range = resolvePeriodo(periodo);

    const session = await getSession();
    const isAdmin = session?.role === "admin";

    // Resolve filtro de analista (por nome) a partir de gestor_id ou sessão
    let filtroAnalistaNome: string | null = null;
    if (filtroGestorId) {
      const { data: emp } = await supabase
        .from("employees")
        .select("nome")
        .eq("id", filtroGestorId)
        .maybeSingle();
      filtroAnalistaNome = emp?.nome || null;
    } else if (!isAdmin && session?.nome) {
      filtroAnalistaNome = session.nome;
    }

    // Queries base
    const [
      { data: entradas, error: errEntradas },
      { data: mirror, error: errMirror },
      { data: teses, error: errTeses },
      { data: otims, error: errOtims },
      { data: reunioes, error: errReun },
    ] = await Promise.all([
      supabase
        .from("clientes_receita")
        .select("id, nome, status_financeiro, valor_mensal, categoria"),
      supabase
        .from("clientes_notion_mirror")
        .select(
          "notion_id, entrada_id, cliente, status, situacao, nicho, analista, fb_url, gads_url, tiktok_url, otimizacao, meta_campaign_id, meta_adset_id, meta_leads_mes, meta_leads_semana, meta_roas_minimo, score_saude, score_calculado_em, risco_churn, risco_churn_motivo, risco_churn_acao, risco_calculado_em"
        ),
      supabase
        .from("clientes_teses")
        .select("id, notion_id, nome_tese, tipo, status, orcamento")
        .is("deleted_at", null),
      supabase
        .from("otimizacoes_historico")
        .select("notion_id, data, data_confirmacao")
        .is("deleted_at", null)
        .order("data", { ascending: false }),
      supabase
        .from("reunioes_cliente")
        .select("cliente_notion_id, data_reuniao")
        .order("data_reuniao", { ascending: false })
        .limit(1000),
    ]);

    if (errEntradas) return NextResponse.json({ error: errEntradas.message }, { status: 500 });
    if (errMirror) return NextResponse.json({ error: errMirror.message }, { status: 500 });
    if (errTeses) return NextResponse.json({ error: errTeses.message }, { status: 500 });
    if (errOtims) return NextResponse.json({ error: errOtims.message }, { status: 500 });
    if (errReun) return NextResponse.json({ error: errReun.message }, { status: 500 });

    const operacionais = (entradas || []).filter((e) =>
      ["ativo", "pausado", "pagou_integral", "parceria"].includes(e.status_financeiro || "")
    );

    const mirrorByEntrada = new Map<string, NonNullable<typeof mirror>[number]>();
    for (const m of mirror || []) {
      if (m.entrada_id) mirrorByEntrada.set(m.entrada_id, m);
    }

    // Tese ativa + todas teses por notion_id
    const tesePorNotion = new Map<
      string,
      { id: string; nome_tese: string; tipo: string | null; orcamento: number }
    >();
    const orcamentoTesesPorNotion = new Map<string, number>();
    const teseIdPorNotion = new Map<string, Set<string>>();
    for (const t of teses || []) {
      if (!t.notion_id) continue;
      orcamentoTesesPorNotion.set(
        t.notion_id,
        (orcamentoTesesPorNotion.get(t.notion_id) || 0) + Number(t.orcamento || 0)
      );
      if (!teseIdPorNotion.has(t.notion_id)) teseIdPorNotion.set(t.notion_id, new Set());
      teseIdPorNotion.get(t.notion_id)!.add(t.id);
      if (t.status === "Ativa" && !tesePorNotion.has(t.notion_id)) {
        tesePorNotion.set(t.notion_id, {
          id: t.id,
          nome_tese: t.nome_tese,
          tipo: t.tipo,
          orcamento: Number(t.orcamento || 0),
        });
      }
    }

    const otimPorNotion = new Map<string, { data: string; data_confirmacao: string | null }>();
    for (const o of otims || []) {
      if (!otimPorNotion.has(o.notion_id)) {
        otimPorNotion.set(o.notion_id, { data: o.data, data_confirmacao: o.data_confirmacao });
      }
    }

    const reuniaoPorNotion = new Map<string, string>();
    for (const r of reunioes || []) {
      if (!reuniaoPorNotion.has(r.cliente_notion_id)) {
        reuniaoPorNotion.set(r.cliente_notion_id, r.data_reuniao);
      }
    }

    // Pré-carrega leads do período de TODOS os clientes operacionais em uma query
    // (filtrando por mes_referencia — mais rápido que múltiplos selects)
    const { data: leadsPeriodo } = await supabase
      .from("leads_crm")
      .select("campaign_id, etapa, mes_referencia, ghl_created_at")
      .in("mes_referencia", range.mesesRef)
      .not("campaign_id", "is", null);

    // Agrega leads por campaign_id
    const leadsPorCampanha = new Map<
      string,
      { total: number; qualificados: number; ultimaData: string | null }
    >();
    for (const l of leadsPeriodo || []) {
      const cid = l.campaign_id as string;
      if (!cid) continue;
      const bucket = leadsPorCampanha.get(cid) || {
        total: 0,
        qualificados: 0,
        ultimaData: null,
      };
      bucket.total += 1;
      if (ETAPAS_QUALIFICADAS.includes(l.etapa || "")) bucket.qualificados += 1;
      const d = l.ghl_created_at as string | null;
      if (d && (!bucket.ultimaData || d > bucket.ultimaData)) bucket.ultimaData = d;
      leadsPorCampanha.set(cid, bucket);
    }

    // Spend Meta por campanha (batch com dedupe de campaign_ids)
    const campaignIds = new Set<string>();
    for (const e of operacionais) {
      const m = mirrorByEntrada.get(e.id);
      if (m?.meta_campaign_id) campaignIds.add(m.meta_campaign_id);
    }

    const spendPorCampanha = new Map<string, { spend: number; leadsMeta: number }>();
    // Paraleliza com limite (Meta rate-limits). Chunk de 8.
    const chunks: string[][] = [];
    const idsArr = Array.from(campaignIds);
    for (let i = 0; i < idsArr.length; i += 8) chunks.push(idsArr.slice(i, i + 8));
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (cid) => {
          const r = await fetchCampaignSpend(cid, range.since, range.until);
          if (r) spendPorCampanha.set(cid, r);
        })
      );
    }

    const hoje = new Date();
    const diasDesde = (iso: string | null) => {
      if (!iso) return null;
      return Math.floor((hoje.getTime() - new Date(iso).getTime()) / 86400000);
    };

    let payload = operacionais.map((e) => {
      const m = mirrorByEntrada.get(e.id) || null;
      const notionId = m?.notion_id || null;
      const tese = notionId ? tesePorNotion.get(notionId) || null : null;
      const teseIds = notionId ? teseIdPorNotion.get(notionId) || new Set<string>() : new Set<string>();
      const ultimaOtim = notionId ? otimPorNotion.get(notionId) || null : null;
      const ultimaReun = notionId ? reuniaoPorNotion.get(notionId) || null : null;

      const campaignId = m?.meta_campaign_id || null;
      const spendInfo = campaignId ? spendPorCampanha.get(campaignId) : null;
      const leadsInfo = campaignId ? leadsPorCampanha.get(campaignId) : null;

      const spend = spendInfo?.spend ?? 0;
      const total_leads = leadsInfo?.total ?? 0;
      const qualificados = leadsInfo?.qualificados ?? 0;
      const cpl = total_leads > 0 ? spend / total_leads : 0;
      const ltv = Number(e.valor_mensal || 0) * 12;
      const roas = spend > 0 ? ltv / spend : 0;
      const taxa_qualificacao = total_leads > 0 ? qualificados / total_leads : 0;
      const pct_meta_leads = m?.meta_leads_mes
        ? Math.round((total_leads / m.meta_leads_mes) * 100)
        : null;
      const dias_sem_lead = diasDesde(leadsInfo?.ultimaData || null);
      const dias_sem_otimizacao = diasDesde(
        ultimaOtim?.data_confirmacao || ultimaOtim?.data || m?.otimizacao || null
      );

      return {
        entrada_id: e.id,
        notion_id: notionId,
        nome: e.nome,
        nicho: m?.nicho || null,
        categoria: e.categoria || null,
        status: m?.status || null,
        status_financeiro: e.status_financeiro,
        situacao: m?.situacao || null,
        analista: m?.analista || null,
        valor_mensal: Number(e.valor_mensal || 0),
        tese_ativa: tese,
        tese_ids: Array.from(teseIds),
        orcamento_teses: notionId ? orcamentoTesesPorNotion.get(notionId) || 0 : 0,
        meta_campaign_id: campaignId,
        meta_adset_id: m?.meta_adset_id || null,
        meta_leads_mes: m?.meta_leads_mes || null,
        meta_roas_minimo: m?.meta_roas_minimo || null,
        fb_url: m?.fb_url || null,
        gads_url: m?.gads_url || null,
        tiktok_url: m?.tiktok_url || null,
        score_saude: m?.score_saude ?? null,
        score_calculado_em: m?.score_calculado_em || null,
        risco_churn: m?.risco_churn || null,
        risco_churn_motivo: m?.risco_churn_motivo || null,
        risco_churn_acao: m?.risco_churn_acao || null,
        risco_calculado_em: m?.risco_calculado_em || null,
        ultima_otimizacao: ultimaOtim?.data || m?.otimizacao || null,
        ultima_otimizacao_confirmada_em: ultimaOtim?.data_confirmacao || null,
        dias_sem_otimizacao,
        ultima_reuniao: ultimaReun,
        dias_sem_reuniao: diasDesde(ultimaReun),
        dias_sem_lead,
        // Métricas calculadas server-side
        spend_periodo: spend,
        total_leads,
        leads_qualificados: qualificados,
        cpl,
        roas,
        taxa_qualificacao,
        pct_meta_leads,
        alerta_sem_leads: spend > 0 && total_leads === 0,
      };
    });

    // Filtros
    if (filtroNicho) payload = payload.filter((c) => c.nicho === filtroNicho);
    if (filtroTeseId) payload = payload.filter((c) => c.tese_ids.includes(filtroTeseId));
    if (filtroRisco) payload = payload.filter((c) => c.risco_churn === filtroRisco);
    if (filtroAnalistaNome)
      payload = payload.filter(
        (c) => (c.analista || "").trim().toLowerCase() === filtroAnalistaNome!.trim().toLowerCase()
      );

    return NextResponse.json({
      periodo,
      range,
      total: payload.length,
      filtrado_por_gestor: !isAdmin && !!filtroAnalistaNome ? filtroAnalistaNome : null,
      clientes: payload,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
