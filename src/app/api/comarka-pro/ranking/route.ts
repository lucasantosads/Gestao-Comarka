import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, mesRefISO, ultimosNMesesISO, requireSession } from "@/lib/comarka-pro";

export const dynamic = "force-dynamic";

type Periodo = "mensal" | "trimestral" | "semestral" | "anual";

function mesesDoPeriodo(periodo: Periodo, mesBase: string): string[] {
  const base = new Date(mesBase);
  const n = periodo === "mensal" ? 1 : periodo === "trimestral" ? 3 : periodo === "semestral" ? 6 : 12;
  return ultimosNMesesISO(base, n);
}

// GET /api/comarka-pro/ranking?periodo=mensal&mes=YYYY-MM&nivel=todos&publico=false
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const periodo = (sp.get("periodo") || "mensal") as Periodo;
  const mesParam = sp.get("mes");
  const nivel = sp.get("nivel") || "todos";
  const publico = sp.get("publico") === "true";

  if (!publico) {
    const s = await requireSession();
    if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const supa = getSupabaseAdmin();
  const mesBase = mesParam ? `${mesParam}-01` : mesRefISO(new Date());
  const meses = mesesDoPeriodo(periodo, mesBase);

  // employees elegíveis (gestores de tráfego)
  let qE = supa
    .from("employees")
    .select("id, nome, foto_url, cargo, cargo_nivel")
    .eq("ativo", true)
    .eq("is_gestor_trafego", true);
  if (nivel !== "todos") qE = qE.eq("cargo_nivel", nivel);
  const { data: emps, error: errE } = await qE;
  if (errE) return NextResponse.json({ error: errE.message }, { status: 500 });

  // pontos do período
  const { data: pts } = await supa
    .from("comarka_pro_pontos")
    .select("colaborador_id, mes_referencia, pontos_finais, multiplicador_ativo, meses_sequencia")
    .in("mes_referencia", meses);

  // período anterior (para variação)
  const mesBaseDt = new Date(mesBase);
  mesBaseDt.setUTCMonth(mesBaseDt.getUTCMonth() - meses.length);
  const mesesAnteriores = mesesDoPeriodo(periodo, mesRefISO(mesBaseDt));
  const { data: ptsAnt } = await supa
    .from("comarka_pro_pontos")
    .select("colaborador_id, pontos_finais")
    .in("mes_referencia", mesesAnteriores);

  // top categorias do período
  const { data: lancs } = await supa
    .from("comarka_pro_lancamentos")
    .select("colaborador_id, categoria, pontos")
    .in("mes_referencia", meses)
    .is("deleted_at", null);

  const byEmp: Record<string, {
    pontos_finais: number;
    meses_sequencia: number;
    multiplicador_ativo: number;
    mesAtualEncontrado: boolean;
  }> = {};
  for (const p of pts ?? []) {
    const id = p.colaborador_id as string;
    const cur = byEmp[id] ?? { pontos_finais: 0, meses_sequencia: 0, multiplicador_ativo: 1, mesAtualEncontrado: false };
    cur.pontos_finais += Number(p.pontos_finais ?? 0);
    if (p.mes_referencia === meses[meses.length - 1]) {
      cur.meses_sequencia = Number(p.meses_sequencia ?? 0);
      cur.multiplicador_ativo = Number(p.multiplicador_ativo ?? 1);
      cur.mesAtualEncontrado = true;
    }
    byEmp[id] = cur;
  }

  const anteriorPorEmp: Record<string, number> = {};
  for (const p of ptsAnt ?? []) {
    const id = p.colaborador_id as string;
    anteriorPorEmp[id] = (anteriorPorEmp[id] ?? 0) + Number(p.pontos_finais ?? 0);
  }

  const categoriasPorEmp: Record<string, Record<string, number>> = {};
  for (const l of lancs ?? []) {
    const id = l.colaborador_id as string;
    categoriasPorEmp[id] = categoriasPorEmp[id] ?? {};
    categoriasPorEmp[id][l.categoria] = (categoriasPorEmp[id][l.categoria] ?? 0) + Number(l.pontos ?? 0);
  }

  const linhas = (emps ?? []).map((e: any) => {
    const info = byEmp[e.id] ?? { pontos_finais: 0, meses_sequencia: 0, multiplicador_ativo: 1 };
    const topCats = Object.entries(categoriasPorEmp[e.id] ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, pts]) => ({ categoria: cat, pontos: pts }));
    return {
      colaborador_id: e.id,
      nome: e.nome,
      foto_url: e.foto_url,
      cargo_atual: e.cargo,
      cargo_nivel: e.cargo_nivel,
      pontos_finais: info.pontos_finais,
      meses_sequencia: info.meses_sequencia,
      multiplicador_ativo: info.multiplicador_ativo,
      top_categorias: topCats,
      _anterior: anteriorPorEmp[e.id] ?? 0,
    };
  });

  linhas.sort((a, b) => b.pontos_finais - a.pontos_finais);

  // calcular variacao_posicao: comparar posição atual com posição no período anterior
  const anteriorOrdenado = [...linhas].sort((a, b) => b._anterior - a._anterior);
  const posAnterior = new Map(anteriorOrdenado.map((l, i) => [l.colaborador_id, i + 1]));
  const resultado = linhas.map((l, i) => {
    const pa = posAnterior.get(l.colaborador_id) ?? i + 1;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _anterior, ...rest } = l;
    return { posicao: i + 1, variacao_posicao: pa - (i + 1), ...rest };
  });

  return NextResponse.json({ periodo, meses, ranking: resultado });
}
