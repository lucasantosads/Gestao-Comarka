/**
 * GET  /api/team/situation-history?cliente_notion_id=...
 *      → últimas 50 mudanças de situação do cliente
 *
 * POST /api/team/situation-history
 *      Body: { cliente_notion_id, situacao_nova, contexto }
 *      Faz UPDATE em clientes_notion_mirror.situacao (o trigger insere a row
 *      base no histórico) e em seguida atualiza essa row mais recente com
 *      `contexto` + `gestor_id` da sessão. Origem: 'gestor_manual'.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("cliente_notion_id");
  if (!id) return NextResponse.json({ error: "cliente_notion_id obrigatório" }, { status: 400 });

  const { data, error } = await supabase
    .from("client_situation_history")
    .select("*")
    .eq("cliente_notion_id", id)
    .order("data_mudanca", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  const { cliente_notion_id, situacao_nova, contexto } = body || {};
  if (!cliente_notion_id || !situacao_nova) {
    return NextResponse.json({ error: "cliente_notion_id e situacao_nova obrigatórios" }, { status: 400 });
  }

  // Atualiza a mirror — o trigger se encarrega de gravar a row base no histórico
  const { error: upErr } = await supabase
    .from("clientes_notion_mirror")
    .update({ situacao: situacao_nova })
    .eq("notion_id", cliente_notion_id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Anexa contexto + gestor_id à row mais recente para esse cliente
  const { data: recente } = await supabase
    .from("client_situation_history")
    .select("id")
    .eq("cliente_notion_id", cliente_notion_id)
    .order("data_mudanca", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recente?.id) {
    await supabase
      .from("client_situation_history")
      .update({ contexto: contexto || null, gestor_id: session?.employeeId || null })
      .eq("id", recente.id);
  }

  return NextResponse.json({ success: true });
}
