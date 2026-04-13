/**
 * POST /api/clientes/resumo-reuniao
 * Gera resumo estruturado de uma reunião a partir da transcrição
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  const { reuniao_id } = await req.json();
  if (!reuniao_id) return NextResponse.json({ error: "reuniao_id obrigatório" }, { status: 400 });

  const { data: reuniao, error } = await supabase.from("reunioes_cliente").select("*").eq("id", reuniao_id).single();
  if (error || !reuniao) return NextResponse.json({ error: "Reunião não encontrada" }, { status: 404 });
  if (!reuniao.transcricao) return NextResponse.json({ error: "Sem transcrição para resumir" }, { status: 400 });

  const prompt = `Resuma a reunião abaixo em português BR de forma estruturada.

TIPO: ${reuniao.tipo}
DATA: ${reuniao.data_reuniao}
NOTAS PRÉVIAS: ${reuniao.notas || "—"}

TRANSCRIÇÃO:
${reuniao.transcricao.slice(0, 8000)}

Formato esperado:
**Pontos Discutidos** — principais tópicos abordados
**Decisões Tomadas** — o que ficou definido
**Próximos Passos** — ações com responsáveis
**Alertas** — preocupações ou riscos mencionados`;

  const aiRes = await fetch(new URL("/api/closer-analysis", req.url).toString(), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ closerData: prompt, customPrompt: "Resumo de reunião. Direto. Português BR." }),
  });
  const aiData = await aiRes.json();
  const resumo = aiData.analysis || "Erro ao gerar resumo";

  const { data: updated, error: updErr } = await supabase.from("reunioes_cliente").update({
    resumo_ia: resumo,
    resumo_gerado_em: new Date().toISOString(),
  }).eq("id", reuniao_id).select().single();

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json(updated);
}
