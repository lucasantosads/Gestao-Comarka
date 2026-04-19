import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
);

/**
 * GET /api/meu-tempo?colaborador_id=...
 * Retorna dados de tempo do colaborador: sessões hoje, 7 dias, 30 dias,
 * meta, tarefas recentes, timer ativo.
 */
export async function GET(req: NextRequest) {
  try {
    const colaboradorId = req.nextUrl.searchParams.get("colaborador_id");
    if (!colaboradorId) return NextResponse.json({ error: "colaborador_id obrigatório" }, { status: 400 });

    const now = new Date();
    const hoje = now.toISOString().split("T")[0];

    // 7 dias atrás
    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 6);
    const desde7 = d7.toISOString().split("T")[0];

    // 30 dias atrás
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 29);
    const desde30 = d30.toISOString().split("T")[0];

    const [
      { data: employee },
      { data: sessoesHoje },
      { data: sessoes7d },
      { data: sessoes30d },
      { data: tarefasRecentes },
      { data: tiposOpcoes },
    ] = await Promise.all([
      supabase.from("employees").select("id, nome, meta_horas_semanais, alerta_inatividade_horas, foto_url").eq("id", colaboradorId).single(),
      supabase.from("time_sessions").select("duracao_segundos, iniciado_em, pausado_em").eq("colaborador_id", colaboradorId).eq("data_referencia", hoje),
      supabase.from("time_sessions").select("duracao_segundos, data_referencia").eq("colaborador_id", colaboradorId).gte("data_referencia", desde7).order("data_referencia"),
      supabase.from("time_sessions").select("duracao_segundos, tarefa_id, data_referencia, tarefas_kanban(tipo_tarefa)").eq("colaborador_id", colaboradorId).gte("data_referencia", desde30),
      supabase.from("tarefas_kanban").select("id, titulo, tipo_tarefa, total_segundos, em_andamento, ultimo_inicio, status, responsavel_id")
        .eq("responsavel_id", colaboradorId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(5),
      supabase.from("tipo_tarefa_opcoes").select("id, nome, cor").is("deleted_at", null).order("nome"),
    ]);

    // Horas hoje
    const segundosHoje = (sessoesHoje || []).reduce((s, r) => s + (r.duracao_segundos || 0), 0);

    // Timer ativo?
    const timerAtivo = (tarefasRecentes || []).find((t: any) => t.em_andamento && t.ultimo_inicio);
    let timerExtra = 0;
    if (timerAtivo) {
      timerExtra = Math.floor((Date.now() - new Date(timerAtivo.ultimo_inicio).getTime()) / 1000);
    }
    // Sessão aberta hoje (sem pausado_em) contribui com tempo em andamento
    const sessaoAberta = (sessoesHoje || []).find((s: any) => !s.pausado_em && s.iniciado_em);
    if (sessaoAberta) {
      timerExtra = Math.max(timerExtra, Math.floor((Date.now() - new Date(sessaoAberta.iniciado_em).getTime()) / 1000));
    }

    // Meta diária
    const metaSemanais = employee?.meta_horas_semanais || 40;
    const metaDiariaSegundos = Math.round((metaSemanais / 5) * 3600);

    // 7 dias — agrupar por dia
    const porDia: { data: string; segundos: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      const segs = (sessoes7d || []).filter((s: any) => s.data_referencia === ds).reduce((s: number, r: any) => s + (r.duracao_segundos || 0), 0);
      porDia.push({ data: ds, segundos: segs });
    }

    // 30 dias — agrupar por tipo_tarefa
    const porTipo: Record<string, number> = {};
    for (const s of sessoes30d || []) {
      const tk = Array.isArray(s.tarefas_kanban) ? s.tarefas_kanban[0] : s.tarefas_kanban;
      const tipo = (tk as any)?.tipo_tarefa || "Sem tipo";
      porTipo[tipo] = (porTipo[tipo] || 0) + (s.duracao_segundos || 0);
    }

    // Tarefas recentes enriquecidas
    const tarefas = (tarefasRecentes || []).map((t: any) => ({
      id: t.id,
      titulo: t.titulo,
      tipo_tarefa: t.tipo_tarefa || null,
      tempo_total: t.total_segundos + (t.em_andamento && t.ultimo_inicio ? Math.floor((Date.now() - new Date(t.ultimo_inicio).getTime()) / 1000) : 0),
      status: t.status,
      em_andamento: t.em_andamento,
    }));

    return NextResponse.json({
      hoje: {
        segundos: segundosHoje,
        timerExtra,
        timerAtivo: timerAtivo ? { id: timerAtivo.id, titulo: timerAtivo.titulo, ultimo_inicio: timerAtivo.ultimo_inicio } : null,
        metaDiariaSegundos,
      },
      porDia,
      porTipo,
      tarefas,
      tipos: tiposOpcoes || [],
      employee: { nome: employee?.nome, foto_url: employee?.foto_url, meta_horas_semanais: metaSemanais },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
