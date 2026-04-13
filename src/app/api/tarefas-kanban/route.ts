import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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
  let query = supabase.from("tarefas_kanban").select("*").order("created_at", { ascending: false });
  if (responsavel) query = query.ilike("responsavel", `%${responsavel}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (data || []).map((r) => ({ ...r, tempo_total: computeTotal(r) }));
  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabase.from("tarefas_kanban").insert({
    titulo: body.titulo, descricao: body.descricao || null,
    responsavel: body.responsavel, solicitante: body.solicitante || null,
    cliente: body.cliente || null, setor: body.setor || null,
    urgencia: body.urgencia || "Média", status: body.status || "a_fazer",
    data_vencimento: body.data_vencimento || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  // Cronômetro: transição de status
  if (fields.status) {
    const { data: current } = await supabase.from("tarefas_kanban").select("*").eq("id", id).single();
    if (current) {
      const now = new Date().toISOString();

      // a_fazer → fazendo: inicia cronômetro
      if (fields.status === "fazendo" && current.status !== "fazendo") {
        fields.em_andamento = true;
        fields.ultimo_inicio = now;
        if (!current.iniciado_em) fields.iniciado_em = now;
      }
      // fazendo → a_fazer: pausa (acumula tempo)
      if (fields.status === "a_fazer" && current.status === "fazendo" && current.em_andamento) {
        const extra = Math.floor((Date.now() - new Date(current.ultimo_inicio).getTime()) / 1000);
        fields.total_segundos = (current.total_segundos || 0) + extra;
        fields.em_andamento = false;
        fields.ultimo_inicio = null;
      }
      // fazendo → concluido: finaliza (acumula tempo + marca finalizado + trava cronômetro)
      if (fields.status === "concluido" && current.status !== "concluido") {
        if (current.em_andamento && current.ultimo_inicio) {
          const extra = Math.floor((Date.now() - new Date(current.ultimo_inicio).getTime()) / 1000);
          fields.total_segundos = (current.total_segundos || 0) + extra;
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
      if (current.em_andamento && current.ultimo_inicio) {
        // Pausar
        const extra = Math.floor((Date.now() - new Date(current.ultimo_inicio).getTime()) / 1000);
        fields.total_segundos = (current.total_segundos || 0) + extra;
        fields.em_andamento = false;
        fields.ultimo_inicio = null;
      } else {
        // Retomar
        fields.em_andamento = true;
        fields.ultimo_inicio = new Date().toISOString();
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
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const { error } = await supabase.from("tarefas_kanban").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
