import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const notionId = params.id;
  const [{ data: extra }, { data: otimizacoes }] = await Promise.all([
    supabase.from("clientes_extra").select("*").eq("notion_id", notionId).maybeSingle(),
    supabase.from("otimizacoes_historico").select("*").eq("notion_id", notionId).is("deleted_at", null).order("data", { ascending: false }),
  ]);
  return NextResponse.json({ extra: extra || null, otimizacoes: otimizacoes || [] });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const notionId = params.id;
  const body = await req.json();
  body.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("clientes_extra")
    .upsert({ notion_id: notionId, ...body }, { onConflict: "notion_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
