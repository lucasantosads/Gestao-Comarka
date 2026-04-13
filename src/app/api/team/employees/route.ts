import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/team/employees
 * Lista enxuta de employees ativos para dropdowns (id + nome).
 * Usado pelo filtro de gestor em /dashboard/clientes/performance.
 */
export async function GET() {
  const { data, error } = await supabase
    .from("employees")
    .select("id, nome, role")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ employees: data || [] });
}
