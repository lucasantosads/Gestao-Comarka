import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

// GET: lista todos + métrica de tempo médio
export async function GET(req: NextRequest) {
  const notionId = req.nextUrl.searchParams.get("notion_id");
  if (notionId) {
    const { data, error } = await supabase.from("onboarding_tracking").select("*").eq("notion_id", notionId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from("onboarding_tracking")
    .select("*")
    .order("iniciado_em", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // "Finalizado" = etapa_atual é 'Trabalho iniciado' (fonte única: o kanban)
  // "Em andamento" = qualquer outra etapa
  const finalizadosPorEtapa = (data || []).filter((t) => t.etapa_atual === "Trabalho iniciado");
  const emAndamento = (data || []).filter((t) => t.etapa_atual !== "Trabalho iniciado");
  // Tempo médio: só conta quem tem tempo_total_segundos registrado
  const comTempo = finalizadosPorEtapa.filter((t) => t.tempo_total_segundos);
  const tempoMedio = comTempo.length > 0
    ? comTempo.reduce((s, t) => s + Number(t.tempo_total_segundos || 0), 0) / comTempo.length
    : 0;

  return NextResponse.json({
    items: data || [],
    metricas: {
      total: data?.length || 0,
      finalizados: finalizadosPorEtapa.length,
      em_andamento: emAndamento.length,
      tempo_medio_segundos: Math.round(tempoMedio),
      tempo_medio_dias: Math.round(tempoMedio / 86400 * 10) / 10,
    },
  });
}

// PATCH: atualiza etapa, e se for "Trabalho iniciado" → finaliza tracking
export async function PATCH(req: NextRequest) {
  const { notion_id, etapa, cliente_nome } = await req.json();
  if (!notion_id) return NextResponse.json({ error: "notion_id obrigatório" }, { status: 400 });

  // Garante que existe tracking pra esse onboarding
  const { data: existing } = await supabase
    .from("onboarding_tracking")
    .select("*")
    .eq("notion_id", notion_id)
    .maybeSingle();

  if (!existing) {
    // Não existe ainda — criar agora (caso o onboarding tenha sido criado antes desse sistema)
    const nowIso = new Date().toISOString();
    await supabase.from("onboarding_tracking").insert({
      notion_id, cliente_nome: cliente_nome || null,
      iniciado_em: nowIso,
      etapa_atual: etapa || null,
      etapa_entrada_em: nowIso,
    });
    return NextResponse.json({ success: true, novo: true });
  }

  const updates: Record<string, unknown> = {
    etapa_atual: etapa,
    updated_at: new Date().toISOString(),
  };

  // Se a etapa de fato mudou, marca a data de entrada na nova coluna
  if (etapa && etapa !== existing.etapa_atual) {
    updates.etapa_entrada_em = new Date().toISOString();
  }

  // Se mudou para "Trabalho iniciado" e ainda não foi finalizado → registra finalização
  if (etapa === "Trabalho iniciado" && !existing.finalizado_em) {
    const fim = new Date();
    const inicio = new Date(existing.iniciado_em);
    const segundos = Math.floor((fim.getTime() - inicio.getTime()) / 1000);
    updates.finalizado_em = fim.toISOString();
    updates.tempo_total_segundos = segundos;
  }

  // Se voltou de "Trabalho iniciado" → reabre
  if (etapa !== "Trabalho iniciado" && existing.finalizado_em) {
    updates.finalizado_em = null;
    updates.tempo_total_segundos = null;
  }

  const { data, error } = await supabase.from("onboarding_tracking").update(updates).eq("notion_id", notion_id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
