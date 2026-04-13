import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const notionId = req.nextUrl.searchParams.get("notion_id");
  if (!notionId) return NextResponse.json({ error: "notion_id obrigatório" }, { status: 400 });
  const { data, error } = await supabase.from("reunioes_cliente")
    .select("*").eq("cliente_notion_id", notionId).order("data_reuniao", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { cliente_notion_id, tipo, data_reuniao, link_gravacao, transcricao, notas, status } = body;
  if (!cliente_notion_id || !data_reuniao) return NextResponse.json({ error: "cliente_notion_id e data_reuniao obrigatórios" }, { status: 400 });
  const { data, error } = await supabase.from("reunioes_cliente").insert({
    cliente_notion_id, tipo: tipo || "revisao", data_reuniao,
    link_gravacao: link_gravacao || null, transcricao: transcricao || null,
    notas: notas || null, status: status || "agendada",
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  fields.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("reunioes_cliente").update(fields).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const { error } = await supabase.from("reunioes_cliente").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
