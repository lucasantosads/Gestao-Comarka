import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/portal-admin";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (body.nome !== undefined) patch.nome = body.nome;
  if (body.nivel !== undefined) patch.nivel = Number(body.nivel);
  if (body.descricao !== undefined) patch.descricao = body.descricao;
  if (body.kpis !== undefined) patch.kpis = Array.isArray(body.kpis) ? body.kpis : [];
  const { data, error } = await supabaseAdmin.from("trilha_cargos").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const { error } = await supabaseAdmin.from("trilha_cargos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
