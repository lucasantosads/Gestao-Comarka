/**
 * POST /api/projecoes/registrar-acuracia
 * Protegido por CRON_SECRET. Vercel Cron: todo dia 1 às 04h.
 *
 * Compara projeção base do mês anterior com realizados.
 * Upsert em projecoes_historico_acuracia.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

export async function POST(req: NextRequest) {
  // Validar CRON_SECRET
  const authHeader = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Mês anterior
    const now = new Date();
    const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const mesRef = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, "0")}`;
    const mesRefDate = `${mesRef}-01`;

    // Buscar projeção base
    const { data: projecaoBase } = await supabase
      .from("projecoes_cenarios")
      .select("mrr_projetado,contratos_projetados,leads_projetados")
      .eq("mes_referencia", mesRefDate)
      .eq("nome", "base")
      .order("criado_em", { ascending: false })
      .limit(1)
      .single();

    // Buscar realizados
    const [{ data: lancamentos }, { data: leads }] = await Promise.all([
      supabase.from("lancamentos_diarios").select("mrr_dia,ganhos").eq("mes_referencia", mesRef),
      supabase.from("leads_crm").select("id").eq("mes_referencia", mesRef),
    ]);

    const lanc = lancamentos || [];
    const mrrRealizado = lanc.reduce((s, l) => s + Number(l.mrr_dia || 0), 0);
    const contratosRealizados = lanc.reduce((s, l) => s + (l.ganhos || 0), 0);
    const leadsRealizados = (leads || []).length;

    // Se não tem projeção base, não tem o que comparar
    if (!projecaoBase) {
      return NextResponse.json({
        skipped: true,
        reason: `Nenhuma projeção base encontrada para ${mesRef}`,
      });
    }

    // Calcular acurácia: (1 - ABS(projetado - realizado) / projetado) × 100
    const calcAcuracia = (projetado: number, realizado: number) => {
      if (projetado === 0) return realizado === 0 ? 100 : 0;
      return Math.max(0, (1 - Math.abs(projetado - realizado) / projetado) * 100);
    };

    const acuraciaMrr = calcAcuracia(projecaoBase.mrr_projetado || 0, mrrRealizado);
    const acuraciaContratos = calcAcuracia(projecaoBase.contratos_projetados || 0, contratosRealizados);
    const acuraciaLeads = calcAcuracia(projecaoBase.leads_projetados || 0, leadsRealizados);
    const acuraciaMedia = (acuraciaMrr + acuraciaContratos + acuraciaLeads) / 3;

    // Upsert
    const { error } = await supabase
      .from("projecoes_historico_acuracia")
      .upsert({
        mes_referencia: mesRefDate,
        mrr_projetado: projecaoBase.mrr_projetado,
        mrr_realizado: mrrRealizado,
        contratos_projetados: projecaoBase.contratos_projetados,
        contratos_realizados: contratosRealizados,
        leads_projetados: projecaoBase.leads_projetados,
        leads_realizados: leadsRealizados,
        acuracia_mrr: Math.round(acuraciaMrr * 100) / 100,
        acuracia_contratos: Math.round(acuraciaContratos * 100) / 100,
        acuracia_leads: Math.round(acuraciaLeads * 100) / 100,
        acuracia_media: Math.round(acuraciaMedia * 100) / 100,
        calculado_em: new Date().toISOString(),
      }, { onConflict: "mes_referencia" });

    if (error) {
      console.error("[registrar-acuracia] Upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      mes_referencia: mesRef,
      acuracia: {
        mrr: Math.round(acuraciaMrr * 100) / 100,
        contratos: Math.round(acuraciaContratos * 100) / 100,
        leads: Math.round(acuraciaLeads * 100) / 100,
        media: Math.round(acuraciaMedia * 100) / 100,
      },
      projetado: projecaoBase,
      realizado: { mrr: mrrRealizado, contratos: contratosRealizados, leads: leadsRealizados },
    });
  } catch (err) {
    console.error("[projecoes/registrar-acuracia] Erro:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
