/**
 * POST /api/webhooks/ghl — GHL Opportunity Stage Change
 * GET  /api/webhooks/ghl — Health check (retorna 200)
 *
 * Webhooks existentes no projeto (levantamento):
 *  - /api/ghl/opportunities     (GET — busca oportunidades do GHL)
 *  - /api/ghl/pipelines         (GET — busca pipelines do GHL)
 *  - /api/ghl/test-connection   (GET — testa conexão com GHL)
 *  - /api/asaas/sync            (POST — sync Asaas, protegido por CRON_SECRET)
 *  - /api/asaas/pagamentos/*    (CRUD pagamentos)
 *  - /api/webhooks/ghl          (NOVO — este arquivo)
 *  - /api/webhooks/transcricao  (NOVO — tl;dv e Fathom)
 *  - /api/webhooks/asaas        (NOVO — eventos Asaas)
 *
 * Valida header Authorization: Bearer WEBHOOK_SECRET.
 * Ao receber: insere/atualiza leads_crm.
 * Registra chamada recebida em sistema_rate_limit_log.
 * Se erro: insere em sistema_fila_erros.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  return NextResponse.json({ status: "ok", webhook: "ghl" });
}

export async function POST(req: NextRequest) {
  // Validar token
  const authHeader = req.headers.get("authorization");
  const webhookSecret = process.env.WEBHOOK_SECRET || process.env.CRON_SECRET;
  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    await logError("Payload JSON inválido", null);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Registrar chamada no rate limit log
  try {
    await supabase.from("sistema_rate_limit_log").insert({
      servico: "ghl",
      endpoint: "/api/webhooks/ghl",
      chamadas_hora: 1,
      chamadas_dia: 1,
      pct_utilizado: 0,
    });
  } catch {}

  try {
    // Extrair dados da oportunidade GHL
    const opp = payload as Record<string, unknown>;
    const ghlOppId = (opp.id || opp.opportunity_id || opp.contactId) as string;
    const nome = (opp.contact_name || opp.name || opp.full_name || "") as string;
    const email = (opp.contact_email || opp.email || "") as string;
    const telefone = (opp.contact_phone || opp.phone || "") as string;
    const etapa = (opp.stage_name || opp.pipeline_stage || opp.status || "") as string;
    const pipelineId = (opp.pipeline_id || opp.pipelineId || "") as string;
    const monetaryValue = opp.monetary_value || opp.monetaryValue;
    const mrr = monetaryValue ? Number(monetaryValue) : null;

    if (!ghlOppId) {
      await logError("Payload sem ID de oportunidade", payload);
      return NextResponse.json({ error: "Missing opportunity ID" }, { status: 400 });
    }

    // Upsert em leads_crm — NUNCA sobrescrever mes_referencia (regra global)
    const { error } = await supabase
      .from("leads_crm")
      .upsert(
        {
          ghl_opportunity_id: ghlOppId,
          nome,
          email,
          telefone,
          etapa,
          pipeline_id: pipelineId,
          ...(mrr !== null ? { mrr } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "ghl_opportunity_id", ignoreDuplicates: false }
      );

    if (error) {
      await logError(`Erro ao upsert lead: ${error.message}`, payload);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ghl_opportunity_id: ghlOppId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logError(msg, payload);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function logError(mensagem: string, payload: unknown) {
  try {
    await supabase.from("sistema_fila_erros").insert({
      origem: "webhook_ghl",
      tipo_erro: "processamento_falhou",
      mensagem,
      payload: payload as Record<string, unknown>,
    });
  } catch {}
}
