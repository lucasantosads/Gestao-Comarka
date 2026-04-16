/**
 * GET /api/financeiro/fluxo-caixa?ano=2026
 * Fluxo de caixa mensal com saldo acumulado.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60; // KPI aggregation

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ano = Number(searchParams.get("ano") || new Date().getFullYear());

  try {
    // Fetch fixos once (same for all months)
    const { data: fixos } = await supabase
      .from("custos_fixos_recorrentes")
      .select("valor")
      .eq("ativo", true);
    const fixosTotal = (fixos || []).reduce((s, f) => s + Number(f.valor), 0);

    // Fetch all 12 months of contratos and custos in parallel
    const monthKeys = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
    const [contratosResults, custosResults] = await Promise.all([
      Promise.all(monthKeys.map((mes) =>
        supabase.from("contratos").select("mrr, valor_entrada").eq("mes_referencia", mes)
      )),
      Promise.all(monthKeys.map((mes) => {
        const mesStart = `${mes}-01`;
        const nextMonth = new Date(ano, monthKeys.indexOf(mes) + 1, 1);
        const mesEnd = nextMonth.toISOString().split("T")[0];
        return supabase.from("custos_operacionais").select("valor").gte("mes_referencia", mesStart).lt("mes_referencia", mesEnd);
      })),
    ]);

    const meses: { mes: string; entradas: number; saidas: number; saldo: number; saldo_acumulado: number }[] = [];
    let acumulado = 0;

    for (let i = 0; i < 12; i++) {
      const mes = monthKeys[i];
      const entradas = (contratosResults[i].data || []).reduce((s, c) => s + Number(c.mrr) + Number(c.valor_entrada), 0);
      const saidas = (custosResults[i].data || []).reduce((s, c) => s + Number(c.valor), 0) + fixosTotal;
      const saldo = entradas - saidas;
      acumulado += saldo;
      meses.push({ mes, entradas, saidas, saldo, saldo_acumulado: acumulado });
    }

    return NextResponse.json({ ano, meses });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
