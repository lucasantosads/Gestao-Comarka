import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, requireSession, isAdminOrHead, recalcularPontosMes } from "@/lib/comarka-pro";
import { PONTOS_CATEGORIA } from "@/lib/comarka-pro-config";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!(await isAdminOrHead(s))) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { status } = await req.json();
  if (!["aprovado", "reprovado"].includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data: fb, error } = await supa
    .from("comarka_pro_feedbacks")
    .update({ status, aprovado_por: s.employeeId, aprovado_em: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status === "aprovado") {
    await supa.from("comarka_pro_lancamentos").insert({
      colaborador_id: fb.colaborador_id,
      mes_referencia: fb.mes_referencia,
      categoria: "feedback_cliente",
      pontos: PONTOS_CATEGORIA.feedback_cliente.pts,
      descricao: `Feedback positivo de cliente`,
      origem: "manual",
      referencia_id: fb.id,
      aprovado_por: s.employeeId,
      cliente_id: fb.cliente_id,
    });
    await recalcularPontosMes(fb.colaborador_id, fb.mes_referencia);
  }
  return NextResponse.json(fb);
}
