/**
 * GET /api/health
 * Verifica status e validade de todas as APIs integradas
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

interface ApiStatus {
  name: string;
  status: "ok" | "error" | "warning";
  message: string;
  response_ms: number;
  expires?: string;
  details?: Record<string, unknown>;
}

async function checkApi(name: string, fn: () => Promise<{ ok: boolean; msg: string; details?: Record<string, unknown> }>): Promise<ApiStatus> {
  const start = Date.now();
  try {
    const result = await fn();
    return { name, status: result.ok ? "ok" : "error", message: result.msg, response_ms: Date.now() - start, details: result.details };
  } catch (e) {
    return { name, status: "error", message: String(e), response_ms: Date.now() - start };
  }
}

export async function GET() {
  const checks = await Promise.all([
    // Supabase
    checkApi("Supabase", async () => {
      const { count, error } = await supabase.from("leads_crm").select("id", { count: "exact", head: true });
      return { ok: !error, msg: error ? error.message : `Conectado (${count} leads)`, details: { url: process.env.NEXT_PUBLIC_SUPABASE_URL } };
    }),

    // Meta Ads
    checkApi("Meta Ads", async () => {
      const token = process.env.META_ADS_ACCESS_TOKEN;
      const accountId = process.env.META_ADS_ACCOUNT_ID;
      if (!token || !accountId) return { ok: false, msg: "Token ou Account ID não configurado" };
      const res = await fetch(`https://graph.facebook.com/v21.0/${accountId}?fields=name,account_status&access_token=${token}`);
      const data = await res.json();
      if (data.error) return { ok: false, msg: data.error.message, details: { code: data.error.code, type: data.error.type } };
      // Verificar validade do token
      const debugRes = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${token}&access_token=${token}`);
      const debugData = await debugRes.json();
      const expiresAt = debugData.data?.expires_at;
      const isValid = debugData.data?.is_valid;
      // expires_at=0 significa token permanente (System User)
      const neverExpires = expiresAt === 0;
      const expiresDate = neverExpires ? null : (expiresAt ? new Date(expiresAt * 1000).toISOString() : null);
      const daysLeft = neverExpires ? null : (expiresAt ? Math.ceil((expiresAt * 1000 - Date.now()) / 86400000) : null);
      const isExpiring = !neverExpires && daysLeft !== null && daysLeft < 7;
      return {
        ok: isValid !== false && !isExpiring,
        msg: `${data.name} (status: ${data.account_status})${neverExpires ? " • Token permanente" : expiresDate ? ` • Token expira em ${daysLeft}d` : ""}`,
        details: { account_name: data.name, account_status: data.account_status, token_expires: neverExpires ? "never" : expiresDate, days_left: neverExpires ? "permanent" : daysLeft }
      };
    }),

    // GoHighLevel
    checkApi("GoHighLevel (GHL)", async () => {
      const key = process.env.GHL_API_KEY;
      if (!key) return { ok: false, msg: "API Key não configurada" };
      const res = await fetch(`https://services.leadconnectorhq.com/locations/${process.env.GHL_LOCATION_ID}`, {
        headers: { Authorization: `Bearer ${key}`, Version: "2021-07-28" },
      });
      if (!res.ok) return { ok: false, msg: `HTTP ${res.status}` };
      const data = await res.json();
      return { ok: true, msg: `${data.location?.name || "Conectado"}`, details: { location_id: process.env.GHL_LOCATION_ID } };
    }),

    // Anthropic (Claude)
    checkApi("Anthropic (Claude)", async () => {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return { ok: false, msg: "API Key não configurada" };
      // Apenas verificar se a key é válida com um request mínimo
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
      });
      if (res.status === 401) return { ok: false, msg: "API Key inválida" };
      return { ok: true, msg: "Conectado" };
    }),

    // OpenAI
    checkApi("OpenAI (GPT)", async () => {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return { ok: false, msg: "API Key não configurada" };
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.status === 401) return { ok: false, msg: "API Key inválida" };
      return { ok: res.ok, msg: res.ok ? "Conectado" : `HTTP ${res.status}` };
    }),

    // Gemini
    checkApi("Google Gemini", async () => {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return { ok: false, msg: "API Key não configurada" };
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      return { ok: res.ok, msg: res.ok ? "Conectado" : `HTTP ${res.status}` };
    }),

    // Notion
    checkApi("Notion", async () => {
      const key = process.env.NOTION_API_KEY;
      if (!key) return { ok: false, msg: "API Key não configurada" };
      const res = await fetch("https://api.notion.com/v1/users/me", {
        headers: { Authorization: `Bearer ${key}`, "Notion-Version": "2022-06-28" },
      });
      if (!res.ok) return { ok: false, msg: `HTTP ${res.status}` };
      const data = await res.json();
      return { ok: true, msg: `${data.name || "Conectado"}` };
    }),
  ]);

  const allOk = checks.every((c) => c.status === "ok");
  return NextResponse.json({ status: allOk ? "healthy" : "degraded", checked_at: new Date().toISOString(), apis: checks });
}
