/**
 * PATCH /api/clientes/obs-contrato
 * Atualiza obs_contrato de um cliente na tabela clientes.
 * Body: { cliente_id, obs_contrato }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest) {
  try {
    const { cliente_id, obs_contrato } = await req.json();
    if (!cliente_id) return NextResponse.json({ error: "cliente_id obrigatório" }, { status: 400 });

    const { error } = await supabase
      .from("clientes")
      .update({
        obs_contrato: obs_contrato || null,
        obs_contrato_atualizada_em: new Date().toISOString(),
      })
      .eq("id", cliente_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
