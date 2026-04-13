/**
 * GET /api/projecoes/break-even
 * Calcula MRR mínimo de equilíbrio baseado em custos fixos, comissões e margem.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthDate(offset: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  try {
    const mesAtual = getCurrentMonth();

    // Buscar dados financeiros em paralelo
    const [
      { data: custosFixos },
      { data: folha },
      { data: parcelamentos },
      { data: closersAtivos },
      { data: compensation },
      { data: margens },
      { data: contratosRecentes },
      { data: lancAtual },
    ] = await Promise.all([
      supabase.from("custos_fixos").select("valor").eq("ativo", true),
      supabase.from("folha_pagamento").select("valor_mensal").eq("ativo", true),
      supabase.from("parcelamentos").select("valor_parcela").eq("ativo", true),
      supabase.from("closers").select("id,nome,salario_fixo").eq("ativo", true),
      supabase.from("compensation_config").select("ote,employee_id").eq("mes_referencia", mesAtual),
      supabase.from("financeiro_margem_cliente").select("margem_pct").order("mes_referencia", { ascending: false }).limit(50),
      // Últimos 3 meses de contratos para ticket médio LTV
      supabase.from("contratos").select("mrr,valor_total_projeto").in("mes_referencia", [
        getMonthDate(0), getMonthDate(-1), getMonthDate(-2)
      ]),
      supabase.from("lancamentos_diarios").select("mrr_dia,ganhos").eq("mes_referencia", mesAtual),
    ]);

    // Total custos fixos
    const totalCustosFixos = (custosFixos || []).reduce((s, c) => s + Number(c.valor || 0), 0);
    const totalFolha = (folha || []).reduce((s, f) => s + Number(f.valor_mensal || 0), 0);
    const totalParcelamentos = (parcelamentos || []).reduce((s, p) => s + Number(p.valor_parcela || 0), 0);
    const custoFixoTotal = totalCustosFixos + totalFolha + totalParcelamentos;

    // Comissões projetadas (OTE × closers ativos)
    const nClosers = (closersAtivos || []).length;
    const totalOTE = (compensation || []).reduce((s, c) => s + Number(c.ote || 0), 0);
    // Se não tem compensation_config, estimar com salário fixo × 1.3
    const comissoesProjetadas = totalOTE > 0
      ? totalOTE
      : (closersAtivos || []).reduce((s, c) => s + Number(c.salario_fixo || 0) * 0.3, 0);

    // Margem média
    const margensValues = (margens || []).map((m) => Number(m.margem_pct || 0)).filter((v) => v > 0);
    const margemMedia = margensValues.length > 0
      ? margensValues.reduce((s, v) => s + v, 0) / margensValues.length / 100
      : 0.40; // fallback 40%

    // Ticket médio
    const contratosAll = contratosRecentes || [];
    const ticketMedio = contratosAll.length > 0
      ? contratosAll.reduce((s, c) => s + Number(c.mrr || 0), 0) / contratosAll.length
      : 1800;

    // Cálculos de break-even
    const custosTotais = custoFixoTotal + comissoesProjetadas;
    const mrrBreakEven = margemMedia > 0 ? custosTotais / margemMedia : custosTotais;
    const contratosBreakEven = ticketMedio > 0 ? Math.ceil(mrrBreakEven / ticketMedio) : 0;

    // MRR atual
    const lancamentos = lancAtual || [];
    const mrrAtual = lancamentos.reduce((s, l) => s + Number(l.mrr_dia || 0), 0);
    const contratosAtivos = lancamentos.reduce((s, l) => s + (l.ganhos || 0), 0);

    const distanciaBreakEven = mrrBreakEven - mrrAtual;
    const contratosFaltantes = Math.max(0, contratosBreakEven - contratosAtivos);

    // Histórico de break-even (últimos 6 meses) — calcula retrospectivamente
    const historico = [];
    for (let i = 5; i >= 0; i--) {
      const mes = getMonthDate(-i);
      const mesDate = `${mes}-01`;

      const [
        { data: hCustos },
        { data: hFolha },
        { data: hParc },
        { data: hMargens },
        { data: hLanc },
      ] = await Promise.all([
        supabase.from("custos_fixos").select("valor").eq("ativo", true),
        supabase.from("folha_pagamento").select("valor_mensal").eq("ativo", true),
        supabase.from("parcelamentos").select("valor_parcela").eq("ativo", true),
        supabase.from("financeiro_margem_cliente").select("margem_pct").lte("mes_referencia", mesDate).order("mes_referencia", { ascending: false }).limit(20),
        supabase.from("lancamentos_diarios").select("mrr_dia").eq("mes_referencia", mes),
      ]);

      const hCustosTotal = (hCustos || []).reduce((s, c) => s + Number(c.valor || 0), 0)
        + (hFolha || []).reduce((s, f) => s + Number(f.valor_mensal || 0), 0)
        + (hParc || []).reduce((s, p) => s + Number(p.valor_parcela || 0), 0);

      const hMargensVals = (hMargens || []).map((m) => Number(m.margem_pct || 0)).filter((v) => v > 0);
      const hMargemMedia = hMargensVals.length > 0
        ? hMargensVals.reduce((s, v) => s + v, 0) / hMargensVals.length / 100
        : 0.40;

      const hMrrBE = hMargemMedia > 0 ? (hCustosTotal + comissoesProjetadas) / hMargemMedia : 0;
      const hMrrReal = (hLanc || []).reduce((s, l) => s + Number(l.mrr_dia || 0), 0);

      historico.push({
        mes,
        mrr_break_even: Math.round(hMrrBE * 100) / 100,
        mrr_real: Math.round(hMrrReal * 100) / 100,
        atingido: hMrrReal >= hMrrBE,
      });
    }

    return NextResponse.json({
      custos: {
        custos_fixos: totalCustosFixos,
        folha: totalFolha,
        parcelamentos: totalParcelamentos,
        comissoes_projetadas: comissoesProjetadas,
        total: custosTotais,
      },
      margem_media: margemMedia,
      ticket_medio: ticketMedio,
      closers_ativos: nClosers,
      break_even: {
        mrr_break_even: Math.round(mrrBreakEven * 100) / 100,
        contratos_break_even: contratosBreakEven,
        mrr_atual: Math.round(mrrAtual * 100) / 100,
        contratos_ativos: contratosAtivos,
        distancia_break_even: Math.round(distanciaBreakEven * 100) / 100,
        contratos_faltantes: contratosFaltantes,
        distancia_pct: mrrBreakEven > 0
          ? Math.round((distanciaBreakEven / mrrBreakEven) * 10000) / 100
          : 0,
      },
      historico,
    });
  } catch (err) {
    console.error("[projecoes/break-even] Erro:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
