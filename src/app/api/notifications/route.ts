import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const limit = Number(req.nextUrl.searchParams.get("limit") || "50");
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";

  let query = supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(limit);

  if (session.role !== "admin") {
    query = query.eq("employee_id", session.employeeId);
  }
  if (unreadOnly) query = query.eq("lida", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Contar não lidas
  const countQuery = session.role === "admin"
    ? supabase.from("notifications").select("id", { count: "exact", head: true }).eq("lida", false)
    : supabase.from("notifications").select("id", { count: "exact", head: true }).eq("employee_id", session.employeeId).eq("lida", false);
  const { count } = await countQuery;

  return NextResponse.json({ notifications: data, unread_count: count || 0 });
}

// Admin envia notificação
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { employee_id, titulo, mensagem, tipo } = await req.json();
  if (!employee_id || !titulo) return NextResponse.json({ error: "employee_id e titulo obrigatórios" }, { status: 400 });

  const { data, error } = await supabase.from("notifications").insert({
    employee_id, tipo: tipo || "mensagem_admin", titulo, mensagem,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Marcar como lida
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id, mark_all } = await req.json();

  if (mark_all) {
    const query = session.role === "admin"
      ? supabase.from("notifications").update({ lida: true }).eq("lida", false)
      : supabase.from("notifications").update({ lida: true }).eq("employee_id", session.employeeId).eq("lida", false);
    await query;
    return NextResponse.json({ ok: true });
  }

  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  await supabase.from("notifications").update({ lida: true }).eq("id", id);
  return NextResponse.json({ ok: true });
}
