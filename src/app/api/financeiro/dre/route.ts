/**
 * GET /api/financeiro/dre?mes=2026-04&impostos_pct=6&ytd=0
 * DRE gerencial completo — agrega receita (entradas), despesas, tráfego Meta e indicadores.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

const safe = (n: number, d: number) => (d > 0 ? n / d : 0);

// Categorização por grupo
const CAT = {
  folha: ["Equipe Operacional", "Equipe Comercial", "Equipe de MKT", "Prolabore"],
  ferramentas: ["Ferramentas/Softwares", "Ferramentas/Software"],
  infra: ["Aluguel", "Internet", "Energia", "Limpeza", "Telefone", "Manutenção"],
  outrosFixos: ["Contador", "Cursos e Treinamentos", "Mentoria", "Audiovisual"],
  comissoes: ["Comissões"],
  trafego: ["Ads"],
};
// Tudo que não cair em nenhum dos acima vira "Custos Variáveis"

async function fetchMetaSpend(since: string, until: string): Promise<number> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const account = process.env.META_ADS_ACCOUNT_ID;
  if (!token || !account) return 0;
  try {
    const params = new URLSearchParams({
      access_token: token,
      fields: "spend",
      time_range: JSON.stringify({ since, until }),
      level: "account",
    });
    const r = await fetch(`https://graph.facebook.com/v21.0/${account}/insights?${params}`, { next: { revalidate: 300 } });
    const j = await r.json();
    if (!j.data?.length) return 0;
    return j.data.reduce((s: number, row: { spend?: string }) => s + parseFloat(row.spend || "0"), 0);
  } catch {
    return 0;
  }
}

function mesBounds(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const since = `${mes}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const until = `${mes}-${String(lastDay).padStart(2, "0")}`;
  return { since, until };
}

function prevMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface DetalheItem { descricao: string; valor: number; data?: string }
interface Despesa { id: string; categoria: string; valor: number; descricao: string; data_lancamento: string; tipo?: string }

async function calcMes(mes: string, impostosPct: number, light = false) {
  const { since, until } = mesBounds(mes);

  const [
    { data: pagamentos },
    { data: churnsMes },
    { data: clientesReceita },
    { data: despesas },
    metaSpend,
  ] = await Promise.all([
    supabase.from("pagamentos_mensais").select("valor_pago, cliente_id").eq("mes_referencia", `${mes}-01`).eq("status", "pago"),
    supabase.from("clientes").select("mrr").eq("status", "cancelado").gte("data_cancelamento", since).lte("data_cancelamento", until),
    supabase.from("clientes_receita").select("id, valor_mensal").eq("mes_fechamento", `${mes}-01`),
    light
      ? supabase.from("despesas").select("categoria, valor").eq("mes_referencia", mes).is("deleted_at", null)
      : supabase.from("despesas").select("id, categoria, valor, descricao, data_lancamento, tipo").eq("mes_referencia", mes).is("deleted_at", null),
    light ? Promise.resolve(0) : fetchMetaSpend(since, until),
  ]);

  // === RECEITA ===
  const receitaBruta = (pagamentos || []).reduce((s, p) => s + Number(p.valor_pago || 0), 0);
  const cancelamentos = (churnsMes || []).reduce((s, c) => s + Number(c.mrr || 0), 0);
  const receitaLiquida = receitaBruta - cancelamentos;
  const novosClientes = (clientesReceita || []).length;
  const receitaNovos = (clientesReceita || []).reduce((s, c) => s + Number(c.valor_mensal || 0), 0);

  // === DESPESAS AGRUPADAS ===
  const desp = (despesas || []) as Despesa[];
  const byCat = (cats: string[]) => desp.filter((d) => cats.includes(d.categoria));
  const sumCat = (cats: string[]) => byCat(cats).reduce((s, d) => s + Number(d.valor), 0);

  const folhaDesp = byCat(CAT.folha);
  const folhaTotal = folhaDesp.reduce((s, d) => s + Number(d.valor), 0);
  const ferramentasDesp = byCat(CAT.ferramentas);
  const ferramentasTotal = ferramentasDesp.reduce((s, d) => s + Number(d.valor), 0);
  const infraDesp = byCat(CAT.infra);
  const infraTotal = infraDesp.reduce((s, d) => s + Number(d.valor), 0);
  const outrosFixosDesp = byCat(CAT.outrosFixos);
  const outrosFixosTotal = outrosFixosDesp.reduce((s, d) => s + Number(d.valor), 0);
  const comissoesDesp = byCat(CAT.comissoes);
  const comissoesTotal = comissoesDesp.reduce((s, d) => s + Number(d.valor), 0);

  const fixosClassificados = new Set([...CAT.folha, ...CAT.ferramentas, ...CAT.infra, ...CAT.outrosFixos, ...CAT.comissoes, ...CAT.trafego]);
  const variavelDesp = desp.filter((d) => !fixosClassificados.has(d.categoria));
  const variavelTotal = variavelDesp.reduce((s, d) => s + Number(d.valor), 0);

  // Tráfego: preferir Meta API; fallback para despesas categoria Ads
  const adsDespesasTotal = sumCat(CAT.trafego);
  const trafegoPago = metaSpend > 0 ? metaSpend : adsDespesasTotal;

  // === AGREGADOS ===
  const custoAquisicao = trafegoPago + comissoesTotal;
  const margemContribuicao = receitaLiquida - custoAquisicao;
  const custosFixosTotal = folhaTotal + ferramentasTotal + infraTotal + outrosFixosTotal;
  const resultadoOperacional = margemContribuicao - custosFixosTotal - variavelTotal;
  const ebitda = resultadoOperacional; // sem depreciação/amortização rastreada
  const impostosValor = resultadoOperacional > 0 ? resultadoOperacional * (impostosPct / 100) : 0;
  const lucroLiquido = resultadoOperacional - impostosValor;

  // === INDICADORES ===
  const margemLiquidaPct = safe(lucroLiquido, receitaBruta) * 100;
  const margemOperacionalPct = safe(resultadoOperacional, receitaBruta) * 100;
  const folhaReceitaPct = safe(folhaTotal, receitaBruta) * 100;
  const cac = safe(custoAquisicao, novosClientes);
  const roas = safe(receitaNovos, trafegoPago);

  const toDetalhe = (items: Despesa[]): DetalheItem[] =>
    items.map((d) => ({ descricao: d.descricao, valor: Number(d.valor), data: d.data_lancamento }))
      .sort((a, b) => b.valor - a.valor);

  return {
    mes,
    receita: {
      bruta: receitaBruta,
      cancelamentos,
      liquida: receitaLiquida,
      novos_clientes: novosClientes,
      receita_novos: receitaNovos,
    },
    aquisicao: {
      trafego_pago: trafegoPago,
      trafego_fonte: metaSpend > 0 ? "meta_api" : "despesas",
      comissoes: comissoesTotal,
      total: custoAquisicao,
    },
    margem_contribuicao: margemContribuicao,
    custos_fixos: {
      folha: folhaTotal,
      ferramentas: ferramentasTotal,
      infraestrutura: infraTotal,
      outros: outrosFixosTotal,
      total: custosFixosTotal,
    },
    custos_variaveis: {
      despesas: variavelTotal,
      total: variavelTotal,
    },
    resultado_operacional: resultadoOperacional,
    ebitda,
    impostos: { pct: impostosPct, valor: impostosValor },
    lucro_liquido: lucroLiquido,
    indicadores: {
      margem_liquida_pct: margemLiquidaPct,
      margem_operacional_pct: margemOperacionalPct,
      folha_sobre_receita_pct: folhaReceitaPct,
      cac,
      roas,
    },
    detalhes: {
      folha: toDetalhe(folhaDesp),
      ferramentas: toDetalhe(ferramentasDesp),
      infraestrutura: toDetalhe(infraDesp),
      outros_fixos: toDetalhe(outrosFixosDesp),
      comissoes: toDetalhe(comissoesDesp),
      variavel: toDetalhe(variavelDesp),
    },
    // compat com página antiga
    receita_bruta: receitaBruta,
    custo_total: custoAquisicao + custosFixosTotal + variavelTotal,
    total_folha: folhaTotal,
    total_fixos: custosFixosTotal,
    total_variavel: variavelTotal,
    custos_por_categoria: [
      { categoria: "Folha", valor: folhaTotal },
      { categoria: "Tráfego Pago", valor: trafegoPago },
      { categoria: "Ferramentas/SaaS", valor: ferramentasTotal },
      { categoria: "Infraestrutura", valor: infraTotal },
      { categoria: "Outros Fixos", valor: outrosFixosTotal },
      { categoria: "Comissões", valor: comissoesTotal },
      { categoria: "Variáveis", valor: variavelTotal },
    ].filter((c) => c.valor > 0).sort((a, b) => b.valor - a.valor).map((c) => ({
      ...c, percentual: safe(c.valor, receitaBruta) * 100,
    })),
    margem_percentual: margemLiquidaPct,
    folha_sobre_receita: folhaReceitaPct,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes") || new Date().toISOString().slice(0, 7);
  const impostosPct = Number(searchParams.get("impostos_pct") || "6");
  const ytd = searchParams.get("ytd") === "1";
  const light = searchParams.get("light") === "1";
  const serie = searchParams.get("serie") === "1";

  try {
    // Modo série: retorna os 12 meses do ano em UMA chamada (light, sem Meta, sem detalhes)
    if (serie) {
      const ano = Number(mes.slice(0, 4));
      const mesesList = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
      const all = await Promise.all(mesesList.map((me) => calcMes(me, impostosPct, true)));
      return NextResponse.json({ serie: true, ano, meses: all });
    }

    if (ytd) {
      const [y, m] = mes.split("-").map(Number);
      const mesesList: string[] = [];
      for (let i = 1; i <= m; i++) mesesList.push(`${y}-${String(i).padStart(2, "0")}`);
      const all = await Promise.all(mesesList.map((me) => calcMes(me, impostosPct)));
      // soma tudo em um objeto acumulado
      const sum = (k: (x: typeof all[0]) => number) => all.reduce((s, x) => s + k(x), 0);
      const receitaBruta = sum((x) => x.receita.bruta);
      const cancelamentos = sum((x) => x.receita.cancelamentos);
      const receitaLiquida = receitaBruta - cancelamentos;
      const trafego = sum((x) => x.aquisicao.trafego_pago);
      const comissoes = sum((x) => x.aquisicao.comissoes);
      const custoAquisicao = trafego + comissoes;
      const folha = sum((x) => x.custos_fixos.folha);
      const ferramentas = sum((x) => x.custos_fixos.ferramentas);
      const infra = sum((x) => x.custos_fixos.infraestrutura);
      const outrosFixos = sum((x) => x.custos_fixos.outros);
      const custosFixosTotal = folha + ferramentas + infra + outrosFixos;
      const variavel = sum((x) => x.custos_variaveis.despesas);
      const margemContribuicao = receitaLiquida - custoAquisicao;
      const resultadoOperacional = margemContribuicao - custosFixosTotal - variavel;
      const impostosValor = resultadoOperacional > 0 ? resultadoOperacional * (impostosPct / 100) : 0;
      const lucroLiquido = resultadoOperacional - impostosValor;
      const novos = sum((x) => x.receita.novos_clientes);
      const receitaNovos = sum((x) => x.receita.receita_novos);
      return NextResponse.json({
        ytd: true,
        mes,
        meses_incluidos: mesesList,
        receita: { bruta: receitaBruta, cancelamentos, liquida: receitaLiquida, novos_clientes: novos, receita_novos: receitaNovos },
        aquisicao: { trafego_pago: trafego, comissoes, total: custoAquisicao, trafego_fonte: "acumulado" },
        margem_contribuicao: margemContribuicao,
        custos_fixos: { folha, ferramentas, infraestrutura: infra, outros: outrosFixos, total: custosFixosTotal },
        custos_variaveis: { despesas: variavel, total: variavel },
        resultado_operacional: resultadoOperacional,
        ebitda: resultadoOperacional,
        impostos: { pct: impostosPct, valor: impostosValor },
        lucro_liquido: lucroLiquido,
        indicadores: {
          margem_liquida_pct: safe(lucroLiquido, receitaBruta) * 100,
          margem_operacional_pct: safe(resultadoOperacional, receitaBruta) * 100,
          folha_sobre_receita_pct: safe(folha, receitaBruta) * 100,
          cac: safe(custoAquisicao, novos),
          roas: safe(receitaNovos, trafego),
        },
      });
    }

    const [atual, anterior] = await Promise.all([calcMes(mes, impostosPct, light), calcMes(prevMes(mes), impostosPct, light)]);
    return NextResponse.json({
      ...atual,
      comparativo: {
        mes_anterior: anterior,
        // compat com versão antiga
        receita_bruta_anterior: anterior.receita.bruta,
        custo_total_anterior: anterior.custo_total,
        lucro_anterior: anterior.lucro_liquido,
        margem_anterior: anterior.indicadores.margem_liquida_pct,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
