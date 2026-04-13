/**
 * POST /api/financeiro/custos-fixos/pagamentos
 * Marca um custo fixo como pago e lança automaticamente em despesas.
 *
 * GET → lista pagamentos por mês
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes");
  let q = supabase.from("custos_fixos_pagamentos").select("*");
  if (mes) q = q.eq("mes_referencia", mes);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { custo_fixo_id, tipo, mes_referencia, nome, valor, categoria } = body;
  if (!custo_fixo_id || !tipo || !mes_referencia) {
    return NextResponse.json({ error: "custo_fixo_id, tipo e mes_referencia obrigatórios" }, { status: 400 });
  }

  // 1. Marcar como pago (upsert)
  const { error: pagErr } = await supabase.from("custos_fixos_pagamentos").upsert({
    custo_fixo_id, tipo, mes_referencia,
    status: "pago",
    pago_em: new Date().toISOString(),
    valor_pago: valor || 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: "custo_fixo_id,tipo,mes_referencia" });
  if (pagErr) return NextResponse.json({ error: pagErr.message }, { status: 500 });

  // 2. Lançar em despesas (mesma tabela usada em /financeiro/custos)
  // Usa data_lancamento = primeiro dia do mes_referencia
  const dataLancamento = `${mes_referencia}-01`;
  const categoriaFinal = categoria || (tipo === "folha" ? "Folha" : tipo === "parcelamento" ? "Parcelamento" : "Outros");
  const { error: despErr } = await supabase.from("despesas").insert({
    data_lancamento: dataLancamento,
    descricao: nome || `${tipo} ${mes_referencia}`,
    conta: "Automático",
    categoria: categoriaFinal,
    valor: Number(valor || 0),
    tipo: tipo === "parcelamento" ? "parcelamento" : "variavel",
  });
  if (despErr) {
    return NextResponse.json({ error: `Pago OK mas falha ao lançar em despesas: ${despErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, lancado: true });
}

// PATCH — reverter pagamento
export async function DELETE(req: NextRequest) {
  const custoFixoId = req.nextUrl.searchParams.get("custo_fixo_id");
  const tipo = req.nextUrl.searchParams.get("tipo");
  const mes = req.nextUrl.searchParams.get("mes");
  if (!custoFixoId || !tipo || !mes) return NextResponse.json({ error: "params obrigatórios" }, { status: 400 });
  const { error } = await supabase.from("custos_fixos_pagamentos")
    .update({ status: "pendente", pago_em: null })
    .eq("custo_fixo_id", custoFixoId).eq("tipo", tipo).eq("mes_referencia", mes);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
