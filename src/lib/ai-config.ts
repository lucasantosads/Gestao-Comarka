import type { AIProvider } from "./ai-client";

export const AI_CONFIG = {
  diagnostico_alerta: "anthropic-haiku" as AIProvider,
  analise_closer: "anthropic-haiku" as AIProvider,
  relatorio_semanal: "gemini" as AIProvider,
  resumo_executivo: "openai-mini" as AIProvider,
} as const;

export type AIFunction = keyof typeof AI_CONFIG;

export const AI_LABELS: Record<AIProvider, { nome: string; custo: string; custoEstimado: string }> = {
  "gemini": { nome: "Gemini Flash", custo: "mais barato", custoEstimado: "~$0 (free tier)" },
  "openai-mini": { nome: "GPT-4o Mini", custo: "barato", custoEstimado: "~$0.01/análise" },
  "anthropic-haiku": { nome: "Claude Haiku", custo: "moderado", custoEstimado: "~$0.02/análise" },
  "anthropic": { nome: "Claude Sonnet", custo: "premium", custoEstimado: "~$0.05/análise" },
  "openai": { nome: "GPT-4o", custo: "premium", custoEstimado: "~$0.05/análise" },
};

export const AI_FUNCTION_LABELS: Record<AIFunction, string> = {
  diagnostico_alerta: "Diagnóstico de Alertas",
  analise_closer: "Análise de Closer",
  relatorio_semanal: "Relatório Semanal",
  resumo_executivo: "Resumo Executivo",
};

export const ALL_PROVIDERS: AIProvider[] = ["gemini", "openai-mini", "anthropic-haiku", "anthropic", "openai"];

export function getAIProvider(fn: AIFunction): AIProvider {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(`ai_provider_${fn}`);
    if (saved && ALL_PROVIDERS.includes(saved as AIProvider)) return saved as AIProvider;
  }
  return AI_CONFIG[fn];
}
