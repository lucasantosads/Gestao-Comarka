/**
 * POST /api/webhooks/asaas — Eventos de pagamento Asaas
 * GET  /api/webhooks/asaas — Health check (retorna 200)
 *
 * Eventos suportados: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE
 * Valida assinatura Asaas via header asaas-access-token.
 * Ao receber: upsert em asaas_pagamentos + conciliação automática.
 * Se erro: insere em sistema_fila_erros.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { conciliarPagamento } from "@/lib/asaas-conciliacao";

export const dynamic = "force-dynamic";

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

const EVENTOS_ACEITOS = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_OVERDUE"];

function mapAsaasStatus(s: string): string {
  const map: Record<string, string> = {
    PENDING: "pending",
    RECEIVED: "received",
    CONFIRMED: "confirmed",
    OVERDUE: "overdue",
    REFUNDED: "refunded",
    RECEIVED_IN_CASH: "received",
  };
  return map[s] || "pending";
}

function mapBillingType(t: string): string {
  const map: Record<string, string> = {
    BOLETO: "boleto",
    PIX: "pix",
    CREDIT_CARD: "credit_card",
  };
  return map[t] || "outros";
}

export async function GET() {
  return NextResponse.json({ status: "ok", webhook: "asaas" });
}

export async function POST(req: NextRequest) {
  // Validar assinatura Asaas via header
  const asaasToken = req.headers.get("asaas-access-token");
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN || process.env.ASAAS_API_KEY;
  if (expectedToken && asaasToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    await logError("Payload JSON inválido", null);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = (payload.event || "") as string;

  // Filtrar apenas eventos suportados
  if (!EVENTOS_ACEITOS.includes(event)) {
    return NextResponse.json({ ok: true, skipped: true, event });
  }

  try {
    const payment = (payload.payment || payload) as Record<string, unknown>;
    const asaasId = (payment.id || "") as string;

    if (!asaasId) {
      await logError("Payload sem ID de pagamento", payload);
      return NextResponse.json({ error: "Missing payment ID" }, { status: 400 });
    }

    // Upsert em asaas_pagamentos
    const upsertData = {
      asaas_id: asaasId,
      customer_name: (payment.customerName || payment.customer || "") as string,
      customer_email: (payment.customerEmail || "") as string,
      valor: Number(payment.value || payment.netValue || 0),
      valor_liquido: Number(payment.netValue || payment.value || 0),
      status: mapAsaasStatus(String(payment.status || "")),
      tipo_cobranca: mapBillingType(String(payment.billingType || "")),
      data_vencimento: (payment.dueDate || null) as string | null,
      data_pagamento: (payment.paymentDate || payment.confirmedDate || null) as string | null,
      descricao: (payment.description || "") as string,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("asaas_pagamentos")
      .upsert(upsertData, { onConflict: "asaas_id" });

    if (error) {
      await logError(`Erro ao upsert pagamento: ${error.message}`, payload);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Disparar conciliação automática
    try {
      await conciliarPagamento(asaasId);
    } catch (e) {
      console.error("[webhook/asaas] Erro na conciliação:", e);
    }

    return NextResponse.json({ ok: true, asaas_id: asaasId, event });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logError(msg, payload);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function logError(mensagem: string, payload: unknown) {
  try {
    await supabase.from("sistema_fila_erros").insert({
      origem: "webhook_asaas",
      tipo_erro: "processamento_falhou",
      mensagem,
      payload: payload as Record<string, unknown>,
    });
  } catch {}
}
