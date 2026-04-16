/**
 * GET/PATCH /api/trafego/anomalias
 * Lista e resolve anomalias de tráfego.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const resolvida = searchParams.get("resolvida");
  const ad_id = searchParams.get("ad_id");
  const cliente_id = searchParams.get("cliente_id");

  let query = supabase
    .from("trafego_anomalias")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(200);

  if (resolvida !== null) query = query.eq("resolvida", resolvida === "true");
  if (ad_id) query = query.eq("ad_id", ad_id);
  if (cliente_id) query = query.eq("cliente_id", cliente_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function PATCH(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { error } = await supabase
    .from("trafego_anomalias")
    .update({ resolvida: true, resolvida_em: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
