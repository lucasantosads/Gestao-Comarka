import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { notion_id, data, comentarios, feito, proxima_vez, solicitado, snapshot_metricas } = body;
  if (!notion_id || !data) return NextResponse.json({ error: "notion_id e data obrigatórios" }, { status: 400 });

  const { data: inserted, error } = await supabase.from("otimizacoes_historico").insert({
    notion_id, data,
    comentarios: comentarios || null,
    feito: feito || null, proxima_vez: proxima_vez || null, solicitado: solicitado || null,
    fonte: "dashboard",
    data_confirmacao: new Date().toISOString(),
    snapshot_metricas: snapshot_metricas || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(inserted);
}

export async function PATCH(req: NextRequest) {
  const { id, confirm, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const update: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
  if (confirm) {
    update.data_confirmacao = new Date().toISOString();
  }
  const { data, error } = await supabase.from("otimizacoes_historico").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Soft delete
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const { error } = await supabase.from("otimizacoes_historico").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
