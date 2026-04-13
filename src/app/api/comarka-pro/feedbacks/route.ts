import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, requireSession, isAdminOrHead, mesRefISO, inicioSemanaISO } from "@/lib/comarka-pro";

export const dynamic = "force-dynamic";

// GET /api/comarka-pro/feedbacks?pendentes=1&colaborador_id=
export async function GET(req: NextRequest) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const admin = await isAdminOrHead(s);
  const sp = req.nextUrl.searchParams;
  const supa = getSupabaseAdmin();

  let q = supa
    .from("comarka_pro_feedbacks")
    .select("*")
    .is("deleted_at", null)
    .order("criado_em", { ascending: false });
  if (!admin) q = q.eq("colaborador_id", s.employeeId);
  if (sp.get("pendentes") === "1") q = q.eq("status", "pendente");
  if (sp.get("colaborador_id")) q = q.eq("colaborador_id", sp.get("colaborador_id")!);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/comarka-pro/feedbacks — colaborador autenticado
export async function POST(req: NextRequest) {
  const s = await requireSession();
  if (!s || !s.employeeId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { cliente_id, descricao, evidencia_url, mes_referencia } = await req.json();
  if (!cliente_id || !descricao) {
    return NextResponse.json({ error: "cliente_id e descricao obrigatórios" }, { status: 400 });
  }
  const mesISO = mes_referencia ? mesRefISO(mes_referencia) : mesRefISO(new Date());

  const supa = getSupabaseAdmin();

  // limite: 1 feedback por cliente por semana
  const semanaInicio = inicioSemanaISO(new Date());
  const { count } = await supa
    .from("comarka_pro_feedbacks")
    .select("id", { count: "exact", head: true })
    .eq("colaborador_id", s.employeeId)
    .eq("cliente_id", cliente_id)
    .is("deleted_at", null)
    .gte("criado_em", semanaInicio);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Você já registrou um feedback deste cliente nesta semana" },
      { status: 409 },
    );
  }

  const { data, error } = await supa
    .from("comarka_pro_feedbacks")
    .insert({
      colaborador_id: s.employeeId,
      cliente_id,
      descricao,
      evidencia_url: evidencia_url ?? null,
      mes_referencia: mesISO,
      status: "pendente",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
