/**
 * POST /api/financeiro/projecao-fluxo
 * Vercel Cron: todo dia 1 às 05h.
 * Calcula projeção de fluxo de caixa para os próximos 3 meses em 3 cenários.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

function addMonths(mes: string, n: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  // 1. MRR atual (soma contratos ativos)
  const { data: clientesAtivos } = await supabase
    .from("clientes_receita")
    .select("id, nome, valor_mensal, status_financeiro")
    .eq("status_financeiro", "ativo");

  const mrr = (clientesAtivos || []).reduce((s, c) => s + (c.valor_mensal || 0), 0);

  // 2. Buscar risco de churn dos clientes (da mirror)
  const { data: mirrors } = await supabase
    .from("clientes_notion_mirror")
    .select("cliente, risco_churn")
    .in("risco_churn", ["medio", "alto"]);

  const nomeRisco = new Map<string, string>();
  for (const m of mirrors || []) {
    if (m.cliente) nomeRisco.set(m.cliente.toLowerCase().trim(), m.risco_churn);
  }

  // Classificar clientes por risco
  const clientesRiscoMedio: { nome: string; valor: number }[] = [];
  const clientesRiscoAlto: { nome: string; valor: number }[] = [];

  for (const c of clientesAtivos || []) {
    const risco = nomeRisco.get(c.nome.toLowerCase().trim());
    if (risco === "medio") clientesRiscoMedio.push({ nome: c.nome, valor: c.valor_mensal || 0 });
    if (risco === "alto") clientesRiscoAlto.push({ nome: c.nome, valor: c.valor_mensal || 0 });
  }

  const mrrRiscoMedio = clientesRiscoMedio.reduce((s, c) => s + c.valor, 0);
  const mrrRiscoAlto = clientesRiscoAlto.reduce((s, c) => s + c.valor, 0);

  // 3. Custos: média dos últimos 3 meses
  const mesesPassados = [addMonths(mesAtual, -1), addMonths(mesAtual, -2), addMonths(mesAtual, -3)];

  let totalCustos3m = 0;
  let mesesComDados = 0;
  for (const mes of mesesPassados) {
    const { data: despesas } = await supabase
      .from("despesas")
      .select("valor")
      .eq("mes_referencia", mes)
      .is("deleted_at", null);

    const total = (despesas || []).reduce((s, d) => s + (d.valor || 0), 0);
    if (total > 0) {
      totalCustos3m += total;
      mesesComDados++;
    }
  }

  // Adicionar folha (custos fixos com tipo 'folha')
  for (const mes of mesesPassados) {
    const { data: folha } = await supabase
      .from("custos_fixos_pagamentos")
      .select("valor_pago")
      .eq("tipo", "folha")
      .eq("mes_referencia", mes)
      .eq("status", "pago");

    totalCustos3m += (folha || []).reduce((s, f) => s + (f.valor_pago || 0), 0);
  }

  const custosBase = mesesComDados > 0 ? totalCustos3m / Math.max(mesesComDados, 3) : totalCustos3m / 3;

  // 4. Inadimplência histórica (% de atraso dos últimos 6 meses)
  const { data: pagTotais } = await supabase
    .from("asaas_pagamentos")
    .select("id")
    .is("deleted_at", null)
    .gte("criado_em", new Date(hoje.getFullYear(), hoje.getMonth() - 6, 1).toISOString());

  const { data: pagAtrasados } = await supabase
    .from("asaas_pagamentos")
    .select("id")
    .eq("status", "overdue")
    .is("deleted_at", null)
    .gte("criado_em", new Date(hoje.getFullYear(), hoje.getMonth() - 6, 1).toISOString());

  const pctInadimplencia = (pagTotais || []).length > 0
    ? (pagAtrasados || []).length / (pagTotais || []).length
    : 0;

  // 5. Gerar projeções para próximos 3 meses
  const resultados: { mes: string; cenario: string; dados: Record<string, unknown> }[] = [];

  for (let i = 1; i <= 3; i++) {
    const mesFuturo = addMonths(mesAtual, i);
    const mesDate = `${mesFuturo}-01`;

    // OTIMISTA
    const receitaOtimista = mrr;
    const custosOtimista = custosBase;
    resultados.push({
      mes: mesDate,
      cenario: "otimista",
      dados: {
        receita_projetada: Math.round(receitaOtimista * 100) / 100,
        custos_projetados: Math.round(custosOtimista * 100) / 100,
        resultado_projetado: Math.round((receitaOtimista - custosOtimista) * 100) / 100,
        churn_impacto: 0,
        detalhamento: { clientes_risco: [], inadimplencia_pct: 0 },
      },
    });

    // REALISTA
    const descMedio = mrrRiscoMedio * 0.5;
    const descAlto = mrrRiscoAlto;
    const receitaRealista = mrr - descMedio - descAlto;
    const churnImpactoRealista = mrrRiscoMedio + mrrRiscoAlto;
    resultados.push({
      mes: mesDate,
      cenario: "realista",
      dados: {
        receita_projetada: Math.round(receitaRealista * 100) / 100,
        custos_projetados: Math.round(custosBase * 100) / 100,
        resultado_projetado: Math.round((receitaRealista - custosBase) * 100) / 100,
        churn_impacto: Math.round(churnImpactoRealista * 100) / 100,
        detalhamento: {
          clientes_risco_medio: clientesRiscoMedio.map((c) => c.nome),
          clientes_risco_alto: clientesRiscoAlto.map((c) => c.nome),
          desconto_medio: descMedio,
          desconto_alto: descAlto,
        },
      },
    });

    // PESSIMISTA
    const descontoInadimplencia = mrr * pctInadimplencia;
    const receitaPessimista = mrr - mrrRiscoMedio - mrrRiscoAlto - descontoInadimplencia;
    const custosPessimista = custosBase * 1.1; // +10% buffer
    const churnImpactoPessimista = mrrRiscoMedio + mrrRiscoAlto;
    resultados.push({
      mes: mesDate,
      cenario: "pessimista",
      dados: {
        receita_projetada: Math.round(receitaPessimista * 100) / 100,
        custos_projetados: Math.round(custosPessimista * 100) / 100,
        resultado_projetado: Math.round((receitaPessimista - custosPessimista) * 100) / 100,
        churn_impacto: Math.round(churnImpactoPessimista * 100) / 100,
        detalhamento: {
          clientes_risco_medio: clientesRiscoMedio.map((c) => c.nome),
          clientes_risco_alto: clientesRiscoAlto.map((c) => c.nome),
          inadimplencia_pct: Math.round(pctInadimplencia * 10000) / 100,
          desconto_inadimplencia: descontoInadimplencia,
          buffer_custos: "10%",
        },
      },
    });
  }

  // 6. Upsert em financeiro_fluxo_caixa
  for (const r of resultados) {
    await supabase
      .from("financeiro_fluxo_caixa")
      .upsert(
        {
          mes_referencia: r.mes,
          cenario: r.cenario,
          receita_projetada: (r.dados as Record<string, number>).receita_projetada,
          custos_projetados: (r.dados as Record<string, number>).custos_projetados,
          resultado_projetado: (r.dados as Record<string, number>).resultado_projetado,
          churn_impacto: (r.dados as Record<string, number>).churn_impacto,
          detalhamento: (r.dados as Record<string, unknown>).detalhamento,
          calculado_em: new Date().toISOString(),
        },
        { onConflict: "mes_referencia,cenario" }
      );
  }

  return NextResponse.json({
    success: true,
    mrr,
    custos_base: custosBase,
    meses_projetados: 3,
    cenarios: resultados.length,
    pct_inadimplencia: Math.round(pctInadimplencia * 10000) / 100,
  });
}
