import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id");
  const employeeId = req.nextUrl.searchParams.get("employee_id");
  const limit = Number(req.nextUrl.searchParams.get("limit") || "30");
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";

  let query = supabase.from("notif_operacional").select("*").order("created_at", { ascending: false }).limit(limit);
  if (userId) query = query.eq("user_id", userId);
  if (employeeId) query = query.eq("employee_id", employeeId);
  if (unreadOnly) query = query.eq("lida", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await supabase.from("notif_operacional").select("id", { count: "exact", head: true }).eq("lida", false);
  return NextResponse.json({ notifications: data || [], unread_count: count || 0 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { user_id, employee_id, tipo, titulo, mensagem, cliente_notion_id, tarefa_notion_id, url_destino } = body;
  if (!tipo || !titulo) return NextResponse.json({ error: "tipo e titulo obrigatórios" }, { status: 400 });

  const { data, error } = await supabase.from("notif_operacional").insert({
    user_id: user_id || null, employee_id: employee_id || null,
    tipo, titulo, mensagem: mensagem || null,
    cliente_notion_id: cliente_notion_id || null,
    tarefa_notion_id: tarefa_notion_id || null,
    url_destino: url_destino || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const { id, user_id, employee_id, mark_all } = await req.json();
  if (mark_all) {
    let q = supabase.from("notif_operacional").update({ lida: true }).eq("lida", false);
    if (user_id) q = q.eq("user_id", user_id);
    if (employee_id) q = q.eq("employee_id", employee_id);
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const { error } = await supabase.from("notif_operacional").update({ lida: true }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
