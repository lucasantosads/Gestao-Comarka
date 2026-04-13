/**
 * GET /api/employees/[id]/folha
 * Retorna a entrada atual em custos_fixos_recorrentes tipo='folha'
 * vinculada ao employee. Admin-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { data, error } = await supabase
    .from("custos_fixos_recorrentes")
    .select("id, nome, cargo, valor, dia_vencimento, ativo")
    .eq("employee_id", params.id)
    .eq("tipo", "folha")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || null);
}
