/**
 * GET/POST /api/trafego/regras
 * CRUD para regras de otimização de tráfego.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession, isSuperAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("trafego_regras_otimizacao")
    .select("*")
    .order("prioridade", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Buscar contagem de histórico por regra
  const regraIds = (data || []).map((r) => r.id);
  const { data: historico } = regraIds.length > 0
    ? await supabase.from("trafego_regras_historico").select("regra_id, acao").in("regra_id", regraIds)
    : { data: [] };

  const stats: Record<string, { aplicada: number; ignorada: number; disparada: number; falsa_positiva: number }> = {};
  for (const h of historico || []) {
    if (!stats[h.regra_id]) stats[h.regra_id] = { aplicada: 0, ignorada: 0, disparada: 0, falsa_positiva: 0 };
    if (h.acao === "aplicada") stats[h.regra_id].aplicada++;
    else if (h.acao === "ignorada") stats[h.regra_id].ignorada++;
    else if (h.acao === "disparada") stats[h.regra_id].disparada++;
    else if (h.acao === "falsa_positiva") stats[h.regra_id].falsa_positiva++;
  }

  const regrasComStats = (data || []).map((r) => ({
    ...r,
    stats: stats[r.id] || { aplicada: 0, ignorada: 0, disparada: 0, falsa_positiva: 0 },
  }));

  return NextResponse.json(regrasComStats);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && !isSuperAdmin(session))) {
    return NextResponse.json({ error: "Somente admin" }, { status: 403 });
  }

  const body = await req.json();
  const { nome, metrica, operador, threshold, acao_sugerida, acao_automatica, prioridade } = body;

  if (!nome || !metrica || !operador || threshold === undefined || !acao_sugerida) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("trafego_regras_otimizacao")
    .insert({ nome, metrica, operador, threshold, acao_sugerida, acao_automatica: acao_automatica || false, prioridade: prioridade || 1 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && !isSuperAdmin(session))) {
    return NextResponse.json({ error: "Somente admin" }, { status: 403 });
  }

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { error } = await supabase
    .from("trafego_regras_otimizacao")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
