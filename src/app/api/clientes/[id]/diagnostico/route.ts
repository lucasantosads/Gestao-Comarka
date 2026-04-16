import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callAI } from "@/lib/ai-client";
import { saveToNotion, providerToOrigem } from "@/lib/notion-save";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

/**
 * POST /api/clientes/[id]/diagnostico
 * body: { salvar_notion?: boolean }
 *
 * Gera diagnóstico com Claude Haiku usando contexto dos últimos 3 meses.
 * Opcionalmente salva resultado no Notion (DB de relatórios).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const salvarNotion = !!body.salvar_notion;

    const { data: entrada } = await supabase
      .from("clientes_receita")
      .select("id, nome, valor_mensal, categoria, status_financeiro")
      .eq("id", id)
      .maybeSingle();
    if (!entrada) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    // mirror base (sempre existe)
    const { data: mirrorBase } = await supabase
      .from("clientes_notion_mirror")
      .select("notion_id, nicho, analista")
      .eq("entrada_id", id)
      .maybeSingle();

    // mirror extra (colunas da migration — pode não existir)
    let mirror: {
      notion_id: string;
      nicho: string | null;
      analista: string | null;
      score_saude: number | null;
      risco_churn: string | null;
      risco_churn_motivo: string | null;
      meta_campaign_id: string | null;
    } | null = null;
    if (mirrorBase) {
      const { data: extra } = await supabase
        .from("clientes_notion_mirror")
        .select("score_saude, risco_churn, risco_churn_motivo, meta_campaign_id")
        .eq("notion_id", mirrorBase.notion_id)
        .maybeSingle()
        .then(
          (r) => r,
          () => ({ data: null })
        );
      mirror = {
        notion_id: mirrorBase.notion_id,
        nicho: mirrorBase.nicho,
        analista: mirrorBase.analista,
        score_saude: extra?.score_saude ?? null,
        risco_churn: extra?.risco_churn || null,
        risco_churn_motivo: extra?.risco_churn_motivo || null,
        meta_campaign_id: extra?.meta_campaign_id || null,
      };
    }

    const notionId = mirror?.notion_id || null;

    const [{ data: teses }, { data: otims }, { data: reunioes }] = await Promise.all([
      notionId
        ? supabase.from("clientes_teses").select("nome_tese, status, orcamento").eq("notion_id", notionId).is("deleted_at", null)
        : Promise.resolve({ data: [] }),
      notionId
        ? supabase
            .from("otimizacoes_historico")
            .select("data, comentarios, solicitado, proxima_vez, data_confirmacao, feito")
            .eq("notion_id", notionId)
            .is("deleted_at", null)
            .order("data", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
      notionId
        ? supabase
            .from("reunioes_cliente")
            .select("data_reuniao, notas, tipo, status")
            .eq("cliente_notion_id", notionId)
            .order("data_reuniao", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] }),
    ]);

    const contexto = {
      cliente: {
        nome: entrada.nome,
        nicho: mirror?.nicho || "—",
        categoria: entrada.categoria || "—",
        valor_mensal: entrada.valor_mensal,
        status_financeiro: entrada.status_financeiro,
        analista: mirror?.analista || "—",
        score_saude: mirror?.score_saude ?? "não calculado",
        risco_churn: mirror?.risco_churn || "não calculado",
        motivo_risco: mirror?.risco_churn_motivo || null,
      },
      teses_ativas: (teses || []).filter((t) => t.status === "Ativa"),
      ultimas_otimizacoes: otims || [],
      ultimas_reunioes: reunioes || [],
    };

    const systemPrompt = `Você é um especialista em gestão de tráfego pago e retenção de clientes da Comarka Ads.
Ao receber o contexto operacional de um cliente (teses ativas, histórico de otimizações, reuniões, score de saúde e risco de churn),
produza um diagnóstico objetivo em português do Brasil no formato markdown:

## Diagnóstico atual
(2-3 frases descrevendo o momento do cliente)

## Pontos de atenção
1. ...
2. ...
3. ...

## Ações prioritárias
1. **Ação:** ... — **Por quê:** ...
2. **Ação:** ... — **Por quê:** ...
3. **Ação:** ... — **Por quê:** ...

Seja direto, baseado em dados, e evite genericidades. Se faltar dado essencial, aponte explicitamente.`;

    const userContent = `Contexto do cliente:\n\n\`\`\`json\n${JSON.stringify(contexto, null, 2)}\n\`\`\``;

    const provider = "anthropic-haiku" as const;
    const { text } = await callAI({
      provider,
      systemPrompt,
      userContent,
      maxTokens: 1500,
    });

    let notionUrl: string | undefined;
    if (salvarNotion && text) {
      const resumo = `Diagnóstico IA de ${entrada.nome} (${mirror?.nicho || "sem nicho"}) — score ${mirror?.score_saude ?? "—"}, risco ${mirror?.risco_churn || "—"}`;
      const save = await saveToNotion({
        titulo: `Diagnóstico — ${entrada.nome}`,
        iaOrigem: providerToOrigem(provider),
        tipo: "Analise",
        tags: [mirror?.nicho || "sem-nicho", "performance-cliente", "diagnostico"].filter(Boolean),
        relevancia: mirror?.risco_churn === "alto" ? "Alta" : "Media",
        resumo,
        conteudo: text,
      });
      if (save.success) notionUrl = save.url;
    }

    return NextResponse.json({ diagnostico: text, notion_url: notionUrl });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
