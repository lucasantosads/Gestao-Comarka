/**
 * POST /api/ia/avaliar-alerta-trafego
 * Aceita: { ad_id, adset_id, campaign_id, cliente_id, metrica, valor_atual }
 * Avalia alerta com regras de otimização via Gemini Flash.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callAI } from "@/lib/ai-client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { ad_id, adset_id, campaign_id, cliente_id, metrica, valor_atual } = await req.json();

    // Buscar regras ativas para a métrica
    const { data: regras } = await supabase
      .from("trafego_regras_otimizacao")
      .select("*")
      .eq("ativo", true)
      .eq("metrica", metrica);

    // Histórico 7 dias de performance
    const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    let perfQuery = supabase
      .from("ads_performance")
      .select("*")
      .gte("data_ref", d7)
      .order("data_ref", { ascending: false });
    if (ad_id) perfQuery = perfQuery.eq("ad_id", ad_id);
    const { data: perfHist } = await perfQuery;

    // Histórico de aplicação de regras
    const regraIds = (regras || []).map((r) => r.id);
    const { data: histRegras } = regraIds.length > 0
      ? await supabase
          .from("trafego_regras_historico")
          .select("regra_id, acao")
          .in("regra_id", regraIds)
      : { data: [] };

    // Score do criativo
    let scoreCreative = null;
    if (ad_id) {
      const { data: cs } = await supabase
        .from("creative_scores")
        .select("score")
        .eq("ad_id", ad_id)
        .limit(1);
      scoreCreative = cs?.[0]?.score ?? null;
    }

    // Fase ciclo de vida
    let faseCicloVida = null;
    if (ad_id) {
      const { data: criativo } = await supabase
        .from("trafego_criativos")
        .select("id")
        .eq("ad_id", ad_id)
        .is("deleted_at", null)
        .limit(1);
      if (criativo?.[0]) {
        const { data: metricas } = await supabase
          .from("trafego_criativo_metricas")
          .select("fase_ciclo_vida, frequencia")
          .eq("criativo_id", criativo[0].id)
          .order("mes_referencia", { ascending: false })
          .limit(1);
        faseCicloVida = metricas?.[0]?.fase_ciclo_vida ?? null;
      }
    }

    // Avaliar quais regras disparam
    const regrasDisparadas = (regras || []).filter((r) => {
      const v = Number(valor_atual);
      const t = Number(r.threshold);
      switch (r.operador) {
        case ">=": return v >= t;
        case "<=": return v <= t;
        case ">": return v > t;
        case "<": return v < t;
        case "=": return v === t;
        default: return false;
      }
    });

    // Montar contexto para IA
    const perfResumido = (perfHist || []).slice(0, 7).map((p) => ({
      data: p.data_ref, spend: p.spend, leads: p.leads, cpl: p.cpl, ctr: p.ctr, freq: p.frequencia,
    }));

    const histResumo: Record<string, { aplicada: number; ignorada: number }> = {};
    for (const h of histRegras || []) {
      if (!histResumo[h.regra_id]) histResumo[h.regra_id] = { aplicada: 0, ignorada: 0 };
      if (h.acao === "aplicada") histResumo[h.regra_id].aplicada++;
      if (h.acao === "ignorada") histResumo[h.regra_id].ignorada++;
    }

    const systemPrompt = `Você é um especialista em otimização de Meta Ads para escritórios de advocacia.
Analise este alerta considerando as regras de otimização configuradas e o histórico de performance. Retorne APENAS JSON:
{
  "severidade": "baixa" | "media" | "alta" | "critica",
  "causa_provavel": "string max 150 chars",
  "e_comportamento_toleravel": boolean,
  "justificativa": "string max 200 chars",
  "acao_recomendada": "string acao específica e objetiva",
  "acao_meta_api": "pausar_anuncio" | "pausar_conjunto" | null,
  "urgencia_horas": number,
  "regras_aplicadas": ["string nomes das regras"]
}`;

    const userContent = `ALERTA: métrica=${metrica}, valor_atual=${valor_atual}
AD_ID: ${ad_id || "N/A"}, ADSET: ${adset_id || "N/A"}, CAMPAIGN: ${campaign_id || "N/A"}

REGRAS CONFIGURADAS:
${(regras || []).map((r) => `- ${r.nome}: ${r.metrica} ${r.operador} ${r.threshold} → ${r.acao_sugerida} (prioridade: ${r.prioridade})`).join("\n")}

REGRAS DISPARADAS: ${regrasDisparadas.map((r) => r.nome).join(", ") || "nenhuma"}

PERFORMANCE ÚLTIMOS 7 DIAS:
${JSON.stringify(perfResumido, null, 1)}

HISTÓRICO DE REGRAS (aplicada/ignorada):
${Object.entries(histResumo).map(([id, h]) => {
  const regra = (regras || []).find((r) => r.id === id);
  return `${regra?.nome || id}: ${h.aplicada} aplicada, ${h.ignorada} ignorada`;
}).join("\n")}

SCORE CRIATIVO: ${scoreCreative ?? "N/A"}
FASE CICLO VIDA: ${faseCicloVida ?? "N/A"}`;

    const result = await callAI({
      provider: "gemini",
      systemPrompt,
      userContent,
      maxTokens: 1000,
    });

    let analise;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      analise = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(result.text);
    } catch {
      return NextResponse.json({ error: "Falha ao parsear resposta da IA", raw: result.text }, { status: 500 });
    }

    // Registrar disparo em trafego_regras_historico para cada regra aplicada
    for (const regra of regrasDisparadas) {
      await supabase.from("trafego_regras_historico").insert({
        regra_id: regra.id,
        ad_id,
        adset_id,
        campaign_id,
        cliente_id,
        acao: "disparada",
        valor_metrica_no_momento: Number(valor_atual),
      });
    }

    return NextResponse.json({
      success: true,
      analise,
      regras_disparadas: regrasDisparadas.map((r) => r.nome),
      pode_pausar_via_api: !!analise.acao_meta_api,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
