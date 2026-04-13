/**
 * GET /api/financeiro/entradas?mes=2026-03
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 120;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const safe = (n: number, d: number) => d > 0 ? n / d : 0;

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes") || new Date().toISOString().slice(0, 7);
  const isTudo = mes === "tudo";
  const mesRef = isTudo ? "2026-12-01" : `${mes}-01`;
  const hoje = new Date();
  const diaHoje = hoje.getDate();
  const mesAtual = hoje.toISOString().slice(0, 7);

  let prevMes = "2025-12-01";
  if (!isTudo) {
    const [y, m] = mes.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    prevMes = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01`;
  }

  try {
    // Para "tudo", buscar TODOS os pagamentos; para mês específico, só aquele mês
    const pagQuery = isTudo
      ? supabase.from("pagamentos_mensais").select("*").gte("mes_referencia", "2026-01-01")
      : supabase.from("pagamentos_mensais").select("*").eq("mes_referencia", mesRef);

    const [{ data: clientes }, { data: pagamentos }, { data: pagPrev }] = await Promise.all([
      supabase.from("clientes_receita").select("*").order("dia_pagamento"),
      pagQuery,
      supabase.from("pagamentos_mensais").select("valor_pago").eq("mes_referencia", prevMes).eq("status", "pago"),
    ]);

    const cls = (clientes || []) as {
      id: string; nome: string; plataforma: string; valor_mensal: number;
      closer: string; tipo_contrato: string; dia_pagamento: number | null;
      status: string; status_financeiro: string | null; mes_fechamento: string | null; obs: string | null;
      ltv_meses: number | null; categoria: string | null;
    }[];
    const pags = (pagamentos || []) as {
      cliente_id: string; valor_pago: number | null; dia_pagamento: number | null; status: string;
      justificativa: string | null; mes_pagamento: string | null; mes_referencia: string;
    }[];
    // Para "tudo", agregar último pagamento por cliente e somar todos os pagos
    const pagMap = new Map<string, typeof pags[0]>();
    if (isTudo) {
      // Usar o pagamento mais recente de cada cliente
      for (const p of pags) {
        const existing = pagMap.get(p.cliente_id);
        if (!existing || p.mes_referencia > (existing as unknown as {mes_referencia:string}).mes_referencia) {
          pagMap.set(p.cliente_id, p);
        }
      }
    } else {
      for (const p of pags) pagMap.set(p.cliente_id, p);
    }

    // Churn: buscar da tabela clientes (pipeline de churn) por data_cancelamento
    const { data: churnPipeline } = await supabase.from("clientes")
      .select("nome,mrr,data_cancelamento")
      .eq("status", "cancelado");
    const allChurns = churnPipeline || [];

    // Ativos para cálculos de ticket médio (só recorrentes)
    const ativosRecorrentes = cls.filter((c) => (c.status_financeiro || c.status) === "ativo");
    // Clientes Ativos = quantos estavam na casa no final daquele mês
    // Mapa de cancelamento por nome para lookup rápido
    const churnMap = new Map(allChurns.map((ch) => [ch.nome?.toUpperCase()?.trim(), ch.data_cancelamento]));
    const todosAtivos = isTudo
      ? cls.filter((c) => {
          const sf = c.status_financeiro || (c.status === "churned" ? "churned" : "ativo");
          return sf !== "churned";
        })
      : cls.filter((c) => {
          // Não entrou ainda nesse mês
          if (c.mes_fechamento && c.mes_fechamento > mesRef) return false;
          // Se é churned, verificar se já tinha saído antes do fim desse mês
          const sf = c.status_financeiro || (c.status === "churned" ? "churned" : "ativo");
          if (sf === "churned") {
            const cancelDate = churnMap.get(c.nome?.toUpperCase()?.trim());
            // Se cancelou nesse mês ou depois, ainda estava ativo nesse mês
            if (cancelDate && cancelDate >= mesRef) return true;
            return false;
          }
          return true;
        });
    const pagos = pags.filter((p) => p.status === "pago");
    const receitaTotal = pagos.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
    // Em "tudo", contar clientes distintos que pagaram; por mês, contar registros
    const clientesPagantes = isTudo ? new Set(pagos.map((p) => p.cliente_id)).size : pagos.length;

    // Inadimplentes: ATIVOS que passaram do dia de pagamento e não pagaram
    // Só conta como inadimplente se o cliente já era cliente naquele mês (mes_fechamento <= mes selecionado)
    const pagosIds = new Set(pagos.map((p) => p.cliente_id));
    const allPagIds = new Set(pags.map((p) => p.cliente_id)); // inclui perdoado, parceria, etc
    const iseMesAtual = mes === mesAtual;
    const inadimplentes = isTudo ? [] : ativosRecorrentes.filter((c) => {
      if (pagosIds.has(c.id)) return false;
      if (allPagIds.has(c.id)) return false;
      if (c.mes_fechamento && c.mes_fechamento > mesRef) return false;
      if (!iseMesAtual) return true;
      return c.dia_pagamento !== null && diaHoje > c.dia_pagamento;
    });
    const receitaPendente = inadimplentes.reduce((s, c) => s + Number(c.valor_mensal), 0);

    // Churn — fonte ÚNICA: churn_monthly_summary (contagem) + clientes (MRR perdido)
    // Ambos vêm da mesma aba /churn
    let churnMes = 0;
    let receitaChurned = 0;
    if (isTudo) {
      const { data: allSummary } = await supabase.from("churn_monthly_summary").select("num_saidas");
      churnMes = (allSummary || []).reduce((s, m) => s + Number(m.num_saidas || 0), 0);
      receitaChurned = allChurns.reduce((s, c) => s + Number(c.mrr || 0), 0);
    } else {
      const mesNorm = mes.replace("-", "/");
      const { data: summary } = await supabase
        .from("churn_monthly_summary")
        .select("num_saidas")
        .eq("ano_mes", mesNorm)
        .maybeSingle();
      churnMes = Number(summary?.num_saidas || 0);
      // MRR perdido: buscar da tabela clientes (mesma fonte usada em /churn)
      const { data: churnsDoMes } = await supabase
        .from("clientes")
        .select("mrr")
        .eq("status", "cancelado")
        .gte("data_cancelamento", `${mes}-01`)
        .lte("data_cancelamento", `${mes}-31`);
      receitaChurned = (churnsDoMes || []).reduce((s, c) => s + Number(c.mrr || 0), 0);
    }

    // Novos clientes
    const novos = isTudo
      ? cls.filter((c) => c.mes_fechamento && c.mes_fechamento >= "2026-01-01" && (c.status_financeiro || c.status) !== "churned")
      : cls.filter((c) => c.mes_fechamento === mesRef);
    const receitaNova = novos.reduce((s, c) => s + Number(c.valor_mensal), 0);

    // Comparativo
    const receitaAnterior = (pagPrev || []).reduce((s: number, p: { valor_pago: number }) => s + Number(p.valor_pago || 0), 0);

    // Ticket médio = soma valor_mensal dos ativos recorrentes / quantidade
    const mrrAtivos = ativosRecorrentes.reduce((s, c) => s + Number(c.valor_mensal), 0);
    const ticketMedio = safe(mrrAtivos, ativosRecorrentes.length);

    // LTV médio (meses)
    const ltvs = cls.filter((c) => c.ltv_meses && c.ltv_meses > 0);
    const ltvMedio = ltvs.length > 0 ? ltvs.reduce((s, c) => s + (c.ltv_meses || 0), 0) / ltvs.length : 0;
    const ltvAtivos = ativosRecorrentes.filter((c) => c.ltv_meses && c.ltv_meses > 0);
    const ltvMedioAtivos = ltvAtivos.length > 0 ? ltvAtivos.reduce((s, c) => s + (c.ltv_meses || 0), 0) / ltvAtivos.length : 0;

    // Auto-incrementar LTV para clientes parceria cujo dia_pagamento já passou neste mês
    if (iseMesAtual) {
      const parceriaAutoLtv = cls.filter((c) => {
        const sf = c.status_financeiro || c.status;
        return sf === "parceria" && c.dia_pagamento && diaHoje >= c.dia_pagamento && !pagosIds.has(c.id);
      });
      for (const c of parceriaAutoLtv) {
        // Verificar se já tem registro de pagamento neste mês
        const existing = pagMap.get(c.id);
        if (!existing) {
          // Criar pagamento automático "parceria" e incrementar LTV
          await Promise.all([
            supabase.from("pagamentos_mensais").upsert({
              cliente_id: c.id, mes_referencia: mesRef,
              valor_pago: 0, dia_pagamento: c.dia_pagamento,
              status: "parceria",
            }, { onConflict: "cliente_id,mes_referencia" }),
            supabase.from("clientes_receita").update({
              ltv_meses: (c.ltv_meses || 0) + 1,
            }).eq("id", c.id),
          ]);
        }
      }
    }

    // Auto-calcular LTV para pagou_integral: meses desde mes_fechamento até agora
    const integralClientes = cls.filter((c) => (c.status_financeiro || c.status) === "pagou_integral" && c.mes_fechamento);
    for (const c of integralClientes) {
      const inicio = new Date(c.mes_fechamento!);
      const mesesDesdeInicio = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
      const ltvCalculado = Math.max(1, mesesDesdeInicio);
      if (ltvCalculado !== (c.ltv_meses || 0)) {
        await supabase.from("clientes_receita").update({ ltv_meses: ltvCalculado }).eq("id", c.id);
        c.ltv_meses = ltvCalculado;
      }
    }

    // Build client list — só inclui clientes que já existiam nesse mês (ou todos se "tudo")
    const clientesList = cls.filter((c) => {
      if (isTudo) return true;
      const sf = c.status_financeiro || (c.status === "churned" ? "churned" : "ativo");
      if (sf === "churned") return true;
      if (c.mes_fechamento && c.mes_fechamento > mesRef) return false;
      return true;
    }).map((c) => {
      const pag = pagMap.get(c.id);
      let pagStatus = pag?.status || null;
      const sf = c.status_financeiro || (c.status === "churned" ? "churned" : "ativo");
      // Marcar como atrasado: ativo + não pagou + passou do dia + já era cliente nesse mês
      if (!isTudo && sf === "ativo" && (!pag || pag.status === "pendente")) {
        const jaEraCliente = !c.mes_fechamento || c.mes_fechamento <= mesRef;
        if (jaEraCliente) {
          if (iseMesAtual && c.dia_pagamento && diaHoje > c.dia_pagamento) {
            pagStatus = "atrasado";
          } else if (!iseMesAtual && !pag) {
            pagStatus = "atrasado";
          }
        }
      }
      // No modo "tudo", somar todos os pagamentos do cliente
      let valorPago = pag?.valor_pago ?? null;
      const pagamentosMeses: {mes: string; status: string; valor_pago: number | null; dia_pagamento: number | null}[] = [];
      if (isTudo) {
        const todosPagsCliente = pags.filter((p) => p.cliente_id === c.id);
        const todosPagos = todosPagsCliente.filter((p) => p.status === "pago");
        valorPago = todosPagos.length > 0 ? todosPagos.reduce((s, p) => s + Number(p.valor_pago || 0), 0) : null;
        if (todosPagos.length > 0) pagStatus = "pago";
        // Montar lista de pagamentos por mês
        for (const p of todosPagsCliente) {
          pagamentosMeses.push({
            mes: p.mes_referencia,
            status: p.status,
            valor_pago: p.valor_pago,
            dia_pagamento: p.dia_pagamento,
          });
        }
        pagamentosMeses.sort((a, b) => a.mes.localeCompare(b.mes));
      }
      return {
        ...c,
        status_financeiro: sf,
        pagamento_mes: {
          status: pagStatus,
          valor_pago: valorPago,
          dia_pagamento: pag?.dia_pagamento ?? null,
          justificativa: pag?.justificativa ?? null,
          mes_pagamento: pag?.mes_pagamento ?? null,
        },
        ...(isTudo ? { pagamentos_todos: pagamentosMeses } : {}),
      };
    });

    return NextResponse.json({
      mes_referencia: mesRef,
      resumo: {
        receita_total: receitaTotal,
        clientes_pagantes: clientesPagantes,
        clientes_ativos: todosAtivos.length,
        ticket_medio: ticketMedio,
        inadimplentes: inadimplentes.length,
        receita_pendente: receitaPendente,
        churn_mes: churnMes,
        receita_churned: receitaChurned,
        mrr: mrrAtivos,
        novos_clientes: novos.length,
        receita_nova: receitaNova,
        ltv_medio: Math.round(ltvMedio * 10) / 10,
        ltv_medio_ativos: Math.round(ltvMedioAtivos * 10) / 10,
        comparativo: {
          receita_anterior: receitaAnterior,
          variacao_percentual: safe(receitaTotal - receitaAnterior, receitaAnterior) * 100,
        },
      },
      clientes: clientesList,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
