/**
 * GET  /api/clientes/crm-config?cliente_id=<notion_id>
 * PUT  /api/clientes/crm-config            { cliente_id, ghl_subaccount_id, ghl_pipeline_id, stage_mapping }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function GET(req: NextRequest) {
  const clienteId = req.nextUrl.searchParams.get("cliente_id");
  if (!clienteId) return NextResponse.json({ error: "cliente_id obrigatório" }, { status: 400 });
  const { data, error } = await supabase
    .from("clientes_crm_config")
    .select("*")
    .eq("cliente_id", clienteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || null);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { cliente_id, ghl_subaccount_id, ghl_pipeline_id, stage_mapping } = body;
  if (!cliente_id) return NextResponse.json({ error: "cliente_id obrigatório" }, { status: 400 });
  const { data, error } = await supabase
    .from("clientes_crm_config")
    .upsert({
      cliente_id,
      ghl_subaccount_id: ghl_subaccount_id || null,
      ghl_pipeline_id: ghl_pipeline_id || null,
      stage_mapping: stage_mapping || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: "cliente_id" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
