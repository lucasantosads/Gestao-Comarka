import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

// Calcula total de segundos considerando cronômetro em andamento
function computeTotal(row: { total_segundos: number; em_andamento: boolean; ultimo_inicio: string | null }) {
  let total = Number(row.total_segundos || 0);
  if (row.em_andamento && row.ultimo_inicio) {
    total += Math.floor((Date.now() - new Date(row.ultimo_inicio).getTime()) / 1000);
  }
  return total;
}

export async function GET(req: NextRequest) {
  const responsavel = req.nextUrl.searchParams.get("responsavel");
  const responsavelId = req.nextUrl.searchParams.get("responsavel_id");

  let query = supabase.from("tarefas_kanban").select("*").is("deleted_at", null).order("created_at", { ascending: false });

  if (responsavelId) {
    query = query.eq("responsavel_id", responsavelId);
  } else if (responsavel) {
    query = query.ilike("responsavel", `%${responsavel}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (data || []).map((r) => ({ ...r, tempo_total: computeTotal(r) }));
  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();

  // Resolver nomes a partir de IDs para manter compatibilidade
  let responsavelNome = body.responsavel || "";
  let solicitanteNome = body.solicitante || "";

  if (body.responsavel_id) {
    const { data: emp } = await supabase.from("employees").select("nome").eq("id", body.responsavel_id).single();
    if (emp) responsavelNome = emp.nome;
  }
  if (body.solicitante_id) {
    const { data: emp } = await supabase.from("employees").select("nome").eq("id", body.solicitante_id).single();
    if (emp) solicitanteNome = emp.nome;
  }

  // Resolver nome do cliente a partir de cliente_id
  let clienteNome = body.cliente || null;
  if (body.cliente_id) {
    const { data: cli } = await supabase.from("clientes").select("nome").eq("id", body.cliente_id).single();
    if (cli) clienteNome = cli.nome;
  }

  const { data, error } = await supabase.from("tarefas_kanban").insert({
    titulo: body.titulo, descricao: body.descricao || null,
    responsavel: responsavelNome, solicitante: solicitanteNome || null,
    responsavel_id: body.responsavel_id || null,
    solicitante_id: body.solicitante_id || (session?.employeeId || null),
    cliente: clienteNome, cliente_id: body.cliente_id || null,
    setor: body.setor || null,
    urgencia: body.urgencia || "Média", status: body.status || "a_fazer",
    data_vencimento: body.data_vencimento || null,
    tipo_tarefa: body.tipo_tarefa || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  // Helper: pausar timer e fechar sessão ativa
  async function pausarTimer(current: any, now: string) {
    const extra = Math.floor((Date.now() - new Date(current.ultimo_inicio).getTime()) / 1000);
    fields.total_segundos = (current.total_segundos || 0) + extra;
    fields.em_andamento = false;
    fields.ultimo_inicio = null;
    // Fechar time_session ativa
    await supabase.from("time_sessions")
      .update({ pausado_em: now, duracao_segundos: extra })
      .eq("tarefa_id", id)
      .is("pausado_em", null)
      .order("iniciado_em", { ascending: false })
      .limit(1);
  }

  // Helper: iniciar timer e criar sessão
  async function iniciarTimer(current: any, now: string) {
    fields.em_andamento = true;
    fields.ultimo_inicio = now;
    if (!current.iniciado_em) fields.iniciado_em = now;
    // Criar time_session
    await supabase.from("time_sessions").insert({
      tarefa_id: id,
      colaborador_id: current.responsavel_id || null,
      iniciado_em: now,
      data_referencia: now.split("T")[0],
    });
  }

  // Cronômetro: transição de status
  if (fields.status) {
    const { data: current } = await supabase.from("tarefas_kanban").select("*").eq("id", id).single();
    if (current) {
      const now = new Date().toISOString();

      // → fazendo: inicia cronômetro
      if (fields.status === "fazendo" && current.status !== "fazendo") {
        await iniciarTimer(current, now);
      }
      // fazendo → a_fazer: pausa (acumula tempo)
      if (fields.status === "a_fazer" && current.status === "fazendo" && current.em_andamento && current.ultimo_inicio) {
        await pausarTimer(current, now);
      }
      // → concluido: finaliza (pausa se rodando + trava)
      if (fields.status === "concluido" && current.status !== "concluido") {
        if (current.em_andamento && current.ultimo_inicio) {
          await pausarTimer(current, now);
        }
        fields.em_andamento = false;
        fields.ultimo_inicio = null;
        fields.finalizado_em = now;
        fields.cronometro_encerrado = true;
      }
    }
  }

  // Toggle play/pause manual (via action: "toggle_timer")
  if (fields.action === "toggle_timer") {
    const { data: current } = await supabase.from("tarefas_kanban").select("*").eq("id", id).single();
    if (current?.cronometro_encerrado) {
      return NextResponse.json({ error: "Tarefa concluída: cronômetro travado" }, { status: 409 });
    }
    if (current) {
      const now = new Date().toISOString();
      if (current.em_andamento && current.ultimo_inicio) {
        await pausarTimer(current, now);
      } else {
        await iniciarTimer(current, now);
      }
    }
    delete fields.action;
  }

  fields.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from("tarefas_kanban").update(fields).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, tempo_total: computeTotal(data) });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  // Soft delete
  const { error } = await supabase.from("tarefas_kanban").update({
    deleted_at: new Date().toISOString(),
    deleted_by: session?.employeeId || null,
  }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
