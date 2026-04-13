import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/portal-admin";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ employee_id: string }> }) {
  const a = await requireAdmin();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  const { employee_id } = await params;
  const { data, error } = await supabaseAdmin
    .from("colaboradores_beneficios")
    .select("*")
    .eq("employee_id", employee_id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ employee_id: string }> }) {
  const a = await requireAdmin();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  const { employee_id } = await params;
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("colaboradores_beneficios")
    .insert({
      employee_id,
      nome: body.nome,
      valor: body.valor != null ? Number(body.valor) : null,
      ativo: body.ativo ?? true,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const a = await requireAdmin();
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const { error } = await supabaseAdmin.from("colaboradores_beneficios").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
