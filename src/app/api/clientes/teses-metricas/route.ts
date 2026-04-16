import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function GET(req: NextRequest) {
  const teseId = req.nextUrl.searchParams.get("tese_id");
  if (!teseId) return NextResponse.json({ error: "tese_id obrigatório" }, { status: 400 });
  const { data, error } = await supabase.from("teses_metricas")
    .select("*").eq("tese_id", teseId).order("mes_referencia", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const { tese_id, mes_referencia, investimento, leads, reunioes, contratos, receita_gerada } = await req.json();
  if (!tese_id || !mes_referencia) return NextResponse.json({ error: "tese_id e mes_referencia obrigatórios" }, { status: 400 });
  const { data, error } = await supabase.from("teses_metricas").upsert({
    tese_id, mes_referencia,
    investimento: investimento || 0,
    leads: leads || 0,
    reunioes: reunioes || 0,
    contratos: contratos || 0,
    receita_gerada: receita_gerada || 0,
  }, { onConflict: "tese_id,mes_referencia" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
