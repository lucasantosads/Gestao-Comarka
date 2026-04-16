/**
 * POST /api/clientes/alertas-campanha
 * Protegido por CRON_SECRET. Agendado: diário 09h (dias úteis, ver vercel.json).
 *
 * Para cada cliente ativo com meta_campaign_id:
 *  1. Busca spend dos últimos 3 dias via Meta API (campaign-level)
 *  2. Conta leads em leads_crm com campaign_id = meta_campaign_id nos últimos 3 dias
 *  3. Se spend > 0 E leads = 0:
 *     - Upsert em alertas_cliente (tipo='campanha_sem_leads', abre se não existir ativo)
 *     - Notifica via WhatsApp o analista/gestor (se telefone cadastrado em employees)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppText } from "@/lib/evolution";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

const META_BASE = "https://graph.facebook.com/v21.0";

async function fetchSpend3d(campaignId: string): Promise<number> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) return 0;

  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 2); // janela de 3 dias (hoje - 2)

  const params = new URLSearchParams({
    access_token: token,
    fields: "spend",
    time_range: JSON.stringify({
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
    }),
    level: "campaign",
  });

  try {
    const res = await fetch(`${META_BASE}/${campaignId}/insights?${params.toString()}`);
    if (!res.ok) return 0;
    const body = await res.json();
    return parseFloat(body.data?.[0]?.spend || "0");
  } catch {
    return 0;
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
    .select("notion_id, cliente, analista, meta_campaign_id")
    .neq("status", "Cancelado")
    .neq("status", "Pausado")
    .neq("status", "Não iniciado")
    .not("meta_campaign_id", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Datas para leads_crm (últimos 3 dias)
  const since3d = new Date(hoje);
  since3d.setDate(since3d.getDate() - 2);
  const sinceIso = since3d.toISOString().slice(0, 10) + "T00:00:00";
  const untilIso = hoje.toISOString().slice(0, 10) + "T23:59:59";

  // Carrega employees ativos para lookup de telefone por nome
  const { data: emps } = await supabase
    .from("employees")
    .select("nome, telefone, ativo")
    .eq("ativo", true);
  const telPorNome = new Map<string, string>();
  for (const e of emps || []) {
    if (e.nome && e.telefone) telPorNome.set(e.nome.trim().toLowerCase(), e.telefone);
  }

  const resultados: {
    notion_id: string;
    nome: string | null;
    spend: number;
    leads: number;
    alerta: boolean;
    whatsapp?: "enviado" | "falhou" | "sem_telefone";
    erro?: string;
  }[] = [];

  for (const c of clientes || []) {
    try {
      if (!c.meta_campaign_id) continue;

      const spend = await fetchSpend3d(c.meta_campaign_id);

      const { count } = await supabase
        .from("leads_crm")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", c.meta_campaign_id)
        .gte("ghl_created_at", sinceIso)
        .lte("ghl_created_at", untilIso);
      const leads = count || 0;

      const alerta = spend > 0 && leads === 0;

      if (!alerta) {
        resultados.push({
          notion_id: c.notion_id,
          nome: c.cliente,
          spend,
          leads,
          alerta: false,
        });
        continue;
      }

      // Já existe alerta ativo do mesmo tipo? Não duplica.
      const { data: existente } = await supabase
        .from("alertas_cliente")
        .select("id")
        .eq("cliente_notion_id", c.notion_id)
        .eq("tipo", "campanha_sem_leads")
        .is("resolvido_em", null)
        .limit(1);

      let whatsapp: "enviado" | "falhou" | "sem_telefone" = "sem_telefone";

      if (!existente || existente.length === 0) {
        const mensagem = `⚠️ ${c.cliente}: campanha com gasto nos últimos 3 dias mas zero leads recebidos. Verificar campanha no Meta Ads.`;

        await supabase.from("alertas_cliente").insert({
          cliente_notion_id: c.notion_id,
          tipo: "campanha_sem_leads",
          mensagem,
          metadata: { spend, leads, campaign_id: c.meta_campaign_id, dias: 3 },
        });

        const telAnalista = c.analista
          ? telPorNome.get(c.analista.trim().toLowerCase()) || null
          : null;

        if (telAnalista) {
          const r = await sendWhatsAppText(telAnalista, mensagem);
          whatsapp = r.success ? "enviado" : "falhou";
          if (r.success) {
            await supabase
              .from("alertas_cliente")
              .update({ notificado_whatsapp: true })
              .eq("cliente_notion_id", c.notion_id)
              .eq("tipo", "campanha_sem_leads")
              .is("resolvido_em", null);
          }
        }
      }

      resultados.push({
        notion_id: c.notion_id,
        nome: c.cliente,
        spend,
        leads,
        alerta: true,
        whatsapp,
      });
    } catch (e) {
      resultados.push({
        notion_id: c.notion_id,
        nome: c.cliente,
        spend: 0,
        leads: 0,
        alerta: false,
        erro: String(e),
      });
    }
  }

  return NextResponse.json({
    processados: resultados.length,
    alertas_abertos: resultados.filter((r) => r.alerta).length,
    erros: resultados.filter((r) => r.erro).length,
    resultados,
  });
}
