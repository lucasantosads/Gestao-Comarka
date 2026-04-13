/**
 * POST /api/projecoes/meta-closers
 * Protegido por CRON_SECRET. Vercel Cron: todo dia 1 às 05h.
 *
 * Para cada closer ativo: analisa desempenho 3M e chama Gemini Flash
 * para sugestão de meta. Salva em meta_sugerida_ia e meta_sugerida_justificativa.
 *
 * NUNCA atualiza metas_closers automaticamente — apenas salva sugestão.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callAI } from "@/lib/ai-client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getMonthsRange(n: number): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

interface CloserPerformance {
  mes: string;
  contratos: number;
  mrr: number;
  reunioes_feitas: number;
  taxa_fechamento: number;
  ticket_medio: number;
  meta_contratos: number;
  bateu_meta: boolean;
}

export async function POST(req: NextRequest) {
  // Validar CRON_SECRET
  const authHeader = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const months = getMonthsRange(3);
    const mesProximo = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();

    // Buscar dados
    const [{ data: closers }, { data: lancamentos }, { data: metas }] = await Promise.all([
      supabase.from("closers").select("id,nome").eq("ativo", true),
      supabase.from("lancamentos_diarios").select("closer_id,mes_referencia,ganhos,mrr_dia,reunioes_feitas").in("mes_referencia", months),
      supabase.from("metas_closers").select("closer_id,mes_referencia,meta_contratos,meta_mrr").in("mes_referencia", months),
    ]);

    const closersList = closers || [];
    const lancAll = lancamentos || [];
    const metasAll = metas || [];
    const resultados: { closer: string; meta_sugerida: number; justificativa: string }[] = [];

    for (const closer of closersList) {
      // Montar histórico do closer
      const historico: CloserPerformance[] = months.map((mes) => {
        const lanc = lancAll.filter((l) => l.closer_id === closer.id && l.mes_referencia === mes);
        const contratos = lanc.reduce((s, l) => s + (l.ganhos || 0), 0);
        const mrr = lanc.reduce((s, l) => s + Number(l.mrr_dia || 0), 0);
        const reunioesFeitas = lanc.reduce((s, l) => s + (l.reunioes_feitas || 0), 0);
        const mc = metasAll.find((m) => m.closer_id === closer.id && m.mes_referencia === mes);
        const metaContratos = mc?.meta_contratos ?? 0;

        return {
          mes,
          contratos,
          mrr,
          reunioes_feitas: reunioesFeitas,
          taxa_fechamento: reunioesFeitas > 0 ? contratos / reunioesFeitas : 0,
          ticket_medio: contratos > 0 ? mrr / contratos : 0,
          meta_contratos: metaContratos,
          bateu_meta: metaContratos > 0 && contratos >= metaContratos,
        };
      });

      // Tendência
      const contratosArr = historico.map((h) => h.contratos);
      const tendencia = contratosArr.length >= 2 && contratosArr[0] > contratosArr[contratosArr.length - 1] * 1.15
        ? "crescendo"
        : contratosArr[0] < contratosArr[contratosArr.length - 1] * 0.85
          ? "caindo"
          : "estável";

      // Chamar Gemini Flash
      try {
        const iaResult = await callAI({
          provider: "gemini",
          systemPrompt: "Você é um gerente comercial de agência de marketing jurídico. Analise o desempenho histórico do closer e retorne APENAS JSON válido, sem markdown.",
          userContent: `Closer: ${closer.nome}
Histórico dos últimos 3 meses:
${historico.map((h) => `- ${h.mes}: ${h.contratos} contratos (meta: ${h.meta_contratos}), MRR R$ ${h.mrr.toFixed(2)}, ${h.reunioes_feitas} reuniões, fechamento ${(h.taxa_fechamento * 100).toFixed(0)}%, ticket R$ ${h.ticket_medio.toFixed(2)}, ${h.bateu_meta ? "BATEU" : "NÃO BATEU"} meta`).join("\n")}
Tendência: ${tendencia}

Retorne APENAS este JSON (sem markdown, sem \`\`\`):
{
  "meta_sugerida_proximos_mes": number,
  "justificativa": "string com max 150 chars",
  "potencial_crescimento_pct": number,
  "condicoes": ["condição 1", "condição 2"]
}`,
          maxTokens: 300,
        });

        let parsed;
        try {
          const cleanText = iaResult.text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
          parsed = JSON.parse(cleanText);
        } catch {
          // Fallback: calcular manualmente
          const media = historico.reduce((s, h) => s + h.contratos, 0) / historico.length;
          const bateuCount = historico.filter((h) => h.bateu_meta).length;
          const fator = bateuCount >= 3 ? 1.15 : bateuCount >= 2 ? 1.08 : bateuCount === 1 ? 1 : 0.9;
          const metaAtual = historico[0]?.meta_contratos || Math.round(media);
          parsed = {
            meta_sugerida_proximos_mes: Math.max(1, Math.round(metaAtual * fator)),
            justificativa: `Baseado em ${bateuCount}/3 metas batidas. Média: ${media.toFixed(1)} contratos.`,
            potencial_crescimento_pct: Math.round((fator - 1) * 100),
            condicoes: [],
          };
        }

        // Salvar sugestão em metas_closers — NUNCA alterar meta_contratos automaticamente
        const { error } = await supabase.from("metas_closers").upsert({
          closer_id: closer.id,
          mes_referencia: mesProximo,
          meta_sugerida_ia: parsed.meta_sugerida_proximos_mes,
          meta_sugerida_justificativa: `${parsed.justificativa} | Potencial: ${parsed.potencial_crescimento_pct}% | ${(parsed.condicoes || []).join("; ")}`.slice(0, 500),
        }, { onConflict: "closer_id,mes_referencia" });

        if (error) console.error(`[meta-closers] Upsert error for ${closer.nome}:`, error);

        resultados.push({
          closer: closer.nome,
          meta_sugerida: parsed.meta_sugerida_proximos_mes,
          justificativa: parsed.justificativa,
        });
      } catch (e) {
        console.error(`[meta-closers] Erro IA for ${closer.nome}:`, e);
      }
    }

    return NextResponse.json({ success: true, mes_referencia: mesProximo, resultados });
  } catch (err) {
    console.error("[projecoes/meta-closers] Erro:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
