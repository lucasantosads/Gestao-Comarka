/**
 * PATCH /api/asaas/pagamentos/[id]/aprovar-recebimento
 * Dupla verificação para confirmar recebimento (somente admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";
import { conciliarPagamento } from "@/lib/asaas-conciliacao";

export const dynamic = "force-dynamic";

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { aprovado, observacao } = await req.json();
  const pagId = params.id;
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  const { data: pag } = await supabase
    .from("asaas_pagamentos")
    .select("*")
    .eq("id", pagId)
    .is("deleted_at", null)
    .single();

  if (!pag) return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
  if (pag.aprovacao_recebimento_status !== "aguardando") {
    return NextResponse.json({ error: "Recebimento já processado" }, { status: 400 });
  }

  if (aprovado) {
    await supabase
      .from("asaas_pagamentos")
      .update({
        status: "confirmed",
        data_pagamento: new Date().toISOString().slice(0, 10),
        aprovacao_recebimento_status: "aprovado",
        aprovacao_recebimento_por: session.employeeId,
        aprovacao_recebimento_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", pagId);

    await supabase.from("asaas_auditoria").insert({
      pagamento_id: pagId,
      acao: "recebimento_aprovado",
      executado_por: session.employeeId,
      observacao: observacao || "Recebimento confirmado",
      ip_sessao: ip,
    });

    // Disparar conciliação automática se ainda pendente
    if (pag.match_status === "pendente") {
      await conciliarPagamento(pagId);
    }

    return NextResponse.json({ success: true, status: "confirmed" });
  } else {
    await supabase
      .from("asaas_pagamentos")
      .update({
        aprovacao_recebimento_status: "reprovado",
        aprovacao_recebimento_por: session.employeeId,
        aprovacao_recebimento_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", pagId);

    await supabase.from("asaas_auditoria").insert({
      pagamento_id: pagId,
      acao: "recebimento_reprovado",
      executado_por: session.employeeId,
      observacao: observacao || "Recebimento reprovado",
      ip_sessao: ip,
    });

    return NextResponse.json({ success: true, status: "reprovado" });
  }
}
