import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  validarCronSecret,
  mesRefISO,
  mesAnteriorISO,
  ultimosNMesesISO,
  recalcularPontosMes,
} from "@/lib/comarka-pro";

export const dynamic = "force-dynamic";

// POST /api/comarka-pro/encerrar-mes — roda dia 1 às 05h.
export async function POST(req: NextRequest) {
  if (!validarCronSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supa = getSupabaseAdmin();
  const hoje = new Date();
  const mesAtualISO = mesRefISO(hoje);
  const mesEncerradoISO = mesAnteriorISO(hoje);

  const { data: gestores } = await supa
    .from("employees")
    .select("id, nome")
    .eq("ativo", true)
    .eq("is_gestor_trafego", true);

  const relatorio: any[] = [];

  for (const g of gestores ?? []) {
    const colaborador_id = g.id as string;

    // pontos do mês encerrado
    const { data: pMes } = await supa
      .from("comarka_pro_pontos")
      .select("pontos_finais, meses_sequencia")
      .eq("colaborador_id", colaborador_id)
      .eq("mes_referencia", mesEncerradoISO)
      .maybeSingle();
    const pontosMes = Number(pMes?.pontos_finais ?? 0);
    const seqAtual = Number(pMes?.meses_sequencia ?? 0);

    // média dos últimos 3 meses (incluindo o encerrado) para base
    const ultimos3 = ultimosNMesesISO(hoje, 4).slice(0, 3); // 3 meses antes do atual
    const { data: hist } = await supa
      .from("comarka_pro_pontos")
      .select("mes_referencia, pontos_finais")
      .eq("colaborador_id", colaborador_id)
      .in("mes_referencia", ultimos3);
    const valores = (hist ?? []).map((h: any) => Number(h.pontos_finais ?? 0));
    const media = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;

    const bateuMeta = pontosMes >= media;
    const novaSeq = bateuMeta ? seqAtual + 1 : 0;

    // upsert no mês novo com meses_sequencia atualizado
    await supa
      .from("comarka_pro_pontos")
      .upsert(
        {
          colaborador_id,
          mes_referencia: mesAtualISO,
          meses_sequencia: novaSeq,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "colaborador_id,mes_referencia" },
      );

    // recalcular (ajusta multiplicador com base em novaSeq)
    await recalcularPontosMes(colaborador_id, hoje);

    // notificação interna (usa tabela existente `notifications` se houver)
    try {
      await supa.from("notifications").insert({
        employee_id: colaborador_id,
        tipo: "comarka_pro",
        titulo: "Resumo do mês — Comarka Pro",
        mensagem: `Você fechou o mês com ${pontosMes} pts. ${bateuMeta ? `Sequência: ${novaSeq} mês(es).` : "Sequência reiniciada."}`,
        lida: false,
      });
    } catch {
      // tabela pode ter outro schema — ignorar silenciosamente
    }

    relatorio.push({ colaborador_id, nome: g.nome, pontosMes, media, bateuMeta, novaSeq });
  }

  return NextResponse.json({ ok: true, relatorio });
}
