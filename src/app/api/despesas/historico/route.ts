import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 120;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const ano = req.nextUrl.searchParams.get("ano");
  const meses = Number(req.nextUrl.searchParams.get("meses") || "6");
  const hoje = new Date();

  // Gerar lista de meses
  const mesesList: string[] = [];
  if (ano) {
    // Modo ano: retorna os 12 meses do ano selecionado
    const anoNum = Number(ano);
    for (let m = 1; m <= 12; m++) {
      mesesList.push(`${anoNum}-${String(m).padStart(2, "0")}`);
    }
  } else {
    for (let i = meses; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      mesesList.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
  }

  const firstMes = mesesList[0];
  const lastMes = mesesList[mesesList.length - 1];

  const { data, error } = await supabase
    .from("despesas")
    .select("categoria, mes_referencia, valor")
    .gte("mes_referencia", firstMes)
    .lte("mes_referencia", lastMes)
    .is("deleted_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Matriz categoria × mês
  const matriz: Record<string, Record<string, number>> = {};
  const categorias = new Set<string>();

  for (const d of data || []) {
    categorias.add(d.categoria);
    if (!matriz[d.categoria]) matriz[d.categoria] = {};
    matriz[d.categoria][d.mes_referencia] = (matriz[d.categoria][d.mes_referencia] || 0) + Number(d.valor);
  }

  // Calcular média por categoria (meses com valor > 0)
  const medias: Record<string, number> = {};
  const categoriasArr = Array.from(categorias);
  for (const cat of categoriasArr) {
    const vals = mesesList.map((m) => matriz[cat]?.[m] || 0).filter((v) => v > 0);
    medias[cat] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }

  // Totais por mês
  const totais: Record<string, number> = {};
  for (const m of mesesList) {
    totais[m] = categoriasArr.reduce((s, cat) => s + (matriz[cat]?.[m] || 0), 0);
  }

  return NextResponse.json({
    meses: mesesList,
    categorias: categoriasArr.sort(),
    matriz,
    medias,
    totais,
  });
}
