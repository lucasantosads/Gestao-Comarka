import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, requireSession, isAdminOrHead, mesRefISO } from "@/lib/comarka-pro";

export const dynamic = "force-dynamic";

// GET /api/comarka-pro/roteiros?pendentes=1&colaborador_id=
// Admin/head veem todos (por padrão só pendentes); colaborador vê só os seus.
export async function GET(req: NextRequest) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const admin = await isAdminOrHead(s);
  const sp = req.nextUrl.searchParams;
  const supa = getSupabaseAdmin();

  let q = supa
    .from("comarka_pro_roteiros")
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

// POST /api/comarka-pro/roteiros — colaborador autenticado
export async function POST(req: NextRequest) {
  const s = await requireSession();
  if (!s || !s.employeeId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  const { titulo, cliente_id, mes_referencia } = body as {
    titulo: string;
    cliente_id?: string | null;
    mes_referencia?: string;
  };
  if (!titulo) return NextResponse.json({ error: "titulo obrigatório" }, { status: 400 });

  const mesISO = mes_referencia ? mesRefISO(mes_referencia) : mesRefISO(new Date());
  const supa = getSupabaseAdmin();

  // tentar match exato (case-insensitive) em ads_metadata
  const { data: ads } = await supa
    .from("ads_metadata")
    .select("ad_id, ad_name")
    .ilike("ad_name", titulo)
    .limit(1);

  let ad_id: string | null = null;
  let ad_match_status: "encontrado" | "nao_encontrado" = "nao_encontrado";
  let metricas_snapshot: any = null;

  if (ads && ads.length > 0) {
    ad_id = ads[0].ad_id;
    ad_match_status = "encontrado";
    // buscar últimas métricas em ads_performance (se existir)
    try {
      const { data: perf } = await supa
        .from("ads_performance")
        .select("spend, impressions, leads, cpl, ctr, date")
        .eq("ad_id", ad_id)
        .order("date", { ascending: false })
        .limit(30);
      if (perf && perf.length > 0) {
        const tot = perf.reduce(
          (acc: any, r: any) => ({
            spend: acc.spend + Number(r.spend ?? 0),
            impressoes: acc.impressoes + Number(r.impressions ?? 0),
            leads: acc.leads + Number(r.leads ?? 0),
          }),
          { spend: 0, impressoes: 0, leads: 0 },
        );
        metricas_snapshot = {
          cpl: tot.leads > 0 ? tot.spend / tot.leads : null,
          leads: tot.leads,
          ctr: null,
          spend: tot.spend,
          impressoes: tot.impressoes,
          data_snapshot: new Date().toISOString(),
        };
      }
    } catch (e: any) {
      console.warn("[comarka-pro] ads_performance snapshot falhou:", e?.message);
    }
  }

  const { data, error } = await supa
    .from("comarka_pro_roteiros")
    .insert({
      colaborador_id: s.employeeId,
      titulo,
      ad_id,
      ad_match_status,
      metricas_snapshot,
      status: "pendente",
      cliente_id: cliente_id ?? null,
      mes_referencia: mesISO,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ...data,
    _aviso:
      ad_match_status === "nao_encontrado"
        ? "Nenhum anúncio encontrado com esse título — verifique o nome exato no Meta Ads."
        : null,
  });
}
