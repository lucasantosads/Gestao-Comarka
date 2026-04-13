import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  requireSession,
  mesRefISO,
  ultimosNMesesISO,
  diasUteisNoMes,
  inicioSemanaISO,
} from "@/lib/comarka-pro";

export const dynamic = "force-dynamic";

// GET /api/comarka-pro/meus-pontos
export async function GET() {
  const s = await requireSession();
  if (!s || !s.employeeId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const colaborador_id = s.employeeId;
  const supa = getSupabaseAdmin();
  const hoje = new Date();
  const mesISO = mesRefISO(hoje);
  const historico12 = ultimosNMesesISO(hoje, 12);

  const { data: ptsMes } = await supa
    .from("comarka_pro_pontos")
    .select("pontos_finais, pontos_brutos, multiplicador_ativo, meses_sequencia")
    .eq("colaborador_id", colaborador_id)
    .eq("mes_referencia", mesISO)
    .maybeSingle();

  const { data: ptsHist } = await supa
    .from("comarka_pro_pontos")
    .select("mes_referencia, pontos_finais, multiplicador_ativo")
    .eq("colaborador_id", colaborador_id)
    .in("mes_referencia", historico12)
    .order("mes_referencia", { ascending: true });

  const { data: lancamentos } = await supa
    .from("comarka_pro_lancamentos")
    .select("id, categoria, pontos, descricao, origem, criado_em, aprovado_por, cliente_id")
    .eq("colaborador_id", colaborador_id)
    .eq("mes_referencia", mesISO)
    .is("deleted_at", null)
    .order("criado_em", { ascending: false });

  // metas automáticas
  // cronômetro
  const { data: logs } = await supa
    .from("kanban_cronometro_log")
    .select("data")
    .eq("colaborador_id", colaborador_id)
    .gte("data", mesISO);
  const diasDistintos = new Set((logs ?? []).map((l: any) => l.data)).size;
  const diasUteis = diasUteisNoMes(hoje);
  const cronometroPct = diasUteis > 0 ? diasDistintos / diasUteis : 0;

  // posição nos 4 rankings — reuso: chamar função? Simplesmente consulta agregada.
  async function posicao(meses: string[]): Promise<number | null> {
    const { data } = await supa
      .from("comarka_pro_pontos")
      .select("colaborador_id, pontos_finais")
      .in("mes_referencia", meses);
    const agg: Record<string, number> = {};
    for (const p of data ?? []) {
      const id = p.colaborador_id as string;
      agg[id] = (agg[id] ?? 0) + Number(p.pontos_finais ?? 0);
    }
    const ordenado = Object.entries(agg).sort((a, b) => b[1] - a[1]);
    const idx = ordenado.findIndex(([id]) => id === colaborador_id);
    return idx === -1 ? null : idx + 1;
  }

  const posMensal = await posicao(ultimosNMesesISO(hoje, 1));
  const posTrimestral = await posicao(ultimosNMesesISO(hoje, 3));
  const posSemestral = await posicao(ultimosNMesesISO(hoje, 6));
  const posAnual = await posicao(ultimosNMesesISO(hoje, 12));

  return NextResponse.json({
    mes_referencia: mesISO,
    pontos_mes: ptsMes?.pontos_finais ?? 0,
    pontos_brutos: ptsMes?.pontos_brutos ?? 0,
    multiplicador_ativo: ptsMes?.multiplicador_ativo ?? 1.0,
    meses_sequencia: ptsMes?.meses_sequencia ?? 0,
    historico: ptsHist ?? [],
    lancamentos: lancamentos ?? [],
    posicoes: {
      mensal: posMensal,
      trimestral: posTrimestral,
      semestral: posSemestral,
      anual: posAnual,
    },
    metas_automaticas: {
      cronometro_pct: cronometroPct,
      cronometro_dias: diasDistintos,
      cronometro_dias_uteis: diasUteis,
      semana_atual_inicio: inicioSemanaISO(hoje),
    },
  });
}
