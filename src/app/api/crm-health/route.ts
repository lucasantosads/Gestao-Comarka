/**
 * GET /api/crm-health
 * Verifica integridade dos dados do CRM comparando GHL vs Supabase
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Alerts — no cache

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET() {
  const hoje = new Date().toISOString().split("T")[0];
  const mes = hoje.slice(0, 7);
  const issues: { tipo: string; msg: string; severidade: "info" | "warning" | "error" }[] = [];

  // 1. Contar leads do CRM no mês atual
  const { count: crmCount } = await supabase
    .from("leads_crm")
    .select("id", { count: "exact", head: true })
    .eq("mes_referencia", mes);

  // 2. Contar leads de hoje
  const { count: hojeCount } = await supabase
    .from("leads_crm")
    .select("id", { count: "exact", head: true })
    .gte("created_at", hoje + "T00:00:00")
    .lte("created_at", hoje + "T23:59:59");

  // 3. Verificar leads sem closer atribuído
  const { count: semCloser } = await supabase
    .from("leads_crm")
    .select("id", { count: "exact", head: true })
    .eq("mes_referencia", mes)
    .is("closer_id", null);

  // 4. Verificar leads duplicados (mesmo nome no mesmo mês)
  const { data: allLeads } = await supabase
    .from("leads_crm")
    .select("nome")
    .eq("mes_referencia", mes);

  const nomes = (allLeads || []).map((l) => l.nome?.toLowerCase().trim()).filter(Boolean);
  const seen = new Set<string>();
  let duplicados = 0;
  for (const n of nomes) {
    if (seen.has(n)) duplicados++;
    else seen.add(n);
  }

  // 5. Verificar último lead recebido
  const { data: ultimo } = await supabase
    .from("leads_crm")
    .select("created_at, nome")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const ultimoRecebido = ultimo?.created_at;
  const minutosDesdeUltimo = ultimoRecebido
    ? Math.floor((Date.now() - new Date(ultimoRecebido).getTime()) / 60000)
    : null;

  // 6. Comparar com Meta Ads (se disponível)
  let metaLeads: number | null = null;
  try {
    const metaRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? "http://localhost:3000" : ""}/api/meta-spend?since=${mes}-01&until=${hoje}`);
    const metaData = await metaRes.json();
    if (metaData.leads) metaLeads = metaData.leads;
  } catch {}

  // Gerar issues
  if (minutosDesdeUltimo !== null && minutosDesdeUltimo > 240) {
    issues.push({ tipo: "inatividade", msg: `Nenhum lead recebido nas ultimas ${Math.floor(minutosDesdeUltimo / 60)}h. Verificar webhook.`, severidade: "warning" });
  }

  if (semCloser && semCloser > 5) {
    issues.push({ tipo: "sem_closer", msg: `${semCloser} leads sem closer atribuido neste mes.`, severidade: "warning" });
  }

  if (duplicados > 3) {
    issues.push({ tipo: "duplicados", msg: `${duplicados} leads com nome duplicado neste mes. Possivel problema de webhook.`, severidade: "warning" });
  }

  if (metaLeads !== null && crmCount !== null && metaLeads > 0) {
    const pct = (crmCount / metaLeads) * 100;
    if (pct < 50) {
      issues.push({ tipo: "divergencia_meta", msg: `CRM tem ${crmCount} leads mas Meta reporta ${metaLeads} (${pct.toFixed(0)}%). Muitos leads nao estao chegando.`, severidade: "error" });
    } else if (pct < 80) {
      issues.push({ tipo: "divergencia_meta", msg: `CRM tem ${crmCount} de ${metaLeads} leads do Meta (${pct.toFixed(0)}%). Alguns leads podem estar se perdendo.`, severidade: "warning" });
    }
  }

  if (issues.length === 0) {
    issues.push({ tipo: "ok", msg: "Todos os verificacoes passaram. Dados do CRM consistentes.", severidade: "info" });
  }

  return NextResponse.json({
    mes,
    leads_mes: crmCount || 0,
    leads_hoje: hojeCount || 0,
    sem_closer: semCloser || 0,
    duplicados,
    ultimo_lead: ultimoRecebido ? { nome: ultimo?.nome, created_at: ultimoRecebido, minutos_atras: minutosDesdeUltimo } : null,
    meta_leads: metaLeads,
    crm_vs_meta_pct: metaLeads && crmCount ? ((crmCount / metaLeads) * 100).toFixed(1) : null,
    issues,
  });
}
