/**
 * GET  /api/asaas/pagamentos?status=&mes=YYYY-MM&match_status=&page=1&limit=20
 * POST /api/asaas/pagamentos (admin) — criar nova cobrança (aguardando aprovação)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const mes = searchParams.get("mes");
  const matchStatus = searchParams.get("match_status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const offset = (page - 1) * limit;

  let query = supabase
    .from("asaas_pagamentos")
    .select("*, clientes(id, nome, email)", { count: "exact" })
    .is("deleted_at", null)
    .order("criado_em", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (matchStatus) query = query.eq("match_status", matchStatus);
  if (mes) {
    const [y, m] = mes.split("-").map(Number);
    const start = `${mes}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${mes}-${String(lastDay).padStart(2, "0")}`;
    query = query.gte("data_vencimento", start).lte("data_vencimento", end);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    pagamentos: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json();
  const { cliente_id, valor, data_vencimento, tipo, descricao } = body;

  if (!valor || !data_vencimento) {
    return NextResponse.json({ error: "valor e data_vencimento são obrigatórios" }, { status: 400 });
  }

  // 1. Inserir pagamento aguardando aprovação
  const { data: pag, error: errPag } = await supabase
    .from("asaas_pagamentos")
    .insert({
      cliente_id: cliente_id || null,
      valor,
      data_vencimento,
      tipo: tipo || "boleto",
      descricao: descricao || "",
      status: "pending",
      aprovacao_criacao_status: "aguardando",
    })
    .select()
    .single();

  if (errPag) return NextResponse.json({ error: errPag.message }, { status: 500 });

  // 2. Registrar auditoria
  await supabase.from("asaas_auditoria").insert({
    pagamento_id: pag.id,
    acao: "criacao_solicitada",
    executado_por: session.employeeId,
    observacao: `Cobrança de R$${valor} criada aguardando aprovação`,
  });

  return NextResponse.json({ pagamento: pag }, { status: 201 });
}
