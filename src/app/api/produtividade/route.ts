import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
);

function isWeekday(d: Date) { const dow = d.getDay(); return dow !== 0 && dow !== 6; }

export async function GET(req: NextRequest) {
  try {
    const periodo = req.nextUrl.searchParams.get("periodo") || "hoje";
    const colaboradorId = req.nextUrl.searchParams.get("colaborador_id");
    const now = new Date();
    const hoje = now.toISOString().split("T")[0];

    // Range de datas
    let desde = hoje;
    let diasPeriodo = 1;
    if (periodo === "semana") {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      desde = d.toISOString().split("T")[0]; diasPeriodo = 7;
    } else if (periodo === "mes") {
      const d = new Date(now); d.setDate(d.getDate() - 29);
      desde = d.toISOString().split("T")[0]; diasPeriodo = 30;
    }

    // Todos colaboradores ativos
    const { data: employees } = await supabase
      .from("employees").select("id, nome, foto_url, meta_horas_semanais, alerta_inatividade_horas, cargo")
      .eq("ativo", true).order("nome");
    const emps = employees || [];

    // Sessões do período
    const sessionsQuery = supabase
      .from("time_sessions")
      .select("colaborador_id, duracao_segundos, data_referencia, tarefa_id, tarefas_kanban(tipo_tarefa)")
      .gte("data_referencia", desde);
    if (colaboradorId) sessionsQuery.eq("colaborador_id", colaboradorId);
    const { data: sessions } = await sessionsQuery;

    // Tarefas com timer ativo (status em tempo real)
    const { data: tarefasAtivas } = await supabase
      .from("tarefas_kanban")
      .select("id, titulo, responsavel_id, em_andamento, ultimo_inicio, tipo_tarefa")
      .eq("em_andamento", true)
      .is("deleted_at", null);

    // Tarefas concluídas no período
    const { data: tarefasConcluidas } = await supabase
      .from("tarefas_kanban")
      .select("id, responsavel_id, tipo_tarefa")
      .eq("status", "concluido")
      .gte("finalizado_em", `${desde}T00:00:00`)
      .is("deleted_at", null);

    // Tipos de tarefa
    const { data: tiposOpcoes } = await supabase
      .from("tipo_tarefa_opcoes").select("id, nome, cor").is("deleted_at", null).order("nome");

    // === VISAO GERAL ===

    // Status em tempo real por colaborador
    const statusRealTime = emps.map((emp) => {
      const tarefaAtiva = (tarefasAtivas || []).find((t) => t.responsavel_id === emp.id);
      return {
        id: emp.id, nome: emp.nome, foto_url: emp.foto_url, cargo: emp.cargo,
        ativo: !!tarefaAtiva,
        tarefa_ativa: tarefaAtiva ? { id: tarefaAtiva.id, titulo: tarefaAtiva.titulo } : null,
      };
    });

    // Horas por colaborador
    const horasPorColab: Record<string, number> = {};
    for (const s of sessions || []) {
      horasPorColab[s.colaborador_id] = (horasPorColab[s.colaborador_id] || 0) + (s.duracao_segundos || 0);
    }
    // Adicionar tempo em andamento dos timers ativos
    for (const t of tarefasAtivas || []) {
      if (t.em_andamento && t.ultimo_inicio && t.responsavel_id) {
        const extra = Math.max(0, Math.floor((Date.now() - new Date(t.ultimo_inicio).getTime()) / 1000));
        horasPorColab[t.responsavel_id] = (horasPorColab[t.responsavel_id] || 0) + extra;
      }
    }

    const totalSegundos = Object.values(horasPorColab).reduce((s, v) => s + v, 0);
    const colabComHoras = Object.keys(horasPorColab).length || 1;
    const mediaSegundos = totalSegundos / Math.max(emps.length, 1);

    const totalConcluidas = (tarefasConcluidas || []).length;

    // Distribuição por tipo
    const porTipo: Record<string, number> = {};
    for (const s of sessions || []) {
      const tk = Array.isArray(s.tarefas_kanban) ? s.tarefas_kanban[0] : s.tarefas_kanban;
      const tipo = (tk as any)?.tipo_tarefa || "Sem tipo";
      porTipo[tipo] = (porTipo[tipo] || 0) + (s.duracao_segundos || 0);
    }

    // Ranking
    const concluidasPorColab: Record<string, number> = {};
    for (const t of tarefasConcluidas || []) {
      if (t.responsavel_id) concluidasPorColab[t.responsavel_id] = (concluidasPorColab[t.responsavel_id] || 0) + 1;
    }

    const ranking = emps.map((emp) => {
      const segs = horasPorColab[emp.id] || 0;
      const metaPeriodo = (emp.meta_horas_semanais || 40) * (diasPeriodo / 7) * 3600;
      const pctMeta = metaPeriodo > 0 ? (segs / metaPeriodo) * 100 : 0;
      return {
        id: emp.id, nome: emp.nome, foto_url: emp.foto_url,
        segundos: segs,
        concluidas: concluidasPorColab[emp.id] || 0,
        pct_meta: Math.round(pctMeta * 10) / 10,
        meta_horas_semanais: emp.meta_horas_semanais || 40,
      };
    }).sort((a, b) => b.segundos - a.segundos);

    // Alertas de inatividade (só dias úteis)
    const alertasInatividade: { id: string; nome: string; horas_sem_sessao: number; threshold: number }[] = [];
    if (isWeekday(now)) {
      for (const emp of emps) {
        const threshold = emp.alerta_inatividade_horas || 2;
        const { data: ultimaSessao } = await supabase
          .from("time_sessions")
          .select("iniciado_em")
          .eq("colaborador_id", emp.id)
          .order("iniciado_em", { ascending: false })
          .limit(1);
        const ultima = ultimaSessao?.[0]?.iniciado_em;
        const horasSem = ultima ? Math.floor((Date.now() - new Date(ultima).getTime()) / 3600000) : 999;
        if (horasSem >= threshold) {
          alertasInatividade.push({ id: emp.id, nome: emp.nome, horas_sem_sessao: horasSem, threshold });
        }
      }
    }

    // === VISAO INDIVIDUAL (se colaborador_id) ===
    let individual = null;
    if (colaboradorId) {
      const emp = emps.find((e) => e.id === colaboradorId);
      if (emp) {
        // Reutilizar /api/meu-tempo
        const d30 = new Date(now); d30.setDate(d30.getDate() - 29);
        const desde30 = d30.toISOString().split("T")[0];

        const [{ data: sessoes30d }, { data: tarefasRecentes }] = await Promise.all([
          supabase.from("time_sessions")
            .select("duracao_segundos, data_referencia, tarefa_id, tarefas_kanban(tipo_tarefa)")
            .eq("colaborador_id", colaboradorId)
            .gte("data_referencia", desde30)
            .order("data_referencia"),
          supabase.from("tarefas_kanban")
            .select("id, titulo, tipo_tarefa, total_segundos, em_andamento, ultimo_inicio, status")
            .eq("responsavel_id", colaboradorId)
            .is("deleted_at", null)
            .order("updated_at", { ascending: false })
            .limit(10),
        ]);

        // 30 dias por dia
        const porDia30: { data: string; segundos: number }[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now); d.setDate(d.getDate() - i);
          const ds = d.toISOString().split("T")[0];
          const segs = (sessoes30d || []).filter((s: any) => s.data_referencia === ds).reduce((s: number, r: any) => s + (r.duracao_segundos || 0), 0);
          porDia30.push({ data: ds, segundos: segs });
        }

        // Comparativo semana atual vs anterior
        const d7 = new Date(now); d7.setDate(d7.getDate() - 6);
        const d14 = new Date(now); d14.setDate(d14.getDate() - 13);
        const semanaAtual = porDia30.filter((d) => d.data >= d7.toISOString().split("T")[0]).reduce((s, d) => s + d.segundos, 0);
        const semanaAnterior = porDia30.filter((d) => d.data >= d14.toISOString().split("T")[0] && d.data < d7.toISOString().split("T")[0]).reduce((s, d) => s + d.segundos, 0);

        // Por tipo 30d
        const porTipoInd: Record<string, number> = {};
        for (const s of sessoes30d || []) {
          const tk = Array.isArray(s.tarefas_kanban) ? s.tarefas_kanban[0] : s.tarefas_kanban;
          const tipo = (tk as any)?.tipo_tarefa || "Sem tipo";
          porTipoInd[tipo] = (porTipoInd[tipo] || 0) + (s.duracao_segundos || 0);
        }

        // Timer ativo
        const timerAtivo = (tarefasRecentes || []).find((t: any) => t.em_andamento && t.ultimo_inicio);

        individual = {
          employee: { nome: emp.nome, foto_url: emp.foto_url, meta_horas_semanais: emp.meta_horas_semanais || 40 },
          porDia30,
          porTipo: porTipoInd,
          semanaAtual,
          semanaAnterior,
          tarefas: (tarefasRecentes || []).map((t: any) => ({
            id: t.id, titulo: t.titulo, tipo_tarefa: t.tipo_tarefa,
            tempo_total: t.total_segundos + (t.em_andamento && t.ultimo_inicio ? Math.floor((Date.now() - new Date(t.ultimo_inicio).getTime()) / 1000) : 0),
            status: t.status, em_andamento: t.em_andamento,
          })),
          timerAtivo: timerAtivo ? { id: timerAtivo.id, titulo: timerAtivo.titulo, ultimo_inicio: timerAtivo.ultimo_inicio } : null,
        };
      }
    }

    return NextResponse.json({
      statusRealTime,
      kpis: { totalSegundos, mediaSegundos, totalConcluidas },
      porTipo,
      ranking,
      alertasInatividade,
      tipos: tiposOpcoes || [],
      individual,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
