import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession, canManageCargo } from "@/lib/session";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { data, error } = await supabase.from("employees").select("*").eq("id", params.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  // Verifica permissão: quem está editando pode mexer no cargo atual do target?
  // E no cargo novo se estiver mudando?
  const { data: target } = await supabase.from("employees").select("cargo").eq("id", params.id).maybeSingle();
  if (target && !canManageCargo(session, target.cargo || "")) {
    return NextResponse.json({ error: `Você não tem permissão para editar este colaborador` }, { status: 403 });
  }

  const body = await req.json();

  // Bloquear desativação se tem tarefas pendentes
  if (body.ativo === false) {
    const { count } = await supabase
      .from("tarefas")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .in("status", ["a_fazer", "em_andamento", "fazendo", "backlog"])
      .or(`responsavel_id.eq.${params.id},responsaveis_ids.cs.{${params.id}}`);

    if (count && count > 0) {
      return NextResponse.json({
        error: `Este colaborador possui ${count} tarefa${count > 1 ? "s" : ""} pendente${count > 1 ? "s" : ""}. Reatribua as tarefas antes de desativar.`,
      }, { status: 400 });
    }
  }

  if (body.cargo && !canManageCargo(session, body.cargo)) {
    return NextResponse.json({ error: `Você não tem permissão para atribuir o cargo "${body.cargo}"` }, { status: 403 });
  }
  const updates: Record<string, unknown> = {};
  const allowed = ["nome", "usuario", "role", "cargo", "email", "ativo", "telefone", "data_admissao", "foto_url", "cargo_nivel", "is_gestor_trafego", "is_head_operacional"];
  const nullableOnEmpty = new Set(["data_admissao", "email", "telefone", "foto_url"]);
  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates[key] = nullableOnEmpty.has(key) && body[key] === "" ? null : body[key];
    }
  }

  // Se mudou senha
  if (body.senha) {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(body.senha));
    updates.senha_hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
    updates.senha_visivel = body.senha;
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from("employees").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Propaga nome/cargo/salário/dia_vencimento para a folha se algum desses veio no body
  const folhaUpdates: Record<string, unknown> = {};
  if (body.nome !== undefined) folhaUpdates.nome = body.nome;
  if (body.cargo !== undefined) folhaUpdates.cargo = body.cargo;
  if (body.salario !== undefined) folhaUpdates.valor = Number(body.salario || 0);
  if (body.dia_vencimento !== undefined) folhaUpdates.dia_vencimento = body.dia_vencimento ? Number(body.dia_vencimento) : null;
  if (body.ativo !== undefined) folhaUpdates.ativo = body.ativo;
  if (Object.keys(folhaUpdates).length > 0) {
    // Garante que existe entrada folha; se não existe, cria
    const { data: existing } = await supabase.from("custos_fixos_recorrentes")
      .select("id").eq("employee_id", params.id).eq("tipo", "folha").maybeSingle();
    if (existing) {
      await supabase.from("custos_fixos_recorrentes").update(folhaUpdates).eq("id", existing.id);
    } else {
      await supabase.from("custos_fixos_recorrentes").insert({
        nome: data.nome, tipo: "folha", cargo: data.cargo,
        valor: Number(body.salario || 0),
        dia_vencimento: body.dia_vencimento ? Number(body.dia_vencimento) : null,
        ativo: data.ativo ?? true,
        employee_id: params.id,
      });
    }
  }

  return NextResponse.json(data);
}
