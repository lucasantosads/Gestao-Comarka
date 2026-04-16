/**
 * GET  /api/team/feedbacks?cliente_notion_id=...   — últimos 10 feedbacks daquele cliente
 * GET  /api/team/feedbacks?clientes=id1,id2,...    — agrupado por cliente (último feedback + counts dos últimos 30d)
 *                                                    usado pela aba de Alertas para evitar N+1
 * POST /api/team/feedbacks                          — INSERT um novo feedback
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get("cliente_notion_id");
  const lista = searchParams.get("clientes");

  if (clienteId) {
    const { data, error } = await supabase
      .from("client_feedbacks")
      .select("*")
      .eq("cliente_notion_id", clienteId)
      .order("data_feedback", { ascending: false })
      .limit(10);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  if (lista) {
    const ids = lista.split(",").filter(Boolean);
    if (ids.length === 0) return NextResponse.json({});
    const { data, error } = await supabase
      .from("client_feedbacks")
      .select("cliente_notion_id, data_feedback")
      .in("cliente_notion_id", ids)
      .order("data_feedback", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const cutoff = Date.now() - 30 * 86400000;
    const agg: Record<string, { ultimo: string | null; total_30d: number }> = {};
    for (const id of ids) agg[id] = { ultimo: null, total_30d: 0 };
    for (const row of (data || []) as Array<{ cliente_notion_id: string; data_feedback: string }>) {
      const slot = agg[row.cliente_notion_id];
      if (!slot) continue;
      if (!slot.ultimo) slot.ultimo = row.data_feedback;
      if (new Date(row.data_feedback + "T12:00:00").getTime() >= cutoff) slot.total_30d += 1;
    }
    return NextResponse.json(agg);
  }

  return NextResponse.json({ error: "informe cliente_notion_id ou clientes" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const required = ["cliente_notion_id", "data_feedback"];
  for (const k of required) {
    if (!body[k]) return NextResponse.json({ error: `campo ${k} obrigatório` }, { status: 400 });
  }

  const insert = {
    cliente_notion_id: body.cliente_notion_id,
    gestor_id: body.gestor_id || null,
    data_feedback: body.data_feedback,
    n_contratos: body.contratos_nao_informado ? null : (body.n_contratos != null ? Number(body.n_contratos) : null),
    contratos_nao_informado: !!body.contratos_nao_informado,
    faturamento: body.faturamento_nao_informado ? null : (body.faturamento != null ? Number(body.faturamento) : null),
    faturamento_nao_informado: !!body.faturamento_nao_informado,
    data_envio_feedback: body.envio_nao_informado ? null : (body.data_envio_feedback || null),
    envio_nao_informado: !!body.envio_nao_informado,
    observacoes: body.observacoes || null,
  };

  const { data, error } = await supabase.from("client_feedbacks").insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Atualiza ultimo_feedback na mirror para refletir na tabela global
  await supabase
    .from("clientes_notion_mirror")
    .update({ ultimo_feedback: body.data_feedback })
    .eq("notion_id", body.cliente_notion_id);

  return NextResponse.json({ success: true, feedback: data });
}
