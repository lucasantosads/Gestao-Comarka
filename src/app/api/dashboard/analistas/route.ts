/**
 * GET /api/dashboard/analistas
 * Lista nomes dos membros do time Operacional (Head / Pleno / Junior / Tráfego / Desenvolvimento / Diretor)
 * lidos do team_notion_mirror (fonte local, sem Notion).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 300;

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

function isOperacional(cargo: string | null): boolean {
  const c = (cargo || "").toLowerCase();
  return c.includes("diretor") || c.includes("ceo")
    || c.includes("head") || c.includes("pleno") || c.includes("junior")
    || c.includes("trafego") || c.includes("tráfego") || c.includes("desenvolv");
}

export async function GET() {
  const { data, error } = await supabase
    .from("team_notion_mirror")
    .select("notion_id, nome, cargo")
    .order("nome");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const operacionais = (data || [])
    .filter((m) => isOperacional(m.cargo))
    .map((m) => ({ id: m.notion_id, nome: m.nome, cargo: m.cargo }));

  return NextResponse.json(operacionais);
}
