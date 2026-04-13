import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const notionId = req.nextUrl.searchParams.get("notion_id");
  if (!notionId) return NextResponse.json({ error: "notion_id obrigatório" }, { status: 400 });
  const { data, error } = await supabase.from("resumos_cliente")
    .select("*").eq("cliente_notion_id", notionId).order("created_at", { ascending: false }).limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { cliente_notion_id, tipo, conteudo, periodo_inicio, periodo_fim } = body;
  if (!cliente_notion_id || !conteudo) return NextResponse.json({ error: "cliente_notion_id e conteudo obrigatórios" }, { status: 400 });
  const { data, error } = await supabase.from("resumos_cliente").insert({
    cliente_notion_id, tipo: tipo || "semanal", conteudo,
    periodo_inicio: periodo_inicio || null, periodo_fim: periodo_fim || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
