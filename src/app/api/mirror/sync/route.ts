/**
 * POST /api/mirror/sync
 * Puxa os 3 DBs do Notion (clientes, onboarding, team) e grava no Supabase mirror.
 * Preserva o raw_properties como JSONB para não perder nada.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getClientes, getOnboarding, getTeam } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function POST() {
  const startTime = Date.now();
  const stats = { clientes: 0, onboarding: 0, team: 0, erros: 0 };

  try {
    // 1. Clientes
    const clientes = await getClientes();
    for (const c of clientes) {
      const { error } = await supabase.from("clientes_notion_mirror").upsert({
        notion_id: c.notion_id,
        cliente: c.nome,
        status: c.status || null,
        situacao: c.situacao || null,
        resultados: c.resultados || null,
        atencao: c.atencao || null,
        nicho: c.nicho || null,
        analista: c.analista || null,
        orcamento: c.orcamento ? Number(c.orcamento) : null,
        dia_otimizar: c.dia_otimizacao || null,
        ultimo_feedback: c.ultimo_feedback || null,
        otimizacao: c.ultima_otimizacao || null,
        pagamento: c["pagamento"] || null,
        fb_url: c["fb"] || null,
        gads_url: c["gads"] || null,
        tiktok_url: c["tiktok"] || null,
        raw_properties: c as unknown as Record<string, unknown>,
        ultimo_sync_em: new Date().toISOString(),
      }, { onConflict: "notion_id" });
      if (error) stats.erros++; else stats.clientes++;
    }

    // 2. Onboarding
    const onbs = await getOnboarding();
    for (const o of onbs) {
      const { error } = await supabase.from("onboarding_notion_mirror").upsert({
        notion_id: o.notion_id,
        nome: o.nome,
        etapa: o.etapa || null,
        plataformas: o.plataformas || null,
        orcamento_mensal: o.orcamento ? Number(o.orcamento) : null,
        gestor_trafego: o["gestor"] || null,
        gestor_junior: o["gestor_junior"] || null,
        head_trafego: o["head"] || null,
        comercial: o["comercial"] || null,
        sucesso_cliente: o["sucesso"] || null,
        produto: o["produto"] || null,
        raw_properties: o as unknown as Record<string, unknown>,
        ultimo_sync_em: new Date().toISOString(),
      }, { onConflict: "notion_id" });
      if (error) stats.erros++; else stats.onboarding++;
    }

    // 3. Team
    const team = await getTeam();
    for (const t of team) {
      const { error } = await supabase.from("team_notion_mirror").upsert({
        notion_id: t.notion_id,
        nome: t.nome,
        cargo: t.cargo || null,
        funcoes: t.funcoes || null,
        email: t.email || null,
        telefone: t.telefone || null,
        status: t.status || null,
        drive: t["drive"] || null,
        raw_properties: t as unknown as Record<string, unknown>,
        ultimo_sync_em: new Date().toISOString(),
      }, { onConflict: "notion_id" });
      if (error) stats.erros++; else stats.team++;
    }

    return NextResponse.json({ ...stats, duration_ms: Date.now() - startTime });
  } catch (e) {
    return NextResponse.json({ error: String(e), stats }, { status: 500 });
  }
}

export async function GET() {
  // Retorna contagem do mirror atual
  const [c, o, t] = await Promise.all([
    supabase.from("clientes_notion_mirror").select("notion_id", { count: "exact", head: true }),
    supabase.from("onboarding_notion_mirror").select("notion_id", { count: "exact", head: true }),
    supabase.from("team_notion_mirror").select("notion_id", { count: "exact", head: true }),
  ]);
  return NextResponse.json({
    clientes: c.count || 0,
    onboarding: o.count || 0,
    team: t.count || 0,
  });
}
