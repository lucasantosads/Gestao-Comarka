/**
 * POST /api/clientes/analise-risco
 * Protegido por CRON_SECRET. Agendado: diário 07h (dias úteis, ver vercel.json).
 *
 * Para cada cliente ativo, chama Gemini Flash com contexto operacional e
 * pede classificação de risco de churn. Salva em clientes_notion_mirror:
 *  - risco_churn ('baixo' | 'medio' | 'alto')
 *  - risco_churn_motivo (max 100 chars)
 *  - risco_churn_acao (max 150 chars)
 *  - risco_calculado_em
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callAI } from "@/lib/ai-client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

interface RiscoResposta {
  risco: "baixo" | "medio" | "alto";
  motivo: string;
  acao_sugerida: string;
}

function safeTrim(s: string | undefined, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function parseResposta(text: string): RiscoResposta | null {
  // Busca bloco JSON — aceita texto ao redor
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    const risco = String(obj.risco || "").toLowerCase();
    if (!["baixo", "medio", "alto"].includes(risco)) return null;
    return {
      risco: risco as "baixo" | "medio" | "alto",
      motivo: safeTrim(String(obj.motivo || ""), 100),
      acao_sugerida: safeTrim(String(obj.acao_sugerida || ""), 150),
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hoje = new Date();
  const dow = hoje.getDay();
  if (dow === 0 || dow === 6) {
    return NextResponse.json({ skipped: true, reason: "weekend" });
  }

  const { data: clientes, error } = await supabase
    .from("clientes_notion_mirror")
    .select("notion_id, cliente, nicho, score_saude, meta_campaign_id, meta_leads_mes")
    .neq("status", "Cancelado")
    .neq("status", "Pausado")
    .neq("status", "Não iniciado");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mesAtual = hoje.toISOString().slice(0, 7);
  const tresMesesAtras = new Date(hoje);
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

  const resultados: {
    notion_id: string;
    nome: string | null;
    risco?: string;
    erro?: string;
  }[] = [];

  for (const c of clientes || []) {
    try {
      // Última otimização
      const { data: otims } = await supabase
        .from("otimizacoes_historico")
        .select("data, data_confirmacao")
        .eq("notion_id", c.notion_id)
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .limit(1);
      const ultOtim = otims?.[0];
      const diasDesdeOtim =
        ultOtim?.data_confirmacao || ultOtim?.data
          ? Math.floor(
              (hoje.getTime() - new Date(ultOtim.data_confirmacao || ultOtim.data).getTime()) /
                86400000
            )
          : null;

      // Última reunião
      const { data: reuns } = await supabase
        .from("reunioes_cliente")
        .select("data_reuniao")
        .eq("cliente_notion_id", c.notion_id)
        .order("data_reuniao", { ascending: false })
        .limit(1);
      const ultReun = reuns?.[0];
      const diasDesdeReun = ultReun
        ? Math.floor((hoje.getTime() - new Date(ultReun.data_reuniao).getTime()) / 86400000)
        : null;

      // Tendência de leads últimos 3 meses (contagem por mes_referencia)
      let tendencia: "crescendo" | "caindo" | "estavel" | "sem dados" = "sem dados";
      if (c.meta_campaign_id) {
        const { data: hist } = await supabase
          .from("leads_crm")
          .select("mes_referencia")
          .eq("campaign_id", c.meta_campaign_id)
          .gte("mes_referencia", tresMesesAtras.toISOString().slice(0, 7));
        const porMes: Record<string, number> = {};
        for (const r of hist || []) {
          const m = (r.mes_referencia as string) || "";
          porMes[m] = (porMes[m] || 0) + 1;
        }
        const meses = Object.keys(porMes).sort();
        if (meses.length >= 2) {
          const first = porMes[meses[0]];
          const last = porMes[meses[meses.length - 1]];
          if (last > first * 1.1) tendencia = "crescendo";
          else if (last < first * 0.9) tendencia = "caindo";
          else tendencia = "estavel";
        }
      }

      // Leads do mês atual e % da meta
      let leadsMes = 0;
      if (c.meta_campaign_id) {
        const { count } = await supabase
          .from("leads_crm")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", c.meta_campaign_id)
          .eq("mes_referencia", mesAtual);
        leadsMes = count || 0;
      }
      const pctMeta = c.meta_leads_mes
        ? Math.round((leadsMes / c.meta_leads_mes) * 100)
        : null;

      const contexto = {
        score_saude: c.score_saude ?? "não calculado",
        dias_desde_otimizacao: diasDesdeOtim,
        dias_desde_reuniao: diasDesdeReun,
        tendencia_leads_3m: tendencia,
        leads_mes_atual: leadsMes,
        pct_meta_leads: pctMeta,
      };

      const systemPrompt = `Você é um especialista em retenção de clientes de agência de tráfego pago.
Analise o contexto operacional e classifique o risco de churn em "baixo", "medio" ou "alto".
Responda APENAS com um objeto JSON no formato exato:
{"risco":"baixo|medio|alto","motivo":"até 100 chars","acao_sugerida":"até 150 chars"}
Sem texto adicional, sem markdown.`;

      const { text } = await callAI({
        provider: "gemini",
        systemPrompt,
        userContent: `Contexto:\n${JSON.stringify(contexto, null, 2)}`,
        maxTokens: 300,
      });

      const parsed = parseResposta(text);
      if (!parsed) throw new Error("Resposta da IA inválida");

      const { error: updErr } = await supabase
        .from("clientes_notion_mirror")
        .update({
          risco_churn: parsed.risco,
          risco_churn_motivo: parsed.motivo,
          risco_churn_acao: parsed.acao_sugerida,
          risco_calculado_em: new Date().toISOString(),
        })
        .eq("notion_id", c.notion_id);
      if (updErr) throw new Error(updErr.message);

      resultados.push({ notion_id: c.notion_id, nome: c.cliente, risco: parsed.risco });
    } catch (e) {
      resultados.push({ notion_id: c.notion_id, nome: c.cliente, erro: String(e) });
    }
  }

  return NextResponse.json({
    processados: resultados.length,
    sucesso: resultados.filter((r) => r.risco).length,
    erros: resultados.filter((r) => r.erro).length,
    resultados,
  });
}
