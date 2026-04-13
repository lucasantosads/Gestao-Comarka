/**
 * POST /api/asaas/sync
 * Protegido por CRON_SECRET. Sincroniza pagamentos dos últimos 30 dias do Asaas.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { conciliarPagamento } from "@/lib/asaas-conciliacao";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ASAAS_BASE = "https://api.asaas.com/v3";

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

export async function POST(req: NextRequest) {
  // Verificar CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const asaasKey = process.env.ASAAS_API_KEY;
  if (!asaasKey) {
    return NextResponse.json({ error: "ASAAS_API_KEY não configurada" }, { status: 500 });
  }

  // Últimos 30 dias
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);

  let offset = 0;
  const limit = 100;
  let totalSynced = 0;
  let totalCreated = 0;
  let totalUpdated = 0;

  try {
    while (true) {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(limit),
        "dateCreated[ge]": sinceStr,
      });

      const res = await fetch(`${ASAAS_BASE}/payments?${params}`, {
        headers: { access_token: asaasKey },
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ error: `Asaas API: ${errText.slice(0, 300)}` }, { status: 500 });
      }

      const body = await res.json();
      const payments = body.data || [];

      if (payments.length === 0) break;

      for (const p of payments) {
        const asaasId = p.id;
        const status = mapAsaasStatus(p.status);
        const dataPagamento = p.paymentDate || p.confirmedDate || null;

        // Verificar se já existe
        const { data: existing } = await supabase
          .from("asaas_pagamentos")
          .select("id, status")
          .eq("asaas_id", asaasId)
          .maybeSingle();

        if (existing) {
          // Atualizar status e data_pagamento
          if (existing.status !== status) {
            await supabase
              .from("asaas_pagamentos")
              .update({
                status,
                data_pagamento: dataPagamento,
                atualizado_em: new Date().toISOString(),
              })
              .eq("id", existing.id);

            // Se recebido, solicitar aprovação de recebimento
            if ((status === "received" || status === "confirmed") && existing.status === "pending") {
              await supabase
                .from("asaas_pagamentos")
                .update({ aprovacao_recebimento_status: "aguardando" })
                .eq("id", existing.id);

              await supabase.from("asaas_auditoria").insert({
                pagamento_id: existing.id,
                acao: "recebimento_solicitado",
                observacao: `Recebimento detectado via sync. Status Asaas: ${p.status}`,
              });
            }

            totalUpdated++;
          }
        } else {
          // Inserir novo pagamento
          const { data: newPag } = await supabase
            .from("asaas_pagamentos")
            .insert({
              asaas_id: asaasId,
              descricao: p.description || "",
              valor: p.value || 0,
              status,
              data_vencimento: p.dueDate,
              data_pagamento: dataPagamento,
              tipo: mapBillingType(p.billingType || ""),
              aprovacao_criacao_status: "aprovado",
              aprovacao_criacao_em: new Date().toISOString(),
            })
            .select("id")
            .single();

          if (newPag) {
            // Disparar conciliação automática
            await conciliarPagamento(newPag.id);
            totalCreated++;
          }
        }

        totalSynced++;
      }

      if (!body.hasMore) break;
      offset += limit;
    }

    return NextResponse.json({
      success: true,
      total_synced: totalSynced,
      created: totalCreated,
      updated: totalUpdated,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
