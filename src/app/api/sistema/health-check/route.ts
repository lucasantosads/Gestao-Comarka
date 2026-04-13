/**
 * POST /api/sistema/health-check
 * Protegido por CRON_SECRET. Vercel Cron a cada 5 minutos.
 *
 * Pinga todas as integrações em sistema_integracao_status,
 * atualiza status/latência e alerta via WhatsApp se offline/degradado.
 *
 * Aceita body { servico: string } para testar integração específica.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppText } from "@/lib/evolution";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PingResult {
  status: "online" | "degradado" | "offline";
  latencia_ms: number;
  mensagem_erro?: string;
}

async function pingGHL(): Promise<PingResult> {
  const key = process.env.GHL_API_KEY;
  if (!key) return { status: "offline", latencia_ms: 0, mensagem_erro: "GHL_API_KEY não configurada" };
  const start = Date.now();
  try {
    const res = await fetch(`https://services.leadconnectorhq.com/locations/${process.env.GHL_LOCATION_ID || "DlN4Ua95aZZCaR8qA5Nh"}`, {
      headers: { Authorization: `Bearer ${key}`, Version: "2021-07-28" },
    });
    const latencia_ms = Date.now() - start;
    if (!res.ok) return { status: "offline", latencia_ms, mensagem_erro: `HTTP ${res.status}` };
    if (latencia_ms > 5000) return { status: "degradado", latencia_ms };
    return { status: "online", latencia_ms };
  } catch (e) {
    return { status: "offline", latencia_ms: Date.now() - start, mensagem_erro: String(e) };
  }
}

async function pingMetaAds(): Promise<PingResult> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) return { status: "offline", latencia_ms: 0, mensagem_erro: "META_ADS_ACCESS_TOKEN não configurado" };
  const start = Date.now();
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}`);
    const latencia_ms = Date.now() - start;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { status: "offline", latencia_ms, mensagem_erro: data?.error?.message || `HTTP ${res.status}` };
    }
    if (latencia_ms > 5000) return { status: "degradado", latencia_ms };
    return { status: "online", latencia_ms };
  } catch (e) {
    return { status: "offline", latencia_ms: Date.now() - start, mensagem_erro: String(e) };
  }
}

async function pingN8n(): Promise<PingResult> {
  const baseUrl = process.env.N8N_BASE_URL || "https://comarka.app.n8n.cloud";
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(10000) });
    const latencia_ms = Date.now() - start;
    if (!res.ok) return { status: "offline", latencia_ms, mensagem_erro: `HTTP ${res.status}` };
    if (latencia_ms > 5000) return { status: "degradado", latencia_ms };
    return { status: "online", latencia_ms };
  } catch (e) {
    return { status: "offline", latencia_ms: Date.now() - start, mensagem_erro: String(e) };
  }
}

async function pingAsaas(): Promise<PingResult> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) return { status: "offline", latencia_ms: 0, mensagem_erro: "ASAAS_API_KEY não configurada" };
  const start = Date.now();
  try {
    const res = await fetch("https://api.asaas.com/v3/finance/balance", {
      headers: { access_token: key },
    });
    const latencia_ms = Date.now() - start;
    if (!res.ok) return { status: "offline", latencia_ms, mensagem_erro: `HTTP ${res.status}` };
    if (latencia_ms > 5000) return { status: "degradado", latencia_ms };
    return { status: "online", latencia_ms };
  } catch (e) {
    return { status: "offline", latencia_ms: Date.now() - start, mensagem_erro: String(e) };
  }
}

async function pingEvolutionApi(): Promise<PingResult> {
  const url = process.env.EVOLUTION_API_URL;
  const key = process.env.EVOLUTION_API_KEY;
  if (!url || !key) return { status: "offline", latencia_ms: 0, mensagem_erro: "EVOLUTION_API não configurada" };
  const start = Date.now();
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/instance/fetchInstances`, {
      headers: { apikey: key },
    });
    const latencia_ms = Date.now() - start;
    if (!res.ok) return { status: "offline", latencia_ms, mensagem_erro: `HTTP ${res.status}` };
    if (latencia_ms > 5000) return { status: "degradado", latencia_ms };
    return { status: "online", latencia_ms };
  } catch (e) {
    return { status: "offline", latencia_ms: Date.now() - start, mensagem_erro: String(e) };
  }
}

async function pingNotion(): Promise<PingResult> {
  const key = process.env.NOTION_API_KEY;
  if (!key) return { status: "offline", latencia_ms: 0, mensagem_erro: "NOTION_API_KEY não configurada" };
  const start = Date.now();
  try {
    const res = await fetch("https://api.notion.com/v1/users/me", {
      headers: { Authorization: `Bearer ${key}`, "Notion-Version": "2022-06-28" },
    });
    const latencia_ms = Date.now() - start;
    if (!res.ok) return { status: "offline", latencia_ms, mensagem_erro: `HTTP ${res.status}` };
    if (latencia_ms > 5000) return { status: "degradado", latencia_ms };
    return { status: "online", latencia_ms };
  } catch (e) {
    return { status: "offline", latencia_ms: Date.now() - start, mensagem_erro: String(e) };
  }
}

async function pingSupabase(): Promise<PingResult> {
  const start = Date.now();
  try {
    const { error } = await supabase.from("config_mensal").select("id", { count: "exact", head: true });
    const latencia_ms = Date.now() - start;
    if (error) return { status: "offline", latencia_ms, mensagem_erro: error.message };
    if (latencia_ms > 5000) return { status: "degradado", latencia_ms };
    return { status: "online", latencia_ms };
  } catch (e) {
    return { status: "offline", latencia_ms: Date.now() - start, mensagem_erro: String(e) };
  }
}

async function pingWebhookTranscricao(): Promise<PingResult> {
  const baseUrl = process.env.VERCEL_PROJECT_URL || process.env.NEXT_PUBLIC_VERCEL_URL || "";
  if (!baseUrl) return { status: "desconhecido" as "offline", latencia_ms: 0, mensagem_erro: "URL do projeto não configurada" };
  const start = Date.now();
  try {
    const protocol = baseUrl.startsWith("http") ? "" : "https://";
    const res = await fetch(`${protocol}${baseUrl}/api/webhooks/transcricao`, { signal: AbortSignal.timeout(10000) });
    const latencia_ms = Date.now() - start;
    if (!res.ok) return { status: "offline", latencia_ms, mensagem_erro: `HTTP ${res.status}` };
    if (latencia_ms > 5000) return { status: "degradado", latencia_ms };
    return { status: "online", latencia_ms };
  } catch (e) {
    return { status: "offline", latencia_ms: Date.now() - start, mensagem_erro: String(e) };
  }
}

const PING_MAP: Record<string, () => Promise<PingResult>> = {
  ghl: pingGHL,
  meta_ads: pingMetaAds,
  n8n: pingN8n,
  asaas: pingAsaas,
  evolution_api: pingEvolutionApi,
  notion: pingNotion,
  supabase: pingSupabase,
  tldv: pingWebhookTranscricao,
  fathom: pingWebhookTranscricao,
  google_drive: async () => ({ status: "online", latencia_ms: 0 }), // verificado via MCP
};

export async function POST(req: NextRequest) {
  // Validar CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Se body tem { servico }, testar apenas essa integração
  let servicoEspecifico: string | null = null;
  try {
    const body = await req.json().catch(() => null);
    if (body?.servico) servicoEspecifico = body.servico;
  } catch {}

  // Buscar integrações
  const { data: integracoes } = await supabase
    .from("sistema_integracao_status")
    .select("*");

  if (!integracoes) {
    return NextResponse.json({ error: "Falha ao buscar integrações" }, { status: 500 });
  }

  const toCheck = servicoEspecifico
    ? integracoes.filter((i) => i.nome === servicoEspecifico)
    : integracoes;

  const results: { nome: string; result: PingResult; statusAnterior: string }[] = [];

  // Executar pings em paralelo
  await Promise.all(
    toCheck.map(async (integracao) => {
      const pingFn = PING_MAP[integracao.nome];
      if (!pingFn) return;

      const result = await pingFn();
      results.push({ nome: integracao.nome, result, statusAnterior: integracao.status });

      // Calcular latência média (média móvel simples com anterior)
      const latenciaMedia = integracao.latencia_media_ms
        ? Math.round((integracao.latencia_media_ms + result.latencia_ms) / 2)
        : result.latencia_ms;

      // Atualizar status no banco
      await supabase
        .from("sistema_integracao_status")
        .update({
          status: result.status,
          latencia_ms: result.latencia_ms,
          latencia_media_ms: latenciaMedia,
          ultimo_ping_em: new Date().toISOString(),
          ...(result.status === "online" ? { ultimo_ping_sucesso_em: new Date().toISOString() } : {}),
          mensagem_erro: result.mensagem_erro || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq("nome", integracao.nome);

      // Se mudou de online para offline/degradado: alertar
      if (
        integracao.status === "online" &&
        (result.status === "offline" || result.status === "degradado")
      ) {
        // Inserir em fila de erros
        await supabase.from("sistema_fila_erros").insert({
          origem: integracao.nome === "meta_ads" ? "meta_api" : integracao.nome === "ghl" ? "webhook_ghl" : integracao.nome === "evolution_api" ? "evolution_api" : "n8n_sync",
          tipo_erro: "integracao_indisponivel",
          mensagem: `${integracao.nome} mudou de online para ${result.status}: ${result.mensagem_erro || "sem detalhes"}`,
        });

        // Enviar WhatsApp para admin
        const adminPhone = process.env.ADMIN_WHATSAPP || "";
        if (adminPhone) {
          const emoji = result.status === "offline" ? "\u274C" : "\u26A0\uFE0F";
          await sendWhatsAppText(
            adminPhone,
            `${emoji} *Health Check*\n${integracao.nome} ficou *${result.status}*\n${result.mensagem_erro || ""}`.trim()
          );
        }
      }
    })
  );

  return NextResponse.json({
    ok: true,
    checked: results.length,
    results: results.map((r) => ({
      nome: r.nome,
      status: r.result.status,
      latencia_ms: r.result.latencia_ms,
      statusAnterior: r.statusAnterior,
      mensagem_erro: r.result.mensagem_erro,
    })),
  });
}
