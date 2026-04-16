/**
 * POST /api/financeiro/churnar-cliente
 * Registra churn de um cliente de clientes_receita:
 * 1. Marca como churned em clientes_receita
 * 2. Cria/atualiza registro na tabela clientes (pipeline de churn)
 * 3. Insere row em churn_log → o trigger trigger_update_churn_summary
 *    incrementa churn_monthly_summary.num_saidas (fonte de TODOS os cards
 *    de churn em /entradas, /churn, /recebimentos, /churn-canonico,
 *    /churn-summary). Também dispara on_churn_insert que cria notificação.
 * 4. Sincroniza com Notion (Finalizado)
 *
 * BUG corrigido: antes esta rota só escrevia em `clientes`, então o trigger
 * de bump nunca disparava e o card "Churn no mês" mostrava o valor antigo.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getClientes, updateClienteStatus } from "@/lib/data";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

// Mapeia motivos do dropdown da UI para os valores aceitos pelo CHECK
// constraint de churn_log.motivo. O texto original vai em motivo_detalhe.
const MOTIVO_MAP: Record<string, string> = {
  "Falta de resultados": "Resultado insatisfatorio",
  "Financeiro da empresa": "Sem verba",
  "Não precisa mais do serviço": "Mudou de estrategia",
  "Nao precisa mais do servico": "Mudou de estrategia",
  "Problema de atendimento": "Outro",
  "Concorrente": "Concorrente",
  "Desistência da empresa": "Outro",
  "Desistencia da empresa": "Outro",
  "Problemas pessoais": "Outro",
  "Outro": "Outro",
  "Sumiu": "Sumiu",
  "Preço": "Preco",
  "Preco": "Preco",
};

export async function POST(req: NextRequest) {
  const { cliente_receita_id, motivo, observacao } = await req.json();

  if (!cliente_receita_id) return NextResponse.json({ error: "cliente_receita_id obrigatório" }, { status: 400 });

  // 1. Buscar dados do cliente
  const { data: cliente, error: fetchErr } = await supabase
    .from("clientes_receita")
    .select("id, nome, valor_mensal, closer, status_financeiro")
    .eq("id", cliente_receita_id)
    .single();

  if (fetchErr || !cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  // Validação: churn só para clientes ativos
  const statusAtivos = ["ativo", "pausado", "pagou_integral", "parceria"];
  if (!statusAtivos.includes(cliente.status_financeiro || "")) {
    return NextResponse.json({
      error: "Churn só pode ser registrado para clientes ativos. Status atual: " + (cliente.status_financeiro || "desconhecido"),
    }, { status: 400 });
  }

  // Warning: verificar se existe contrato (não bloqueia)
  const { data: contratoExiste } = await supabase
    .from("contratos")
    .select("id")
    .ilike("cliente_nome", `%${cliente.nome}%`)
    .limit(1)
    .maybeSingle();

  const warnings: string[] = [];
  if (!contratoExiste) {
    warnings.push("Nenhum contrato encontrado para este cliente");
  }

  const hoje = new Date().toISOString().split("T")[0];

  // 2. Marcar como churned em clientes_receita
  const { error: updateErr } = await supabase
    .from("clientes_receita")
    .update({
      status: "churned",
      status_financeiro: "churned",
      updated_at: new Date().toISOString(),
    })
    .eq("id", cliente_receita_id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // 3. Criar registro na tabela clientes (pipeline de churn)
  const { error: churnErr } = await supabase
    .from("clientes")
    .upsert({
      nome: cliente.nome,
      mrr: cliente.valor_mensal,
      data_cancelamento: hoje,
      data_inicio: hoje,
      status: "cancelado",
      motivo_cancelamento: motivo || "Não informado",
      observacao: observacao || null,
      etapa_churn: "aviso_recebido",
    }, { onConflict: "nome" });

  if (churnErr) {
    console.error("[churnar-cliente] Erro ao criar no pipeline:", churnErr.message);
  }

  // 3.5. Lookup do notion_id (também usado pela sync abaixo)
  let notionId: string | null = null;
  try {
    const all = await getClientes();
    const notionCliente = all.find((c) => c.nome.trim().toLowerCase() === cliente.nome.trim().toLowerCase());
    if (notionCliente?.notion_id) notionId = notionCliente.notion_id;
  } catch (e) { console.error("[churnar-cliente] lookup notion:", e); }

  // 4. Inserir em churn_log → dispara trigger que bump churn_monthly_summary
  // Evita duplicata: só insere se não houver row recente para o mesmo cliente.
  try {
    const inicioMes = `${hoje.slice(0, 7)}-01`;
    const { data: jaExiste } = await supabase
      .from("churn_log")
      .select("id")
      .eq("cliente_nome", cliente.nome)
      .gte("data_saida", inicioMes)
      .limit(1)
      .maybeSingle();

    if (!jaExiste) {
      const motivoCanon = MOTIVO_MAP[motivo || ""] || "Outro";
      const { error: logErr } = await supabase.from("churn_log").insert({
        cliente_notion_id: notionId || cliente_receita_id, // fallback: id da receita
        cliente_nome: cliente.nome,
        data_saida: hoje,
        motivo: motivoCanon,
        motivo_detalhe: motivo && motivoCanon !== motivo ? motivo : (observacao || null),
        mensalidade: cliente.valor_mensal,
      });
      if (logErr) {
        console.error("[churnar-cliente] Erro ao inserir em churn_log:", logErr.message);
        // Fallback: bump direto em churn_monthly_summary se o log falhou
        const anoMes = `${hoje.slice(0, 4)}/${hoje.slice(5, 7)}`;
        const { data: cur } = await supabase
          .from("churn_monthly_summary")
          .select("num_saidas")
          .eq("ano_mes", anoMes)
          .maybeSingle();
        await supabase.from("churn_monthly_summary").upsert({
          ano_mes: anoMes,
          num_saidas: Number(cur?.num_saidas || 0) + 1,
          total_clientes: 0,
          is_historico: false,
        }, { onConflict: "ano_mes" });
      }
    }
  } catch (e) { console.error("[churnar-cliente] churn_log:", e); }

  // 5. Sincronizar com Notion: marcar como Finalizado
  try {
    if (notionId) await updateClienteStatus(notionId, "Finalizado");
  } catch (e) { console.error("[sync] Erro Entradas→Notion:", e); }

  return NextResponse.json({ success: true, nome: cliente.nome, warnings });
}
