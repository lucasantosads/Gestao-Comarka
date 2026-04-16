/**
 * GET /api/clientes/status-historico?cliente_id=xxx
 * Retorna histórico de mudanças de status de um cliente.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 0;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

export async function GET(req: NextRequest) {
  try {
    const clienteId = req.nextUrl.searchParams.get("cliente_id");
    if (!clienteId) return NextResponse.json({ error: "cliente_id obrigatório" }, { status: 400 });

    const { data, error } = await supabase
      .from("clientes_status_historico")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("criado_em", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ historico: data || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
