import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function GET() {
  const { data, error } = await supabase
    .from("churn_monthly_summary")
    .select("*")
    .order("ano_mes", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ano_mes, num_saidas, total_clientes, is_historico } = body;
  if (!ano_mes) return NextResponse.json({ error: "ano_mes obrigatório" }, { status: 400 });
  const { data, error } = await supabase
    .from("churn_monthly_summary")
    .upsert({
      ano_mes,
      num_saidas: num_saidas ?? 0,
      total_clientes: total_clientes ?? 0,
      is_historico: is_historico ?? false,
    }, { onConflict: "ano_mes" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Atualiza total_clientes do mês atual com base em clientes_receita
export async function PATCH() {
  const { data: clientes } = await supabase
    .from("clientes_receita")
    .select("status_financeiro");
  const ativos = (clientes || []).filter((c) =>
    ["ativo", "pausado", "pagou_integral", "parceria"].includes(c.status_financeiro || "")
  ).length;

  const hoje = new Date();
  const ano_mes = `${hoje.getFullYear()}/${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("churn_monthly_summary")
    .upsert({ ano_mes, total_clientes: ativos, num_saidas: 0, is_historico: false }, { onConflict: "ano_mes" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ano_mes, total_clientes: ativos, ...data });
}
