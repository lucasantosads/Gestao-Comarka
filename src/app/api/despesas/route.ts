import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 120;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes") || new Date().toISOString().slice(0, 7);

  const { data, error } = await supabase
    .from("despesas")
    .select("*")
    .eq("mes_referencia", mes)
    .is("deleted_at", null)
    .order("data_lancamento", { ascending: false })
    .limit(1000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Agrupar por categoria
  const porCategoria: Record<string, { total: number; items: typeof data }> = {};
  let totalMes = 0;
  for (const d of data || []) {
    if (d.categoria === "Ads") continue; // Ads não entra nos custos operacionais
    if (!porCategoria[d.categoria]) porCategoria[d.categoria] = { total: 0, items: [] };
    porCategoria[d.categoria].total += Number(d.valor);
    porCategoria[d.categoria].items.push(d);
    totalMes += Number(d.valor);
  }

  // Calcular subtotais
  const folhaCats = ["Equipe Operacional", "Equipe Comercial", "Equipe de MKT", "Prolabore", "Comissões"];
  const fixosCats = ["Aluguel", "Internet", "Energia", "Contador", "Ferramentas/Softwares", "Limpeza"];
  const folhaTotal = folhaCats.reduce((s, c) => s + (porCategoria[c]?.total || 0), 0);
  const fixosTotal = fixosCats.reduce((s, c) => s + (porCategoria[c]?.total || 0), 0);
  const parcelamentos = (data || []).filter((d) => d.tipo === "parcelamento" && d.categoria !== "Ads" && !d.deleted_at);
  const parcelamentosTotal = parcelamentos.reduce((s, d) => s + Number(d.valor), 0);

  return NextResponse.json({
    mes,
    total: totalMes,
    folha_total: folhaTotal,
    custos_fixos: fixosTotal,
    parcelamentos_total: parcelamentosTotal,
    parcelamentos_ativos: parcelamentos.length,
    por_categoria: porCategoria,
    lancamentos: data || [],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data_lancamento, descricao, conta, categoria, valor, tipo, parcela_atual, parcelas_total } = body;

  if (!data_lancamento || !descricao || !categoria || !valor) {
    return NextResponse.json({ error: "data_lancamento, descricao, categoria e valor obrigatórios" }, { status: 400 });
  }

  const { data, error } = await supabase.from("despesas").insert({
    data_lancamento, descricao, conta: conta || null, categoria, valor,
    tipo: tipo || "variavel",
    parcela_atual: parcela_atual || null,
    parcelas_total: parcelas_total || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
