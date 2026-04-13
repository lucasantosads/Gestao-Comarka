/**
 * POST /api/sistema/rate-limits
 * Protegido por CRON_SECRET. Vercel Cron a cada hora.
 *
 * Monitora chamadas da Meta Ads API na última hora,
 * calcula pct_utilizado e alerta se > 80%.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppText } from "@/lib/evolution";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LIMITE_HORA_META = 200; // limite padrão Meta Ads API

export async function POST(req: NextRequest) {
  // Validar CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const umaHoraAtras = new Date(now.getTime() - 3600000);
  const adminPhone = process.env.ADMIN_WHATSAPP || "";

  // Contar chamadas da última hora para Meta Ads
  const { data: logs } = await supabase
    .from("sistema_rate_limit_log")
    .select("chamadas_hora")
    .eq("servico", "meta_ads")
    .gte("data_hora", umaHoraAtras.toISOString())
    .lte("data_hora", now.toISOString());

  const totalChamadas = (logs || []).reduce((sum, l) => sum + (l.chamadas_hora || 0), 0);
  const pctUtilizado = (totalChamadas / LIMITE_HORA_META) * 100;

  // Upsert totais da hora atual
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);

  const { data: existing } = await supabase
    .from("sistema_rate_limit_log")
    .select("id")
    .eq("servico", "meta_ads")
    .gte("data_hora", hourStart.toISOString())
    .lt("data_hora", new Date(hourStart.getTime() + 3600000).toISOString())
    .limit(1)
    .single();

  if (existing) {
    await supabase
      .from("sistema_rate_limit_log")
      .update({
        chamadas_hora: totalChamadas,
        limite_hora: LIMITE_HORA_META,
        pct_utilizado: pctUtilizado,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("sistema_rate_limit_log").insert({
      servico: "meta_ads",
      endpoint: "hourly_summary",
      chamadas_hora: totalChamadas,
      limite_hora: LIMITE_HORA_META,
      pct_utilizado: pctUtilizado,
      data_hora: now.toISOString(),
    });
  }

  // Alertas baseados no percentual
  if (pctUtilizado > 80) {
    // Inserir alerta em alertas_snooze
    await supabase.from("alertas_snooze").insert({
      ad_id: "sistema",
      tipo: "rate_limit_alto",
      snooze_ate: new Date(now.getTime() + 3600000).toISOString(), // snooze 1h
    });
  }

  if (pctUtilizado > 95 && adminPhone) {
    await sendWhatsAppText(
      adminPhone,
      `\u26A0\uFE0F *Rate Limit Crítico — Meta Ads*\n${totalChamadas}/${LIMITE_HORA_META} chamadas/hora (${pctUtilizado.toFixed(0)}%)\nReduzir chamadas imediatamente!`
    );
  }

  return NextResponse.json({
    ok: true,
    meta_ads: {
      chamadas_hora: totalChamadas,
      limite_hora: LIMITE_HORA_META,
      pct_utilizado: Math.round(pctUtilizado * 100) / 100,
      alerta: pctUtilizado > 80,
      critico: pctUtilizado > 95,
    },
  });
}
