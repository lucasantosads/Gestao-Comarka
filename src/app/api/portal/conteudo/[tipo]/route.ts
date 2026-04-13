import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin, requireSession } from "@/lib/portal-admin";

export const dynamic = "force-dynamic";

const TIPOS = ["cultura", "regras"] as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!TIPOS.includes(tipo as (typeof TIPOS)[number])) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  const s = await requireSession();
  if (s.error) return NextResponse.json({ error: s.error }, { status: s.status });

  const { data, error } = await supabaseAdmin.from("portal_conteudo").select("*").eq("tipo", tipo).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || { tipo, conteudo: "", atualizado_em: null, atualizado_por: null });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!TIPOS.includes(tipo as (typeof TIPOS)[number])) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  const a = await requireAdmin();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });

  const body = await req.json();
  const conteudo = String(body.conteudo ?? "");

  const { data, error } = await supabaseAdmin
    .from("portal_conteudo")
    .upsert({ tipo, conteudo, atualizado_por: a.session!.employeeId, atualizado_em: new Date().toISOString() }, { onConflict: "tipo" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
