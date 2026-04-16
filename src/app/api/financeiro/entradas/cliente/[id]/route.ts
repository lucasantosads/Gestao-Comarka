import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getClientes, updateClienteStatus } from "@/lib/data";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

// Mapa reverso: Entradas status_financeiro → Notion Status
const ENTRADAS_TO_NOTION: Record<string, string> = {
  "ativo": "Ativo",
  "pausado": "Pausado",
  "pagou_integral": "Ativo",
  "parceria": "Ativo",
  "churned": "Finalizado",
};

async function syncToNotion(nome: string, statusFinanceiro: string) {
  try {
    const notionStatus = ENTRADAS_TO_NOTION[statusFinanceiro];
    if (!notionStatus) return;
    const all = await getClientes();
    const cliente = all.find((c) => c.nome.trim().toLowerCase() === nome.trim().toLowerCase());
    if (cliente?.notion_id) {
      await updateClienteStatus(cliente.notion_id, notionStatus);
    }
  } catch (e) { console.error("[sync] Erro Entradas→Notion:", e); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const updates: Record<string, unknown> = {};

  const allowed = ["valor_mensal", "status", "status_financeiro", "dia_pagamento", "closer", "tipo_contrato", "obs", "plataforma", "categoria", "valor_integral", "forma_pagamento", "parcelas_integral", "fidelidade_meses", "fidelidade_inicio"];
  // Colunas DATE — string vazia precisa virar null para o Postgres
  // (caso contrário: invalid input syntax for type date: "")
  const DATE_FIELDS = new Set(["fidelidade_inicio", "fidelidade_fim", "mes_fechamento"]);
  for (const key of allowed) {
    if (body[key] !== undefined) {
      let v = body[key];
      if (DATE_FIELDS.has(key) && v === "") v = null;
      updates[key] = v;
    }
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });

  // Recalcular fidelidade_fim quando há meses E início válidos.
  // Se algum dos dois estiver zerado/null, limpa também o fim.
  if (updates.fidelidade_meses !== undefined || updates.fidelidade_inicio !== undefined) {
    const meses = Number(updates.fidelidade_meses ?? body.fidelidade_meses ?? 0);
    const inicio = (updates.fidelidade_inicio ?? body.fidelidade_inicio) as string | null;
    if (meses > 0 && inicio) {
      const d = new Date(inicio);
      d.setMonth(d.getMonth() + meses);
      updates.fidelidade_fim = d.toISOString().split("T")[0];
    } else {
      updates.fidelidade_fim = null;
    }
  }

  // Se mudou o status para algo "ativo-equivalente", limpa data_cancelamento
  // dos espelhos para que a reativação fique consistente.
  const novoSf = updates.status_financeiro as string | undefined;
  const reativando = (updates.status === "ativo" || novoSf === "ativo" || novoSf === "pausado" || novoSf === "pagou_integral" || novoSf === "parceria");

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("clientes_receita")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sincronização bidirecional: se mudou status_financeiro, reflete no Notion
  if (updates.status_financeiro && data?.nome) {
    await syncToNotion(data.nome, updates.status_financeiro as string);
  }

  // Se o cliente está sendo REATIVADO (saindo de churned), reverter os
  // espelhos de churn — caso contrário ele continua aparecendo nos cards.
  if (reativando && data?.nome) {
    try {
      // 1. Apaga rows de cancelamento no pipeline `clientes`
      await supabase
        .from("clientes")
        .delete()
        .eq("nome", data.nome)
        .eq("status", "cancelado");

      // 2. Decrementa churn_monthly_summary do(s) mês(es) afetado(s) e
      //    apaga rows correspondentes em churn_log para não duplicar
      //    contagem em re-churns futuros.
      const { data: logs } = await supabase
        .from("churn_log")
        .select("id, data_saida")
        .eq("cliente_nome", data.nome);
      for (const l of (logs || []) as Array<{ id: string; data_saida: string }>) {
        const anoMes = `${l.data_saida.slice(0, 4)}/${l.data_saida.slice(5, 7)}`;
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
        await supabase.from("churn_log").delete().eq("id", l.id);
      }
    } catch (e) {
      console.error("[reativacao] erro ao reverter espelhos de churn:", e);
    }
  }

  return NextResponse.json(data);
}
