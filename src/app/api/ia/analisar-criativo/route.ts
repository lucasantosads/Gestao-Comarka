/**
 * POST /api/ia/analisar-criativo
 * Aceita: { criativo_id: string }
 * Analisa criativo com Claude Haiku e salva resultado.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callAI } from "@/lib/ai-client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { criativo_id } = await req.json();
    if (!criativo_id) {
      return NextResponse.json({ error: "criativo_id obrigatório" }, { status: 400 });
    }

    // Buscar criativo
    const { data: criativo, error } = await supabase
      .from("trafego_criativos")
      .select("*")
      .eq("id", criativo_id)
      .is("deleted_at", null)
      .single();

    if (error || !criativo) {
      return NextResponse.json({ error: "Criativo não encontrado" }, { status: 404 });
    }

    // Se vídeo e transcrição pendente, retornar erro
    if (criativo.tipo === "video" && criativo.transcricao_status === "pendente") {
      return NextResponse.json({
        error: "Transcrição pendente — aguardar processamento do vídeo antes de analisar."
      }, { status: 400 });
    }

    // Atualizar status para processando
    await supabase
      .from("trafego_criativos")
      .update({ analise_status: "processando" })
      .eq("id", criativo_id);

    // Montar conteúdo conforme tipo
    let conteudo = "";
    if (criativo.tipo === "video") {
      conteudo = criativo.transcricao_texto || "(sem transcrição disponível)";
    } else if (criativo.tipo === "imagem") {
      conteudo = criativo.copy_texto || "(sem copy disponível)";
    } else if (criativo.tipo === "roteiro") {
      conteudo = criativo.roteiro_texto || "(sem roteiro disponível)";
    }

    // Buscar referências de criativos com boa performance do mesmo nicho/cliente
    let referencias = "";
    const { data: bons } = await supabase
      .from("trafego_criativo_metricas")
      .select("criativo_id, score_periodo, cpl, ctr, leads")
      .gt("score_periodo", 7)
      .order("score_periodo", { ascending: false })
      .limit(10);

    if (bons && bons.length > 0) {
      const criativoIds = bons.map((b) => b.criativo_id);
      const { data: criativos } = await supabase
        .from("trafego_criativos")
        .select("id, nome, nicho, copy_texto, roteiro_texto, tipo, cliente_id")
        .in("id", criativoIds)
        .is("deleted_at", null);

      const relevantes = (criativos || []).filter(
        (c) => c.nicho === criativo.nicho || c.cliente_id === criativo.cliente_id
      );

      if (relevantes.length > 0) {
        referencias = "\n\nREFERÊNCIAS DE CRIATIVOS COM BOA PERFORMANCE:\n";
        for (const ref of relevantes.slice(0, 3)) {
          const metrica = bons.find((b) => b.criativo_id === ref.id);
          referencias += `\n--- ${ref.nome} (score: ${metrica?.score_periodo}, CPL: R$${metrica?.cpl || "?"}) ---\n`;
          referencias += ref.copy_texto || ref.roteiro_texto || "(sem texto)";
          referencias += "\n";
        }
      }
    }

    const systemPrompt = `Você é especialista em copy jurídico para Meta Ads. Analise este criativo e retorne APENAS JSON válido sem markdown:
{
  "pontos_fortes": ["string"],
  "pontos_fracos": ["string"],
  "score": number,
  "gatilhos_identificados": ["string"],
  "publico_provavel": "string",
  "nicho_juridico": "string",
  "sugestoes_copy": [
    {
      "versao": "A",
      "headline": "string",
      "copy_completo": "string",
      "justificativa": "string",
      "baseado_em": "string"
    }
  ],
  "alerta_compliance": "string ou null"
}`;

    const userContent = `CRIATIVO: ${criativo.nome}
TIPO: ${criativo.tipo}
NICHO: ${criativo.nicho || "não especificado"}

CONTEÚDO:
${conteudo}
${referencias}`;

    const result = await callAI({
      provider: "anthropic-haiku",
      systemPrompt,
      userContent,
      maxTokens: 2000,
    });

    // Extrair JSON da resposta
    let analise;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      analise = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(result.text);
    } catch {
      await supabase
        .from("trafego_criativos")
        .update({ analise_status: "erro" })
        .eq("id", criativo_id);
      return NextResponse.json({ error: "Falha ao parsear resposta da IA", raw: result.text }, { status: 500 });
    }

    // Salvar resultado
    await supabase
      .from("trafego_criativos")
      .update({
        analise_resultado: analise,
        score_final: analise.score || null,
        analise_status: "concluido",
      })
      .eq("id", criativo_id);

    return NextResponse.json({ success: true, analise });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
