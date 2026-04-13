import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin, requireSession } from "@/lib/portal-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requireSession();
  if (s.error) return NextResponse.json({ error: s.error }, { status: s.status });
  const { data, error } = await supabaseAdmin.from("trilha_cargos").select("*").order("nivel", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const a = await requireAdmin();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("trilha_cargos")
    .insert({
      nome: body.nome,
      nivel: Number(body.nivel),
      descricao: body.descricao || null,
      kpis: Array.isArray(body.kpis) ? body.kpis : [],
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
