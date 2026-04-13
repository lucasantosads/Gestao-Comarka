import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, requireSession, isAdminOrHead } from "@/lib/comarka-pro";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!(await isAdminOrHead(s))) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const supa = getSupabaseAdmin();
  const { data, error } = await supa.from("comarka_pro_config").select("*").limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {});
}

export async function PUT(req: NextRequest) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!(await isAdminOrHead(s))) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await req.json();
  const supa = getSupabaseAdmin();
  const { data: existing } = await supa.from("comarka_pro_config").select("id").limit(1).maybeSingle();
  const payload = { ...body, atualizado_em: new Date().toISOString() };

  if (existing?.id) {
    const { data, error } = await supa
      .from("comarka_pro_config")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  const { data, error } = await supa.from("comarka_pro_config").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
