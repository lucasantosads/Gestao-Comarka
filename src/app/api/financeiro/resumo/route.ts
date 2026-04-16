/**
 * GET /api/financeiro/resumo?mes=2026-04
 * Endpoint unificado para a página /financeiro expandida.
 * Retorna: KPIs, fluxo de caixa projetado, margens, comissões, pagamentos Asaas.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateCompensation } from "@/lib/commission";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

function prevMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mesAnoAnterior(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${y - 1}-${String(m).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes") || new Date().toISOString().slice(0, 7);
  const mesDate = `${mes}-01`;
  const prev = prevMes(mes);
  const prevDate = `${prev}-01`;
  const anoAnt = mesAnoAnterior(mes);
  const anoAntDate = `${anoAnt}-01`;

  // === KPIs ===
  // MRR atual
  const { data: clientesAtivos } = await supabase
    .from("clientes_receita")
    .select("valor_mensal")
    .eq("status_financeiro", "ativo");

  const mrrAtual = (clientesAtivos || []).reduce((s, c) => s + (c.valor_mensal || 0), 0);

  // MRR mês anterior
  const { data: pagPrev } = await supabase
    .from("pagamentos_mensais")
    .select("valor_pago")
    .eq("mes_referencia", prevDate)
    .eq("status", "pago");
  const mrrPrev = (pagPrev || []).reduce((s, p) => s + (p.valor_pago || 0), 0);

  // MRR mesmo mês ano anterior
  const { data: pagAnoAnt } = await supabase
    .from("pagamentos_mensais")
    .select("valor_pago")
    .eq("mes_referencia", anoAntDate)
    .eq("status", "pago");
  const mrrAnoAnt = (pagAnoAnt || []).reduce((s, p) => s + (p.valor_pago || 0), 0);

  const crescimentoMoM = mrrPrev > 0 ? ((mrrAtual - mrrPrev) / mrrPrev) * 100 : 0;
  const crescimentoYoY = mrrAnoAnt > 0 ? ((mrrAtual - mrrAnoAnt) / mrrAnoAnt) * 100 : 0;

  // Lucro líquido: receita - custos fixos - folha - comissões
  const { data: despesasMes } = await supabase
    .from("despesas")
    .select("valor")
    .eq("mes_referencia", mes)
    .is("deleted_at", null);
  const totalCustos = (despesasMes || []).reduce((s, d) => s + (d.valor || 0), 0);

  const { data: pagMes } = await supabase
    .from("pagamentos_mensais")
    .select("valor_pago")
    .eq("mes_referencia", mesDate)
    .eq("status", "pago");
  const receitaMes = (pagMes || []).reduce((s, p) => s + (p.valor_pago || 0), 0);

  const lucroLiquido = receitaMes - totalCustos;

  // Lucro mês anterior
  const { data: despesasPrev } = await supabase
    .from("despesas")
    .select("valor")
    .eq("mes_referencia", prev)
    .is("deleted_at", null);
  const totalCustosPrev = (despesasPrev || []).reduce((s, d) => s + (d.valor || 0), 0);
  const lucroPrev = mrrPrev - totalCustosPrev;
  const crescimentoLucro = lucroPrev > 0 ? ((lucroLiquido - lucroPrev) / lucroPrev) * 100 : 0;

  // === Fluxo de Caixa Projetado ===
  const { data: fluxoCaixa } = await supabase
    .from("financeiro_fluxo_caixa")
    .select("*")
    .is("deleted_at", null)
    .order("mes_referencia");

  // === Margem por Cliente ===
  const { data: margens } = await supabase
    .from("financeiro_margem_cliente")
    .select("*, clientes(id, nome, status, closer_id)")
    .eq("mes_referencia", mesDate)
    .is("deleted_at", null)
    .order("margem_pct", { ascending: true });

  // === Comissões (closers e SDRs) ===
  const { data: employees } = await supabase
    .from("employees")
    .select("id, nome, role, entity_id")
    .eq("ativo", true)
    .in("role", ["closer", "sdr"]);

  const comissoes = [];
  for (const emp of employees || []) {
    const comp = await calculateCompensation(emp.id, emp.role, emp.entity_id || "", mes);
    if (comp) {
      comissoes.push({
        employee_id: emp.id,
        nome: emp.nome,
        role: emp.role,
        salario_base: comp.salario_base,
        ote: comp.ote,
        comissao: comp.comissao_calculada,
        ote_pct: comp.ote_pct,
        total_bruto: comp.total_bruto,
        meta_pct: comp.meta_pct,
        contratos: comp.contratos,
      });
    }
  }

  const totalComissoes = comissoes.reduce((s, c) => s + c.comissao, 0);

  // === Asaas Pagamentos ===
  const { data: asaasPag } = await supabase
    .from("asaas_pagamentos")
    .select("*, clientes(id, nome)")
    .is("deleted_at", null)
    .order("criado_em", { ascending: false })
    .limit(50);

  const { data: pendentes } = await supabase
    .from("asaas_pagamentos")
    .select("id", { count: "exact" })
    .or("aprovacao_criacao_status.eq.aguardando,aprovacao_recebimento_status.eq.aguardando")
    .is("deleted_at", null);

  const { data: semMatch } = await supabase
    .from("asaas_pagamentos")
    .select("*, clientes(id, nome)")
    .eq("match_status", "sem_match")
    .is("deleted_at", null);

  return NextResponse.json({
    kpis: {
      mrr: mrrAtual,
      crescimento_mom: Math.round(crescimentoMoM * 100) / 100,
      crescimento_yoy: Math.round(crescimentoYoY * 100) / 100,
      lucro_liquido: lucroLiquido,
      crescimento_lucro: Math.round(crescimentoLucro * 100) / 100,
      receita_mes: receitaMes,
      total_custos: totalCustos,
    },
    fluxo_caixa: fluxoCaixa || [],
    margens: margens || [],
    comissoes,
    total_comissoes: totalComissoes,
    asaas: {
      pagamentos: asaasPag || [],
      pendentes_count: pendentes?.length || 0,
      sem_match: semMatch || [],
    },
  });
}
