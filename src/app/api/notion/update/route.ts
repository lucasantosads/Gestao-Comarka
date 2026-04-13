import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  updateClienteStatus, updateClienteSituacao, updateClienteResultados,
  updateClienteAtencao, updateClienteUltimoFeedback, updateClienteOtimizacao,
  updateClienteDiaOtimizar, updateClienteOrcamento, addOtimizacaoEntry,
  updateOnboardingEtapa, toggleChecklistItem, updateMembroFuncoes,
  getClienteById,
} from "@/lib/data";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Mapa de Notion Status → Entradas status_financeiro
const NOTION_TO_ENTRADAS: Record<string, string> = {
  "Ativo": "ativo",
  "Planejamento": "ativo",
  "Pausado": "pausado",
  "Aviso 30 dias": "pausado",
  "Inadimplente": "pausado",
  "Finalizado": "churned",
  "Não iniciado": "ativo",
};

const FIELD_MAP: Record<string, (id: string, v: string) => Promise<{ success: boolean; error?: string }>> = {
  status: updateClienteStatus,
  situacao: updateClienteSituacao,
  resultados: updateClienteResultados,
  atencao: updateClienteAtencao,
  ultimo_feedback: updateClienteUltimoFeedback,
  ultima_otimizacao: updateClienteOtimizacao,
  dia_otimizacao: updateClienteDiaOtimizar,
  etapa: updateOnboardingEtapa,
  funcoes: updateMembroFuncoes,
};

// Sincroniza Entradas (clientes_receita) quando Notion muda
async function syncToEntradas(notionId: string, newStatus: string) {
  try {
    const cliente = await getClienteById(notionId);
    if (!cliente?.nome) return;
    const sfEsperado = NOTION_TO_ENTRADAS[newStatus] || "ativo";
    const updates: Record<string, unknown> = { status_financeiro: sfEsperado };
    if (sfEsperado === "churned") updates.status = "churned";
    else if (sfEsperado === "ativo") updates.status = "ativo";
    await supabase.from("clientes_receita").update(updates).eq("nome", cliente.nome);
  } catch (e) { console.error("[sync] Erro Notion→Entradas:", e); }
}

export async function POST(req: NextRequest) {
  const { notion_id, field, value } = await req.json();
  if (!notion_id || !field) return NextResponse.json({ error: "notion_id e field obrigatórios" }, { status: 400 });

  if (field === "otimizacao_entry") {
    const entry = JSON.parse(value);
    const result = await addOtimizacaoEntry(notion_id, entry);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  }

  if (field === "checklist_toggle") {
    const result = await toggleChecklistItem(notion_id, value === "true");
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  }

  if (field === "orcamento") {
    const result = await updateClienteOrcamento(notion_id, Number(value));
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  }

  if (field === "analista") {
    const { updateClienteAnalista } = await import("@/lib/data");
    const result = await updateClienteAnalista(notion_id, value);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  }

  const fn = FIELD_MAP[field];
  if (!fn) return NextResponse.json({ error: `Campo ${field} não suportado` }, { status: 400 });

  const result = await fn(notion_id, value);

  // Sincronização bidirecional: se mudou o status do cliente, reflete em Entradas
  if (result.success && field === "status") {
    await syncToEntradas(notion_id, value);
  }

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
