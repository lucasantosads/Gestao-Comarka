/**
 * GET/POST /api/trafego/criativos
 * CRUD para criativos de tráfego.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cliente_id = searchParams.get("cliente_id");
  const status = searchParams.get("status");
  const tipo = searchParams.get("tipo");
  const nicho = searchParams.get("nicho");

  let query = supabase
    .from("trafego_criativos")
    .select("*")
    .is("deleted_at", null)
    .order("criado_em", { ascending: false });

  if (cliente_id) query = query.eq("cliente_id", cliente_id);
  if (status) query = query.eq("status_veiculacao", status);
  if (tipo) query = query.eq("tipo", tipo);
  if (nicho) query = query.eq("nicho", nicho);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Buscar métricas mais recentes para cada criativo
  const ids = (data || []).map((c) => c.id);
  let metricas: Record<string, unknown>[] = [];
  if (ids.length > 0) {
    const { data: m } = await supabase
      .from("trafego_criativo_metricas")
      .select("*")
      .in("criativo_id", ids)
      .order("mes_referencia", { ascending: false });
    metricas = m || [];
  }

  const metricasByCriativo = new Map<string, typeof metricas[0]>();
  for (const m of metricas) {
    const cid = m.criativo_id as string;
    if (!metricasByCriativo.has(cid)) metricasByCriativo.set(cid, m);
  }

  const result = (data || []).map((c) => ({
    ...c,
    metricas_atuais: metricasByCriativo.get(c.id) || null,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nome, cliente_id, tipo, nicho, ad_id, copy_texto, roteiro_texto, arquivo_url } = body;

  if (!nome || !cliente_id || !tipo) {
    return NextResponse.json({ error: "nome, cliente_id e tipo obrigatórios" }, { status: 400 });
  }

  const transcricao_status = (tipo === "roteiro" || (tipo === "imagem" && copy_texto))
    ? "manual" : "pendente";

  const { data, error } = await supabase
    .from("trafego_criativos")
    .insert({
      nome, cliente_id, tipo, nicho, ad_id,
      copy_texto, roteiro_texto, arquivo_url,
      transcricao_status,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Se roteiro ou copy manual: disparar análise automaticamente
  if (transcricao_status === "manual" && data) {
    fetch(`${req.url.split("/api/")[0]}/api/ia/analisar-criativo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criativo_id: data.id }),
    }).catch(() => {});
  }

  return NextResponse.json(data);
}
