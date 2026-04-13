import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const STATUS_VALIDOS = ["Ativa", "Pausada", "Em Teste"] as const;

export async function GET(req: NextRequest) {
  const notionId = req.nextUrl.searchParams.get("notion_id");
  let q = supabase.from("clientes_teses").select("*").is("deleted_at", null).order("ordem", { ascending: true });
  if (notionId) q = q.eq("notion_id", notionId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { notion_id, nome_tese, tese, tipo, publico_alvo, status, data_ativacao, observacoes, orcamento } = body;
  const nome = nome_tese || tese;
  if (!notion_id || !nome) return NextResponse.json({ error: "notion_id e nome_tese obrigatórios" }, { status: 400 });
  if (status && !STATUS_VALIDOS.includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }
  const { count } = await supabase.from("clientes_teses").select("id", { count: "exact", head: true }).eq("notion_id", notion_id).is("deleted_at", null);
  const { data, error } = await supabase.from("clientes_teses").insert({
    notion_id,
    nome_tese: nome,
    tese: nome, // legado
    tipo: tipo || null,
    publico_alvo: publico_alvo || null,
    status: status || "Ativa",
    data_ativacao: data_ativacao || new Date().toISOString().slice(0, 10),
    observacoes: observacoes || null,
    orcamento: orcamento || 0,
    ordem: count || 0,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  if (fields.status && !STATUS_VALIDOS.includes(fields.status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }
  // mantém compat: se atualizar nome_tese, espelha em tese
  if (fields.nome_tese && !fields.tese) fields.tese = fields.nome_tese;
  const { data, error } = await supabase.from("clientes_teses").update(fields).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Soft delete
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const { error } = await supabase.from("clientes_teses").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
