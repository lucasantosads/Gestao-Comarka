import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai-client";
import { AI_CONFIG } from "@/lib/ai-config";
import type { AIProvider } from "@/lib/ai-client";

const DEFAULT_PROMPT = `Você é um especialista em performance comercial de agências de marketing digital focadas no nicho jurídico. Analise os dados de performance do closer abaixo e forneça:

1. DIAGNÓSTICO: 2-3 parágrafos explicando o padrão de performance, cruzando os critérios entre si (ex: conversão alta mas aproveitamento baixo indica problema diferente de conversão baixa com aproveitamento alto)

2. CAUSAS PROVÁVEIS: Lista de 3-5 causas específicas e realistas para os números apresentados

3. PLANO DE AÇÃO: 3 ações práticas e executáveis para a próxima semana, em ordem de prioridade, com prazo sugerido

Seja direto, específico e orientado a resultado. Evite genericidades. Responda em português brasileiro.`;

export async function POST(req: NextRequest) {
  try {
    const { closerData, customPrompt, provider } = await req.json();
    const aiProvider: AIProvider = provider || AI_CONFIG.analise_closer;
    const result = await callAI({
      provider: aiProvider,
      systemPrompt: customPrompt || DEFAULT_PROMPT,
      userContent: closerData,
      maxTokens: 2000,
    });
    return NextResponse.json({ analysis: result.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao processar a análise.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
