/**
 * POST /api/ghl/test-connection   { cliente_id, ghl_subaccount_id }
 * Pinga a GHL Locations API com o token da env e atualiza last_test_* em clientes_crm_config.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function POST(req: NextRequest) {
  const { cliente_id, ghl_subaccount_id } = await req.json();
  if (!ghl_subaccount_id) return NextResponse.json({ ok: false, error: "ghl_subaccount_id obrigatório" }, { status: 400 });

  const token = process.env.GHL_API_KEY;
  if (!token) return NextResponse.json({ ok: false, error: "GHL_API_KEY não configurado" }, { status: 500 });

  let ok = false;
  let status = 0;
  let message = "";
  try {
    const res = await fetch(`https://services.leadconnectorhq.com/locations/${ghl_subaccount_id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: "2021-07-28",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    status = res.status;
    ok = res.ok;
    if (!ok) {
      const txt = await res.text();
      message = txt.slice(0, 200);
    } else {
      const j = await res.json().catch(() => ({}));
      message = (j as { location?: { name?: string } }).location?.name || "ok";
    }
  } catch (e) {
    message = String(e);
  }

  // Persiste resultado se vier cliente_id
  if (cliente_id) {
    await supabase.from("clientes_crm_config").upsert({
      cliente_id,
      ghl_subaccount_id,
      conexao_ativa: ok,
      last_test_at: new Date().toISOString(),
      last_test_result: ok ? "ok" : "erro",
      updated_at: new Date().toISOString(),
    }, { onConflict: "cliente_id" });
  }

  return NextResponse.json({ ok, status, message });
}
