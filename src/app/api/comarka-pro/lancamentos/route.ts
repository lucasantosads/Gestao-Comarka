import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, requireSession, isAdminOrHead, recalcularPontosMes, mesRefISO } from "@/lib/comarka-pro";
import { PONTOS_CATEGORIA, ComarkaProCategoria } from "@/lib/comarka-pro-config";

export const dynamic = "force-dynamic";

// GET /api/comarka-pro/lancamentos?mes=YYYY-MM-DD&colaborador_id=&categoria=&origem=manual
// Admin/head veem todos; colaborador só os seus.
export async function GET(req: NextRequest) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const admin = await isAdminOrHead(s);
  const sp = req.nextUrl.searchParams;
  const supa = getSupabaseAdmin();

  let q = supa
    .from("comarka_pro_lancamentos")
    .select("*")
    .is("deleted_at", null)
    .order("criado_em", { ascending: false });
  if (!admin) q = q.eq("colaborador_id", s.employeeId);
  if (sp.get("mes")) q = q.eq("mes_referencia", mesRefISO(sp.get("mes")!));
  if (sp.get("colaborador_id")) q = q.eq("colaborador_id", sp.get("colaborador_id")!);
  if (sp.get("categoria")) q = q.eq("categoria", sp.get("categoria")!);
  if (sp.get("origem")) q = q.eq("origem", sp.get("origem")!);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/comarka-pro/lancamentos — só Lucas + Head
export async function POST(req: NextRequest) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!(await isAdminOrHead(s))) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json();
  const { colaborador_id, categoria, pontos, descricao, mes_referencia, cliente_id } = body as {
    colaborador_id: string;
    categoria: ComarkaProCategoria;
    pontos?: number;
    descricao?: string;
    mes_referencia: string;
    cliente_id?: string | null;
  };

  if (!colaborador_id || !categoria || !mes_referencia) {
    return NextResponse.json({ error: "colaborador_id, categoria, mes_referencia obrigatórios" }, { status: 400 });
  }
  const info = PONTOS_CATEGORIA[categoria];
  if (!info) return NextResponse.json({ error: "categoria inválida" }, { status: 400 });
  const pts = typeof pontos === "number" ? pontos : info.pts;
  const mesISO = mesRefISO(mes_referencia);

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("comarka_pro_lancamentos")
    .insert({
      colaborador_id,
      categoria,
      pontos: pts,
      descricao: descricao ?? info.descricao,
      origem: "manual",
      mes_referencia: mesISO,
      cliente_id: cliente_id ?? null,
      aprovado_por: s.employeeId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recalcularPontosMes(colaborador_id, mesISO);
  return NextResponse.json(data);
}
