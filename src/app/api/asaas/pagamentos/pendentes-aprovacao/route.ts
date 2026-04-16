/**
 * GET /api/asaas/pagamentos/pendentes-aprovacao
 * Retorna pagamentos aguardando aprovação (criação ou recebimento).
 * Usado para badge de notificação no menu financeiro.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const [{ data: criacao, count: countCriacao }, { data: recebimento, count: countRecebimento }] =
    await Promise.all([
      supabase
        .from("asaas_pagamentos")
        .select("id, descricao, valor, data_vencimento, tipo, criado_em, clientes(nome)", { count: "exact" })
        .eq("aprovacao_criacao_status", "aguardando")
        .is("deleted_at", null)
        .order("criado_em", { ascending: false }),
      supabase
        .from("asaas_pagamentos")
        .select("id, descricao, valor, data_vencimento, tipo, status, clientes(nome)", { count: "exact" })
        .eq("aprovacao_recebimento_status", "aguardando")
        .is("deleted_at", null)
        .order("criado_em", { ascending: false }),
    ]);

  return NextResponse.json({
    pendentes_criacao: criacao || [],
    pendentes_recebimento: recebimento || [],
    total: (countCriacao || 0) + (countRecebimento || 0),
  });
}
