import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const filtro = req.nextUrl.searchParams.get("filtro") || "minhas"; // minhas | criadas | todas
  const entityId = session.entityId;

  let query = supabase.from("tarefas").select("*").is("deleted_at", null).order("prazo", { ascending: true });

  if (session.role !== "admin" && filtro === "minhas") {
    query = query.eq("atribuido_para", entityId);
  } else if (session.role !== "admin" && filtro === "criadas") {
    query = query.eq("criado_por", entityId);
  } else if (session.role !== "admin" && filtro === "todas") {
    query = query.or(`atribuido_para.eq.${entityId},criado_por.eq.${entityId}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  const { titulo, descricao, atribuido_para, tipo, prioridade, prazo } = body;

  if (!titulo || !prazo) return NextResponse.json({ error: "titulo e prazo obrigatórios" }, { status: 400 });

  const { data, error } = await supabase.from("tarefas").insert({
    titulo, descricao: descricao || null,
    criado_por: session.entityId,
    atribuido_para: atribuido_para || session.entityId,
    tipo: tipo || "outro", prioridade: prioridade || "media", prazo,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
