/**
 * GET /api/churn — Dados de churn (Supabase clientes + Notion)
 * POST /api/churn — Registrar cancelamento
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60; // KPI aggregation

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Buscar clientes do Supabase + contratos para contar ativos
    const [{ data: clientes }, { data: churnView }, { data: contratosAtivos }] = await Promise.all([
      supabase.from("clientes").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("vw_churn_mensal").select("*").order("mes_referencia"),
      supabase.from("contratos").select("cliente_nome, mrr").limit(1000),
    ]);

    const clientesData = (clientes || []) as {
      id: string; nome: string; email: string | null; telefone: string | null;
      data_inicio: string; data_cancelamento: string | null; status: string;
      motivo_cancelamento: string | null; observacao: string | null; mrr: number;
      closer_id: string | null;
    }[];

    // FONTE ÚNICA: clientes ativos vêm sempre de clientes_receita (Entradas)
    const { data: receitaData } = await supabase
      .from("clientes_receita")
      .select("status_financeiro, valor_mensal");
    const operacionais = (receitaData || []).filter((c) =>
      ["ativo", "pausado", "pagou_integral", "parceria"].includes(c.status_financeiro || "")
    );
    const totalAtivos = operacionais.length;
    void contratosAtivos;

    const cancelados = clientesData.filter((c) => c.status === "cancelado");
    const mesAtual = new Date().toISOString().slice(0, 7);
    const canceladosMes = cancelados.filter((c) => c.data_cancelamento?.startsWith(mesAtual));
    // MRR ativos: fonte única = clientes_receita (Entradas)
    const mrrAtivos = operacionais.reduce((s, c) => s + Number(c.valor_mensal || 0), 0);
    const mrrPerdidoMes = canceladosMes.reduce((s, c) => s + Number(c.mrr), 0);

    return NextResponse.json({
      clientes: clientesData,
      churnMensal: churnView || [],
      resumo: {
        totalAtivos,
        totalCancelados: cancelados.length,
        canceladosMes: canceladosMes.length,
        mrrAtivos,
        mrrPerdidoMes,
        churnRate: totalAtivos + canceladosMes.length > 0
          ? (canceladosMes.length / (totalAtivos + canceladosMes.length)) * 100 : 0,
        mrrChurnRate: mrrAtivos + mrrPerdidoMes > 0
          ? (mrrPerdidoMes / (mrrAtivos + mrrPerdidoMes)) * 100 : 0,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nome, email, telefone, data_inicio, data_cancelamento, status, motivo_cancelamento, observacao, mrr, closer_id } = body;

    if (!nome) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

    const { data, error } = await supabase.from("clientes").insert({
      nome, email: email || null, telefone: telefone || null,
      data_inicio: data_inicio || new Date().toISOString().split("T")[0],
      data_cancelamento: data_cancelamento || null,
      status: status || "ativo",
      motivo_cancelamento: motivo_cancelamento || null,
      observacao: observacao || null,
      mrr: mrr || 0,
      closer_id: closer_id || null,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, cliente: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
