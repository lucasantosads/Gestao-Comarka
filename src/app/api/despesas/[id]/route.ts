import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabase
    .from("despesas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const allowed = ["data_lancamento", "descricao", "categoria", "conta", "valor", "tipo", "parcela_atual", "parcelas_total"];
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k];
  if (!Object.keys(update).length) return NextResponse.json({ error: "nada para atualizar" }, { status: 400 });
  // se mudou data, recalcular mes_referencia
  if (update.data_lancamento) update.mes_referencia = String(update.data_lancamento).slice(0, 7);
  const { data, error } = await supabase.from("despesas").update(update).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
