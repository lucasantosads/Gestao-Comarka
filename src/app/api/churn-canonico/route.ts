/**
 * GET /api/churn-canonico?mes=2026-04
 *
 * Fonte ÚNICA de métricas de churn — sempre puxa de churn_monthly_summary.
 * Usado por: /churn (Vendas) e /recebimentos (Entradas).
 *
 * Retorna métricas para o mês solicitado (ou mês atual se não passado).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function GET(req: NextRequest) {
  const mesParam = req.nextUrl.searchParams.get("mes");
  const mesAlvo = mesParam || (() => {
    const d = new Date();
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  // Aceitar ambos formatos: "2026-04" ou "2026/04"
  const mesNorm = mesAlvo.replace("-", "/");

  const { data: all, error } = await supabase
    .from("churn_monthly_summary")
    .select("*")
    .order("ano_mes", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = all || [];
  const mesAtual = summary.find((s) => s.ano_mes === mesNorm);

  // Calcular receita_churned do mês via tabela clientes (única fonte de MRR perdido com nome)
  const ano = mesNorm.split("/")[0];
  const mes = mesNorm.split("/")[1];
  const inicio = `${ano}-${mes}-01`;
  const proxMes = Number(mes) === 12 ? `${Number(ano) + 1}-01-01` : `${ano}-${String(Number(mes) + 1).padStart(2, "0")}-01`;
  const { data: churnsMes } = await supabase
    .from("clientes")
    .select("mrr")
    .eq("status", "cancelado")
    .gte("data_cancelamento", inicio)
    .lt("data_cancelamento", proxMes);
  const receitaChurned = (churnsMes || []).reduce((s, c) => s + Number(c.mrr || 0), 0);

  // Total geral acumulado
  const totalSaidasAcum = summary.reduce((s, m) => s + (m.num_saidas || 0), 0);

  return NextResponse.json({
    mes: mesNorm,
    churn_rate: Number(mesAtual?.churn_rate || 0),
    num_saidas: mesAtual?.num_saidas || 0,
    total_clientes: mesAtual?.total_clientes || 0,
    receita_churned: receitaChurned,
    historico: summary.map((m) => ({
      mes: m.ano_mes,
      churn_rate: Number(m.churn_rate),
      num_saidas: m.num_saidas,
      total_clientes: m.total_clientes,
      is_historico: m.is_historico,
    })),
    total_acumulado: totalSaidasAcum,
  });
}
