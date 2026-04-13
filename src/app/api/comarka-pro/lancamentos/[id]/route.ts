import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, requireSession, isAdminOrHead, recalcularPontosMes } from "@/lib/comarka-pro";

export const dynamic = "force-dynamic";

// DELETE /api/comarka-pro/lancamentos/[id] — soft delete
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!(await isAdminOrHead(s))) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("comarka_pro_lancamentos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("colaborador_id, mes_referencia")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recalcularPontosMes(data.colaborador_id, data.mes_referencia);
  return NextResponse.json({ ok: true });
}
