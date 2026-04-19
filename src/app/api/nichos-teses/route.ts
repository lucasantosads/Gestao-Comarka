import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
);

// GET — lista nichos com suas teses, ou vínculos de um cliente
export async function GET(req: NextRequest) {
  const clienteId = req.nextUrl.searchParams.get("cliente_id");

  if (clienteId) {
    // Retorna vínculos do cliente
    const { data, error } = await supabase
      .from("clientes_nichos_teses")
      .select("id, cliente_id, nicho_id, tese_id, nichos(id, nome), teses(id, nome)")
      .eq("cliente_id", clienteId)
      .is("deleted_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ vinculos: data || [] });
  }

  // Lista todos os nichos com teses
  const [{ data: nichos, error: e1 }, { data: teses, error: e2 }] = await Promise.all([
    supabase.from("nichos").select("*").is("deleted_at", null).order("nome"),
    supabase.from("teses").select("*").is("deleted_at", null).order("nome"),
  ]);
  if (e1 || e2) return NextResponse.json({ error: (e1 || e2)!.message }, { status: 500 });

  return NextResponse.json({ nichos: nichos || [], teses: teses || [] });
}

// POST — criar nicho, tese ou vínculo cliente
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "criar_nicho") {
    const nome = (body.nome || "").trim();
    if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    const { data, error } = await supabase.from("nichos").insert({ nome }).select().single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Nicho já existe" }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  if (action === "criar_tese") {
    const nome = (body.nome || "").trim();
    const nichoId = body.nicho_id;
    if (!nome || !nichoId) return NextResponse.json({ error: "nome e nicho_id obrigatórios" }, { status: 400 });
    const { data, error } = await supabase.from("teses").insert({ nome, nicho_id: nichoId }).select().single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Tese já existe neste nicho" }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  if (action === "vincular_cliente") {
    const { cliente_id, nicho_id, tese_id } = body;
    if (!cliente_id || !nicho_id || !tese_id) return NextResponse.json({ error: "cliente_id, nicho_id e tese_id obrigatórios" }, { status: 400 });
    const { data, error } = await supabase.from("clientes_nichos_teses").insert({ cliente_id, nicho_id, tese_id }).select().single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Vínculo já existe" }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "action inválida" }, { status: 400 });
}

// DELETE — soft delete de nicho, tese ou vínculo
export async function DELETE(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");
  const id = req.nextUrl.searchParams.get("id");
  if (!action || !id) return NextResponse.json({ error: "action e id obrigatórios" }, { status: 400 });

  const now = new Date().toISOString();
  const table = action === "nicho" ? "nichos" : action === "tese" ? "teses" : action === "vinculo" ? "clientes_nichos_teses" : null;
  if (!table) return NextResponse.json({ error: "action inválida (nicho, tese, vinculo)" }, { status: 400 });

  const { error } = await supabase.from(table).update({ deleted_at: now }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ao soft-deletar nicho, soft-deletar teses filhas também
  if (action === "nicho") {
    await supabase.from("teses").update({ deleted_at: now }).eq("nicho_id", id).is("deleted_at", null);
    await supabase.from("clientes_nichos_teses").update({ deleted_at: now }).eq("nicho_id", id).is("deleted_at", null);
  }
  // Ao soft-deletar tese, soft-deletar vínculos
  if (action === "tese") {
    await supabase.from("clientes_nichos_teses").update({ deleted_at: now }).eq("tese_id", id).is("deleted_at", null);
  }

  return NextResponse.json({ success: true });
}
