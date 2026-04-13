/**
 * GET /api/projecoes/acuracia
 * Retorna histórico de acurácia das projeções.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("projecoes_historico_acuracia")
      .select("*")
      .is("deleted_at", null)
      .order("mes_referencia", { ascending: false })
      .limit(12);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const registros = data || [];

    // Calcular acurácia média dos últimos 6 meses
    const ultimos6 = registros.slice(0, 6);
    const acuraciaMedia6M = ultimos6.length > 0
      ? ultimos6.reduce((s, r) => s + (r.acuracia_media || 0), 0) / ultimos6.length
      : 0;

    // Determinar tendência do modelo: otimista se MRR projetado > realizado sistematicamente
    let mrrOtimista = 0;
    let mrrPessimista = 0;
    for (const r of ultimos6) {
      if ((r.mrr_projetado || 0) > (r.mrr_realizado || 0)) mrrOtimista++;
      else mrrPessimista++;
    }
    const tendencia_modelo = mrrOtimista > mrrPessimista ? "otimista" : mrrPessimista > mrrOtimista ? "pessimista" : "neutro";

    return NextResponse.json({
      registros,
      acuracia_media_6m: Math.round(acuraciaMedia6M * 100) / 100,
      tendencia_modelo,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
