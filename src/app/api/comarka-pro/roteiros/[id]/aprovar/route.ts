import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, requireSession, isAdminOrHead, recalcularPontosMes } from "@/lib/comarka-pro";
import { PONTOS_CATEGORIA } from "@/lib/comarka-pro-config";

export const dynamic = "force-dynamic";

// PATCH /api/comarka-pro/roteiros/[id]/aprovar
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!(await isAdminOrHead(s))) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { status, observacao_aprovador } = await req.json();
  if (!["aprovado", "reprovado"].includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data: roteiro, error: errU } = await supa
    .from("comarka_pro_roteiros")
    .update({
      status,
      observacao_aprovador: observacao_aprovador ?? null,
      aprovado_por: s.employeeId,
      aprovado_em: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single();
  if (errU) return NextResponse.json({ error: errU.message }, { status: 500 });

  if (status === "aprovado") {
    await supa.from("comarka_pro_lancamentos").insert({
      colaborador_id: roteiro.colaborador_id,
      mes_referencia: roteiro.mes_referencia,
      categoria: "roteiro",
      pontos: PONTOS_CATEGORIA.roteiro.pts,
      descricao: `Roteiro aprovado: ${roteiro.titulo}`,
      origem: "manual",
      referencia_id: roteiro.id,
      aprovado_por: s.employeeId,
      cliente_id: roteiro.cliente_id,
    });
    await recalcularPontosMes(roteiro.colaborador_id, roteiro.mes_referencia);
  }
  return NextResponse.json(roteiro);
}
