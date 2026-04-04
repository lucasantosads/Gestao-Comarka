import { NextResponse } from "next/server";

interface ProviderStatus {
  provider: string;
  status: "ok" | "sem_creditos" | "erro" | "sem_chave";
  mensagem: string;
  latencia?: number;
}

async function testarAnthropic(): Promise<ProviderStatus> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { provider: "anthropic", status: "sem_chave", mensagem: "ANTHROPIC_API_KEY não configurada" };
  const start = Date.now();
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 5, messages: [{ role: "user", content: "oi" }] }),
    });
    const latencia = Date.now() - start;
    if (res.ok) return { provider: "anthropic", status: "ok", mensagem: "Funcionando", latencia };
    const data = await res.json().catch(() => ({}));
    const msg = data?.error?.message || `HTTP ${res.status}`;
    if (msg.includes("credit") || msg.includes("balance")) return { provider: "anthropic", status: "sem_creditos", mensagem: "Saldo insuficiente", latencia };
    return { provider: "anthropic", status: "erro", mensagem: msg, latencia };
  } catch (e) { return { provider: "anthropic", status: "erro", mensagem: String(e) }; }
}

async function testarGemini(): Promise<ProviderStatus> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { provider: "gemini", status: "sem_chave", mensagem: "GEMINI_API_KEY não configurada" };
  const start = Date.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "oi" }] }] }),
    });
    const latencia = Date.now() - start;
    if (res.ok) return { provider: "gemini", status: "ok", mensagem: "Funcionando", latencia };
    const data = await res.json().catch(() => ({}));
    const msg = data?.error?.message || `HTTP ${res.status}`;
    if (msg.includes("quota") || res.status === 429) return { provider: "gemini", status: "sem_creditos", mensagem: "Quota excedida", latencia };
    return { provider: "gemini", status: "erro", mensagem: msg, latencia };
  } catch (e) { return { provider: "gemini", status: "erro", mensagem: String(e) }; }
}

async function testarOpenAI(): Promise<ProviderStatus> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { provider: "openai", status: "sem_chave", mensagem: "OPENAI_API_KEY não configurada" };
  const start = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 5, messages: [{ role: "user", content: "oi" }] }),
    });
    const latencia = Date.now() - start;
    if (res.ok) return { provider: "openai", status: "ok", mensagem: "Funcionando", latencia };
    const data = await res.json().catch(() => ({}));
    const msg = data?.error?.message || `HTTP ${res.status}`;
    if (msg.includes("quota") || res.status === 429) return { provider: "openai", status: "sem_creditos", mensagem: "Quota excedida", latencia };
    return { provider: "openai", status: "erro", mensagem: msg, latencia };
  } catch (e) { return { provider: "openai", status: "erro", mensagem: String(e) }; }
}

export async function GET() {
  const [anthropic, gemini, openai] = await Promise.all([
    testarAnthropic(),
    testarGemini(),
    testarOpenAI(),
  ]);
  return NextResponse.json({ providers: [anthropic, gemini, openai] });
}
