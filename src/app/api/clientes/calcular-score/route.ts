/**
 * POST /api/clientes/calcular-score
 * Protegido por CRON_SECRET (header Authorization: Bearer <secret>).
 * Agendado: segunda-feira 08h (ver vercel.json).
 *
 * Fórmula (0-100):
 *  - 30 pts: variação de CPL semana atual vs. anterior
 *            (igual ou menor = 30; cada 10% de aumento = -5; mínimo 0)
 *  - 25 pts: leads vs. meta_leads_mes (100% = 25, proporcional)
 *            Se meta nula, usa média dos últimos 3 meses como referência.
 *  - 25 pts: taxa de qualificação
 *            (>= 40% = 25, >= 30% = 18, >= 20% = 12, abaixo = 5)
 *  - 20 pts: regularidade de otimização
 *            (<= 7 dias = 20, 8-14 dias = 10, 15+ = 0)
 *
 * Regras:
 *  - Só calcula para clientes_notion_mirror.status NOT IN ('Cancelado','Pausado','Não iniciado')
 *  - Não executa aos sábados/domingos
 *  - Soft failures: um cliente com erro não derruba o batch
 *
 * Obs: spend vem via Meta API direta (campaign-level) conforme regra global.
 *      Quem não tem meta_campaign_id preenchido recebe pontuação parcial
 *      baseada apenas em leads + qualificação + otimização (75 pts max).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

const META_BASE = "https://graph.facebook.com/v21.0";

// Etapas que contam como "lead qualificado" em leads_crm (inferido do código existente)
const ETAPAS_QUALIFICADAS = [
  "reuniao_agendada",
  "follow_up",
  "proposta_enviada",
  "assinatura_contrato",
  "comprou",
];

interface CampaignMetrics {
  spend: number;
  leads: number;
  cpl: number;
}

async function fetchCampaignMetrics(
  campaignId: string,
  since: string,
  until: string
): Promise<CampaignMetrics | null> {
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
    if (!row) return { spend: 0, leads: 0, cpl: 0 };

    const spend = parseFloat(row.spend || "0");
    let leads = 0;
    const actions = row.actions as { action_type: string; value: string }[] | undefined;
    if (actions) {
      for (const a of actions) {
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
    }
    return { spend, leads, cpl: leads > 0 ? spend / leads : 0 };
  } catch {
    return null;
  }
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function diasAtras(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function scoreCplVariation(cplAtual: number, cplAnterior: number): number {
  // igual ou menor = 30; cada 10% de aumento = -5
  if (cplAnterior <= 0) return 15; // sem referência, neutro
  if (cplAtual <= cplAnterior) return 30;
  const pctAumento = ((cplAtual - cplAnterior) / cplAnterior) * 100;
  const penalidade = Math.floor(pctAumento / 10) * 5;
  return Math.max(0, 30 - penalidade);
}

function scoreLeadsVsMeta(leadsMes: number, metaMes: number | null): number {
  if (!metaMes || metaMes <= 0) return 12; // sem meta = metade dos pontos
  const pct = (leadsMes / metaMes) * 100;
  if (pct >= 100) return 25;
  return Math.max(0, Math.round((pct / 100) * 25));
}

function scoreQualificacao(taxa: number): number {
  if (taxa >= 0.4) return 25;
  if (taxa >= 0.3) return 18;
  if (taxa >= 0.2) return 12;
  return 5;
}

function scoreOtimizacao(dias: number | null): number {
  if (dias == null) return 0;
  if (dias <= 7) return 20;
  if (dias <= 14) return 10;
  return 0;
}

export async function POST(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Não rodar em fins de semana
  const hoje = new Date();
  const dow = hoje.getDay(); // 0=dom, 6=sab
  if (dow === 0 || dow === 6) {
    return NextResponse.json({ skipped: true, reason: "weekend" });
  }

  // Clientes ativos (operacionais): status não terminal
  const { data: clientes, error } = await supabase
    .from("clientes_notion_mirror")
    .select("notion_id, cliente, status, meta_campaign_id, meta_leads_mes")
    .neq("status", "Cancelado")
    .neq("status", "Pausado")
    .neq("status", "Não iniciado");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lista = clientes || [];
  const resultados: {
    notion_id: string;
    nome: string | null;
    score: number;
    breakdown: Record<string, number>;
    erro?: string;
  }[] = [];

  // Datas de referência para janelas de 7 dias
  const hojeIso = toIsoDate(hoje);
  const sem1Ini = new Date(hoje);
  sem1Ini.setDate(sem1Ini.getDate() - 6);
  const sem2Fim = new Date(hoje);
  sem2Fim.setDate(sem2Fim.getDate() - 7);
  const sem2Ini = new Date(hoje);
  sem2Ini.setDate(sem2Ini.getDate() - 13);
  const mes_ref_atual = hojeIso.slice(0, 7);
  const tresMesesAtras = new Date(hoje);
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

  for (const c of lista) {
    try {
      // --- Meta/Meta Ads ---
      let pontosCpl = 15; // neutro
      if (c.meta_campaign_id) {
        const [sem1, sem2] = await Promise.all([
          fetchCampaignMetrics(c.meta_campaign_id, toIsoDate(sem1Ini), hojeIso),
          fetchCampaignMetrics(c.meta_campaign_id, toIsoDate(sem2Ini), toIsoDate(sem2Fim)),
        ]);
        if (sem1 && sem2) {
          pontosCpl = scoreCplVariation(sem1.cpl, sem2.cpl);
        }
      }

      // --- Leads do mês atual em leads_crm via ad_id/campaign_id ---
      // Leads qualificados e total
      let totalLeadsMes = 0;
      let qualificadosMes = 0;
      if (c.meta_campaign_id) {
        const { data: leads } = await supabase
          .from("leads_crm")
          .select("etapa")
          .eq("mes_referencia", mes_ref_atual)
          .eq("campaign_id", c.meta_campaign_id);
        totalLeadsMes = (leads || []).length;
        qualificadosMes = (leads || []).filter((l) =>
          ETAPAS_QUALIFICADAS.includes(l.etapa || "")
        ).length;
      }

      // Referência para meta_leads_mes se ausente: média dos últimos 3 meses do mesmo cliente
      let metaRef: number | null = c.meta_leads_mes ?? null;
      if (metaRef == null && c.meta_campaign_id) {
        const since = toIsoDate(tresMesesAtras);
        const { data: hist } = await supabase
          .from("leads_crm")
          .select("mes_referencia")
          .eq("campaign_id", c.meta_campaign_id)
          .gte("mes_referencia", since.slice(0, 7));
        const porMes: Record<string, number> = {};
        for (const r of hist || []) {
          const m = (r.mes_referencia as string) || "";
          porMes[m] = (porMes[m] || 0) + 1;
        }
        const vals = Object.values(porMes);
        if (vals.length > 0) {
          metaRef = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        }
      }

      const pontosLeads = scoreLeadsVsMeta(totalLeadsMes, metaRef);
      const taxaQual = totalLeadsMes > 0 ? qualificadosMes / totalLeadsMes : 0;
      const pontosQualif = scoreQualificacao(taxaQual);

      // --- Otimização: última confirmada ---
      const { data: ultOtim } = await supabase
        .from("otimizacoes_historico")
        .select("data, data_confirmacao")
        .eq("notion_id", c.notion_id)
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .limit(1);
      const ultima = ultOtim?.[0];
      const dias = diasAtras(ultima?.data_confirmacao || ultima?.data || null);
      const pontosOtim = scoreOtimizacao(dias);

      const score = Math.min(
        100,
        Math.max(0, pontosCpl + pontosLeads + pontosQualif + pontosOtim)
      );

      const { error: updErr } = await supabase
        .from("clientes_notion_mirror")
        .update({
          score_saude: score,
          score_calculado_em: new Date().toISOString(),
        })
        .eq("notion_id", c.notion_id);

      if (updErr) throw new Error(updErr.message);

      resultados.push({
        notion_id: c.notion_id,
        nome: c.cliente,
        score,
        breakdown: {
          cpl: pontosCpl,
          leads: pontosLeads,
          qualificacao: pontosQualif,
          otimizacao: pontosOtim,
        },
      });
    } catch (e) {
      resultados.push({
        notion_id: c.notion_id,
        nome: c.cliente,
        score: -1,
        breakdown: {},
        erro: String(e),
      });
    }
  }

  return NextResponse.json({
    processados: resultados.length,
    sucesso: resultados.filter((r) => r.score >= 0).length,
    erros: resultados.filter((r) => r.score < 0).length,
    resultados,
  });
}
