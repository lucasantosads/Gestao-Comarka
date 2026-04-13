/**
 * POST /api/meta/pausar
 * Somente admin. Pausa anúncio/conjunto/campanha via Meta API.
 * Aceita: { tipo: 'ad' | 'adset' | 'campaign', objeto_id, cliente_id }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession, isSuperAdmin } from "@/lib/session";
import { sendWhatsAppText } from "@/lib/evolution";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const META_BASE = "https://graph.facebook.com/v21.0";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && !isSuperAdmin(session))) {
    return NextResponse.json({ error: "Somente admin pode pausar via API" }, { status: 403 });
  }

  try {
    const { tipo, objeto_id, cliente_id } = await req.json();

    if (!tipo || !objeto_id) {
      return NextResponse.json({ error: "tipo e objeto_id obrigatórios" }, { status: 400 });
    }
    if (!["ad", "adset", "campaign"].includes(tipo)) {
      return NextResponse.json({ error: "tipo deve ser ad, adset ou campaign" }, { status: 400 });
    }

    const token = process.env.META_ADS_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "META_ADS_ACCESS_TOKEN não configurado" }, { status: 500 });
    }

    // Chamar Meta API para pausar
    const res = await fetch(`${META_BASE}/${objeto_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAUSED", access_token: token }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errMsg = errBody?.error?.message || `Meta API ${res.status}`;
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    // Atualizar ads_metadata
    if (tipo === "ad") {
      await supabase.from("ads_metadata").update({ status: "PAUSED" }).eq("ad_id", objeto_id);
    } else if (tipo === "adset") {
      await supabase.from("ads_metadata").update({ status: "ADSET_PAUSED" }).eq("adset_id", objeto_id);
    } else if (tipo === "campaign") {
      await supabase.from("ads_metadata").update({ status: "CAMPAIGN_PAUSED" }).eq("campaign_id", objeto_id);
    }

    // Registrar em histórico
    await supabase.from("trafego_regras_historico").insert({
      ad_id: tipo === "ad" ? objeto_id : null,
      adset_id: tipo === "adset" ? objeto_id : null,
      campaign_id: tipo === "campaign" ? objeto_id : null,
      cliente_id: cliente_id || null,
      acao: "aplicada",
      valor_metrica_no_momento: 0,
      aplicada_por: null,
      observacao: `Pausado manualmente via dashboard por ${session.nome}`,
    });

    // Buscar telefone do admin para confirmação WhatsApp
    const { data: emp } = await supabase
      .from("employees")
      .select("telefone")
      .eq("id", session.employeeId)
      .single();

    const tipoLabel = tipo === "ad" ? "Anúncio" : tipo === "adset" ? "Conjunto" : "Campanha";
    const msg = `${tipoLabel} ${objeto_id} pausado com sucesso via dashboard.`;

    if (emp?.telefone) {
      await sendWhatsAppText(emp.telefone, msg);
    }

    return NextResponse.json({ success: true, message: msg });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
