import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai-client";
import { AI_CONFIG } from "@/lib/ai-config";
import type { AIProvider } from "@/lib/ai-client";

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
    return NextResponse.json({ diagnostico: result.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao processar o diagnóstico.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
