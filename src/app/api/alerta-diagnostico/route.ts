import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai-client";
import { AI_CONFIG } from "@/lib/ai-config";
import type { AIProvider } from "@/lib/ai-client";
import { saveToNotion, providerToOrigem } from "@/lib/notion-save";

export const revalidate = 0; // AI — no cache

const SYSTEM_PROMPT = `Você é um analista sênior de mídia paga especializado em campanhas para advogados. Diagnostique alertas de performance com base em dados históricos. Analise TODAS as métricas em conjunto, considere tendência e volume, diferencie problema real de variação natural.

Responda SEMPRE com esta estrutura em markdown:
## Diagnóstico
## Contexto histórico
## Nível de urgência
[TOLERÁVEL / ATENÇÃO / CRÍTICO + justificativa]
## Causa provável
## Ação recomendada
## Confiança na recomendação`;

export async function POST(req: NextRequest) {
  try {
    const { alertaData, provider } = await req.json();
    const aiProvider: AIProvider = provider || AI_CONFIG.diagnostico_alerta;
    const result = await callAI({
      provider: aiProvider,
      systemPrompt: SYSTEM_PROMPT,
      userContent: alertaData,
      maxTokens: 1000,
    });

    // Auto-save to Notion
    const today = new Date().toISOString().split("T")[0];
    saveToNotion({
      titulo: `Diagnóstico de Alerta — ${today}`,
      iaOrigem: providerToOrigem(aiProvider),
      tipo: "Analise",
      tags: ["trafego pago", "metricas", "Meta Ads"],
      relevancia: "Media",
      resumo: `Diagnóstico de alerta de performance de tráfego pago com análise de urgência e ação recomendada.`,
      conteudo: `# 🔍 Diagnóstico de Alerta\n> Análise de alerta de performance\n\n**IA:** ${providerToOrigem(aiProvider)} · **Data:** ${today} · **Tipo:** Análise\n\n---\n\n## 📌 Dados do Alerta\n${alertaData}\n\n## 📊 Diagnóstico\n${result.text}\n\n---\n*Gerado automaticamente por ${providerToOrigem(aiProvider)} em ${today}*`,
    }).catch((e) => console.error("[Notion] Background save failed:", e));

    return NextResponse.json({ diagnostico: result.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao processar o diagnóstico.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
