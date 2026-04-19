import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
);

// GET: retorna employees + tipos de tarefa para configuração
export async function GET() {
  const [{ data: employees }, { data: tipos }] = await Promise.all([
    supabase.from("employees").select("id, nome, meta_horas_semanais, alerta_inatividade_horas, ativo").eq("ativo", true).order("nome"),
    supabase.from("tipo_tarefa_opcoes").select("*").is("deleted_at", null).order("nome"),
  ]);
  return NextResponse.json({ employees: employees || [], tipos: tipos || [] });
}

// PATCH: atualizar meta individual, aplicar a todos, ou CRUD tipo_tarefa
export async function PATCH(req: NextRequest) {
  const body = await req.json();

  // Atualizar meta individual
  if (body.action === "update_meta" && body.employee_id) {
    const updates: Record<string, unknown> = {};
    if (body.meta_horas_semanais !== undefined) updates.meta_horas_semanais = body.meta_horas_semanais;
    if (body.alerta_inatividade_horas !== undefined) updates.alerta_inatividade_horas = body.alerta_inatividade_horas;
    const { error } = await supabase.from("employees").update(updates).eq("id", body.employee_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Aplicar meta a todos
  if (body.action === "apply_all") {
    const { error } = await supabase.from("employees").update({
      meta_horas_semanais: body.meta_horas_semanais,
    }).eq("ativo", true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Aplicar threshold a todos
  if (body.action === "apply_threshold_all") {
    const { error } = await supabase.from("employees").update({
      alerta_inatividade_horas: body.alerta_inatividade_horas,
    }).eq("ativo", true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Adicionar tipo de tarefa
  if (body.action === "add_tipo") {
    const { data, error } = await supabase.from("tipo_tarefa_opcoes").insert({ nome: body.nome, cor: body.cor || "#6366f1" }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Editar tipo de tarefa
  if (body.action === "edit_tipo" && body.id) {
    const updates: Record<string, unknown> = {};
    if (body.nome !== undefined) updates.nome = body.nome;
    if (body.cor !== undefined) updates.cor = body.cor;
    const { error } = await supabase.from("tipo_tarefa_opcoes").update(updates).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Soft delete tipo de tarefa
  if (body.action === "delete_tipo" && body.id) {
    const { error } = await supabase.from("tipo_tarefa_opcoes").update({ deleted_at: new Date().toISOString() }).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "action inválida" }, { status: 400 });
}
