/**
 * GET /api/projecoes/ltv-carteira
 * Calcula LTV da carteira ativa por cliente, com breakdown por nicho.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHURN_PROB: Record<string, number> = {
  baixo: 0.05,
  medio: 0.25,
  alto: 0.60,
};

export async function GET() {
  try {
    // Buscar clientes ativos e cancelados para calcular tempo médio de permanência
    const [
      { data: clientesAtivos },
      { data: clientesCancelados },
      { data: contratosAll },
      { data: clientesExtra },
    ] = await Promise.all([
      supabase
        .from("clientes")
        .select("id,nome,mrr,data_inicio,status,contrato_id")
        .eq("status", "ativo"),
      supabase
        .from("clientes")
        .select("id,data_inicio,data_cancelamento")
        .eq("status", "cancelado")
        .not("data_cancelamento", "is", null),
      supabase
        .from("contratos")
        .select("id,mrr,meses_contrato,valor_total_projeto,cliente_nome"),
      supabase
        .from("clientes_extra")
        .select("cliente_id,nicho")
        .limit(500),
    ]);

    // Tempo médio de permanência (meses) de clientes que já saíram
    const cancelados = clientesCancelados || [];
    let tempoMedioPermanencia = 12; // fallback
    if (cancelados.length > 0) {
      const tempos = cancelados.map((c) => {
        const inicio = new Date(c.data_inicio);
        const fim = new Date(c.data_cancelamento);
        return Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30)));
      });
      tempoMedioPermanencia = tempos.reduce((s, t) => s + t, 0) / tempos.length;
    }

    // Buscar risco de churn (clientes_notion_mirror se existir, senão default)
    let riscoChurnMap: Record<string, string> = {};
    try {
      const { data: mirror } = await supabase
        .from("clientes_notion_mirror")
        .select("cliente_id,risco_churn")
        .not("risco_churn", "is", null);
      if (mirror) {
        riscoChurnMap = Object.fromEntries(mirror.map((m) => [m.cliente_id, m.risco_churn]));
      }
    } catch {
      // Tabela pode não existir
    }

    // Map de nicho
    const nichoMap: Record<string, string> = {};
    for (const ce of clientesExtra || []) {
      if (ce.cliente_id && ce.nicho) nichoMap[ce.cliente_id] = ce.nicho;
    }

    // Calcular LTV individual
    const ativos = clientesAtivos || [];
    const breakdown: {
      cliente_id: string;
      nome: string;
      mrr: number;
      risco_churn: string;
      probabilidade_churn: number;
      tempo_medio_permanencia: number;
      ltv_individual: number;
      nicho: string;
    }[] = [];

    let ltvTotal = 0;

    for (const cli of ativos) {
      const mrr = Number(cli.mrr || 0);
      const risco = riscoChurnMap[cli.id] || "medio";
      const probChurn = CHURN_PROB[risco] ?? 0.25;
      const ltvIndividual = mrr * tempoMedioPermanencia * (1 - probChurn);
      const nicho = nichoMap[cli.id] || "Não definido";

      breakdown.push({
        cliente_id: cli.id,
        nome: cli.nome,
        mrr,
        risco_churn: risco,
        probabilidade_churn: probChurn,
        tempo_medio_permanencia: Math.round(tempoMedioPermanencia * 10) / 10,
        ltv_individual: Math.round(ltvIndividual * 100) / 100,
        nicho,
      });

      ltvTotal += ltvIndividual;
    }

    // Breakdown por nicho
    const porNicho: Record<string, { ltv: number; clientes: number; mrr: number }> = {};
    for (const b of breakdown) {
      if (!porNicho[b.nicho]) porNicho[b.nicho] = { ltv: 0, clientes: 0, mrr: 0 };
      porNicho[b.nicho].ltv += b.ltv_individual;
      porNicho[b.nicho].clientes += 1;
      porNicho[b.nicho].mrr += b.mrr;
    }

    const nichoBreakdown = Object.entries(porNicho).map(([nicho, data]) => ({
      nicho,
      ltv_total: Math.round(data.ltv * 100) / 100,
      clientes: data.clientes,
      mrr_total: Math.round(data.mrr * 100) / 100,
      pct_ltv: ltvTotal > 0 ? Math.round((data.ltv / ltvTotal) * 10000) / 100 : 0,
    })).sort((a, b) => b.ltv_total - a.ltv_total);

    // Impacto se todos de risco alto churnem
    const clientesAltoRisco = breakdown.filter((b) => b.risco_churn === "alto");
    const impactoChurnAlto = {
      clientes_em_risco: clientesAltoRisco.length,
      mrr_em_risco: Math.round(clientesAltoRisco.reduce((s, c) => s + c.mrr, 0) * 100) / 100,
      ltv_em_risco: Math.round(clientesAltoRisco.reduce((s, c) => s + c.ltv_individual, 0) * 100) / 100,
    };

    // Histórico de tempo médio de permanência mês a mês (últimos 6 meses)
    const historicoTempo: { mes: string; tempo_medio: number; cancelamentos: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const canceladosMes = cancelados.filter((c) => {
        const cancelDate = c.data_cancelamento?.slice(0, 7);
        return cancelDate === mes;
      });
      if (canceladosMes.length > 0) {
        const tempos = canceladosMes.map((c) => {
          const inicio = new Date(c.data_inicio);
          const fim = new Date(c.data_cancelamento);
          return Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30)));
        });
        historicoTempo.push({
          mes,
          tempo_medio: Math.round((tempos.reduce((s, t) => s + t, 0) / tempos.length) * 10) / 10,
          cancelamentos: canceladosMes.length,
        });
      } else {
        historicoTempo.push({ mes, tempo_medio: tempoMedioPermanencia, cancelamentos: 0 });
      }
    }

    return NextResponse.json({
      ltv_total_carteira: Math.round(ltvTotal * 100) / 100,
      total_clientes_ativos: ativos.length,
      tempo_medio_permanencia: Math.round(tempoMedioPermanencia * 10) / 10,
      breakdown: breakdown.sort((a, b) => b.ltv_individual - a.ltv_individual),
      por_nicho: nichoBreakdown,
      impacto_churn_alto: impactoChurnAlto,
      historico_tempo_permanencia: historicoTempo,
    });
  } catch (err) {
    console.error("[projecoes/ltv-carteira] Erro:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
