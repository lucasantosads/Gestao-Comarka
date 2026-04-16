import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { updateClienteStatus } from "@/lib/data";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function GET(req: NextRequest) {
  const gestorId = req.nextUrl.searchParams.get("gestor_id");
  const motivo = req.nextUrl.searchParams.get("motivo");
  const de = req.nextUrl.searchParams.get("de");
  const ate = req.nextUrl.searchParams.get("ate");

  let query = supabase.from("churn_log").select("*").order("data_saida", { ascending: false });
  if (gestorId) query = query.eq("gestor_id", gestorId);
  if (motivo) query = query.eq("motivo", motivo);
  if (de) query = query.gte("data_saida", de);
  if (ate) query = query.lte("data_saida", ate);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    cliente_notion_id, cliente_nome, data_saida, motivo, motivo_detalhe,
    ltv_total, meses_ativo, gestor_id, closer_id, nivel_atencao_saida,
    resultados_saida, mensalidade,
  } = body;

  if (!cliente_notion_id || !cliente_nome || !motivo) {
    return NextResponse.json({ error: "cliente_notion_id, cliente_nome, motivo obrigatórios" }, { status: 400 });
  }

  const { data, error } = await supabase.from("churn_log").insert({
    cliente_notion_id, cliente_nome,
    data_saida: data_saida || new Date().toISOString().split("T")[0],
    motivo, motivo_detalhe: motivo_detalhe || null,
    ltv_total: ltv_total || null, meses_ativo: meses_ativo || null,
    gestor_id: gestor_id || null, closer_id: closer_id || null,
    nivel_atencao_saida: nivel_atencao_saida || null,
    resultados_saida: resultados_saida || null,
    mensalidade: mensalidade || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Marcar cliente como Finalizado no Notion
  try {
    await updateClienteStatus(cliente_notion_id, "Finalizado");
  } catch (e) { console.error("[churn-log] erro Notion:", e); }

  // Marcar como churned em clientes_receita também
  await supabase.from("clientes_receita").update({
    status: "churned", status_financeiro: "churned",
  }).eq("nome", cliente_nome);

  // Espelhar no pipeline `clientes` (fonte de mrr_perdido_mes em /churn,
  // /dre e /churn-canonico). Sem isso, este endpoint registra churn nos
  // counts via summary mas o MRR perdido fica zerado.
  // Bug-irmão de /api/financeiro/churnar-cliente.
  const dataSaida = data_saida || new Date().toISOString().split("T")[0];
  await supabase.from("clientes").upsert({
    nome: cliente_nome,
    mrr: mensalidade || 0,
    data_inicio: dataSaida,
    data_cancelamento: dataSaida,
    status: "cancelado",
    motivo_cancelamento: motivo_detalhe || motivo,
    etapa_churn: "aviso_recebido",
  }, { onConflict: "nome" });

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  // Buscar o churn antes de deletar pra reverter
  const { data: churn } = await supabase.from("churn_log").select("*").eq("id", id).single();

  const { error } = await supabase.from("churn_log").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reverter: cliente volta para Ativo
  if (churn?.cliente_notion_id) {
    try { await updateClienteStatus(churn.cliente_notion_id, "Ativo"); } catch {}
  }
  if (churn?.cliente_nome) {
    await supabase.from("clientes_receita").update({
      status: "ativo", status_financeiro: "ativo",
    }).eq("nome", churn.cliente_nome);
    // Reverter no pipeline `clientes` também (apaga a row de churn)
    await supabase.from("clientes")
      .delete()
      .eq("nome", churn.cliente_nome)
      .eq("status", "cancelado");
  }

  // Decrementar churn_monthly_summary (o trigger só fira em INSERT)
  if (churn?.data_saida) {
    const anoMes = `${churn.data_saida.slice(0, 4)}/${churn.data_saida.slice(5, 7)}`;
    const { data: cur } = await supabase
      .from("churn_monthly_summary")
      .select("num_saidas")
      .eq("ano_mes", anoMes)
      .maybeSingle();
    if (cur && Number(cur.num_saidas || 0) > 0) {
      await supabase
        .from("churn_monthly_summary")
        .update({ num_saidas: Number(cur.num_saidas) - 1 })
        .eq("ano_mes", anoMes);
    }
  }

  return NextResponse.json({ success: true });
}
