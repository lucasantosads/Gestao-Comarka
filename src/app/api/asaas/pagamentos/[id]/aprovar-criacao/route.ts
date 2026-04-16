/**
 * PATCH /api/asaas/pagamentos/[id]/aprovar-criacao
 * Aprovar ou reprovar criação de cobrança no Asaas (somente admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

const ASAAS_BASE = "https://api.asaas.com/v3";

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

  // Buscar pagamento
  const { data: pag } = await supabase
    .from("asaas_pagamentos")
    .select("*")
    .eq("id", pagId)
    .is("deleted_at", null)
    .single();

  if (!pag) return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
  if (pag.aprovacao_criacao_status !== "aguardando") {
    return NextResponse.json({ error: "Pagamento já processado" }, { status: 400 });
  }

  if (aprovado) {
    // Criar cobrança no Asaas
    const asaasKey = process.env.ASAAS_API_KEY;
    if (!asaasKey) {
      return NextResponse.json({ error: "ASAAS_API_KEY não configurada" }, { status: 500 });
    }

    try {
      const asaasBody: Record<string, unknown> = {
        value: pag.valor,
        dueDate: pag.data_vencimento,
        description: pag.descricao || "",
        billingType: pag.tipo === "pix" ? "PIX" : pag.tipo === "credit_card" ? "CREDIT_CARD" : "BOLETO",
      };

      // Se tiver cliente vinculado, buscar customer no Asaas ou usar customer genérico
      if (pag.cliente_id) {
        const { data: cliente } = await supabase
          .from("clientes")
          .select("nome, email")
          .eq("id", pag.cliente_id)
          .single();
        if (cliente) {
          asaasBody.description = `${cliente.nome} - ${pag.descricao || ""}`;
        }
      }

      const res = await fetch(`${ASAAS_BASE}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: asaasKey,
        },
        body: JSON.stringify(asaasBody),
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ error: `Asaas API: ${errText.slice(0, 300)}` }, { status: 500 });
      }

      const asaasData = await res.json();

      await supabase
        .from("asaas_pagamentos")
        .update({
          asaas_id: asaasData.id,
          aprovacao_criacao_status: "aprovado",
          aprovacao_criacao_por: session.employeeId,
          aprovacao_criacao_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", pagId);

      await supabase.from("asaas_auditoria").insert({
        pagamento_id: pagId,
        acao: "criacao_aprovada",
        executado_por: session.employeeId,
        observacao: observacao || `Aprovado. Asaas ID: ${asaasData.id}`,
        ip_sessao: ip,
      });

      return NextResponse.json({ success: true, asaas_id: asaasData.id });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  } else {
    // Reprovado
    await supabase
      .from("asaas_pagamentos")
      .update({
        aprovacao_criacao_status: "reprovado",
        aprovacao_criacao_por: session.employeeId,
        aprovacao_criacao_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", pagId);

    await supabase.from("asaas_auditoria").insert({
      pagamento_id: pagId,
      acao: "criacao_reprovada",
      executado_por: session.employeeId,
      observacao: observacao || "Criação reprovada",
      ip_sessao: ip,
    });

    return NextResponse.json({ success: true, status: "reprovado" });
  }
}
