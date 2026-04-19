import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

// GET — lista tarefas soft-deleted
export async function GET() {
  const { data, error } = await supabase
    .from("tarefas_kanban")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enriquecer com nome de quem excluiu
  const deletedByIds = [...new Set((data || []).map((t) => t.deleted_by).filter(Boolean))];
  let employeesMap: Record<string, string> = {};
  if (deletedByIds.length > 0) {
    const { data: emps } = await supabase.from("employees").select("id, nome").in("id", deletedByIds);
    if (emps) employeesMap = Object.fromEntries(emps.map((e) => [e.id, e.nome]));
  }

  const enriched = (data || []).map((t) => ({
    ...t,
    deleted_by_nome: t.deleted_by ? (employeesMap[t.deleted_by] || "—") : "—",
  }));

  return NextResponse.json(enriched);
}

// PATCH — restaurar tarefa (zera deleted_at e deleted_by)
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { data, error } = await supabase
    .from("tarefas_kanban")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — exclusão permanente (física)
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  // Só permite deletar fisicamente tarefas que já passaram por soft delete
  const { data: tarefa } = await supabase.from("tarefas_kanban").select("deleted_at").eq("id", id).single();
  if (!tarefa?.deleted_at) {
    return NextResponse.json({ error: "Só é possível excluir permanentemente tarefas já na lixeira" }, { status: 400 });
  }

  const { error } = await supabase.from("tarefas_kanban").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
