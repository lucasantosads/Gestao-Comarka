/**
 * POST /api/clientes/resumo-semanal
 * Gera resumo semanal de um cliente via IA (reutiliza /api/closer-analysis com Claude)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getClienteById } from "@/lib/data";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function POST(req: NextRequest) {
  const { notion_id } = await req.json();
  if (!notion_id) return NextResponse.json({ error: "notion_id obrigatório" }, { status: 400 });

  // 1. Buscar dados do cliente
  const cliente = await getClienteById(notion_id);
  if (!cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 7);
  const periodo_inicio = inicio.toISOString().split("T")[0];
  const periodo_fim = fim.toISOString().split("T")[0];

  // 2. Buscar contexto: reuniões, teses, otimizações, extra
  const [reunioes, teses, otimizacoes, extra] = await Promise.all([
    supabase.from("reunioes_cliente").select("*").eq("cliente_notion_id", notion_id).gte("data_reuniao", periodo_inicio).order("data_reuniao", { ascending: false }),
    supabase.from("clientes_teses").select("*").eq("notion_id", notion_id).is("deleted_at", null),
    supabase.from("otimizacoes_historico").select("*").eq("notion_id", notion_id).is("deleted_at", null).gte("data", periodo_inicio).order("data", { ascending: false }),
    supabase.from("clientes_extra").select("*").eq("notion_id", notion_id).maybeSingle(),
  ]);

  const extraData = extra.data;

  const prompt = `Gere um resumo semanal do cliente ${cliente.nome} da agência Comarka Ads para a semana de ${periodo_inicio} a ${periodo_fim}.

=== STATUS GERAL ===
Nicho: ${cliente.nicho || "N/A"}
Status: ${cliente.status} | Situação: ${cliente.situacao} | Resultados: ${cliente.resultados}
Nível de Atenção: ${cliente.atencao}
Gestor: ${cliente.analista}

=== TESES ATIVAS ===
${(teses.data || []).map((t) => `- ${t.tese}: Orçamento R$${t.orcamento || 0}`).join("\n") || "Nenhuma tese cadastrada"}

=== REUNIÕES DA SEMANA ===
${(reunioes.data || []).map((r) => `- ${r.tipo} em ${new Date(r.data_reuniao).toLocaleDateString("pt-BR")} (${r.status})${r.notas ? `\n  Notas: ${r.notas}` : ""}${r.resumo_ia ? `\n  Resumo IA: ${r.resumo_ia.slice(0, 200)}` : ""}`).join("\n\n") || "Nenhuma reunião registrada"}

=== OTIMIZAÇÕES APLICADAS ===
${(otimizacoes.data || []).map((o) => `- ${o.data}: ${o.feito || ""} ${o.comentarios ? `(${o.comentarios})` : ""}`).join("\n") || "Nenhuma otimização registrada"}

=== SAÚDE DO CLIENTE ===
Score: ${extraData?.saude_score || 50}/100
Observação: ${extraData?.saude_observacao || "—"}
Resumo WhatsApp: ${extraData?.whatsapp_resumo || "—"}

Gere um resumo em português BR estruturado em:
**Performance** — principais números e tendências
**Reuniões** — o que aconteceu nas reuniões da semana
**Otimizações** — ações aplicadas e impacto
**Alertas** — pontos de atenção imediatos
**Próximos Passos** — ações recomendadas para a próxima semana`;

  // 3. Chamar Claude via /api/closer-analysis
  const aiRes = await fetch(new URL("/api/closer-analysis", req.url).toString(), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ closerData: prompt, customPrompt: "Resumo executivo direto e prático. Português BR." }),
  });
  const aiData = await aiRes.json();
  const conteudo = aiData.analysis || "Erro ao gerar resumo";

  // 4. Salvar no banco
  const { data: resumo, error } = await supabase.from("resumos_cliente").insert({
    cliente_notion_id: notion_id,
    tipo: "semanal",
    conteudo,
    periodo_inicio,
    periodo_fim,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(resumo);
}
