/**
 * POST /api/financeiro/calcular-margem
 * Vercel Cron: toda segunda-feira às 06h.
 * Calcula margem por cliente: receita, custo_midia (Meta API), custo_gestor.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const META_TOKEN = () => process.env.META_ADS_ACCESS_TOKEN || "";
const META_ACCOUNT = () => process.env.META_ADS_ACCOUNT_ID || "";

async function fetchCampaignSpend(campaignId: string, since: string, until: string): Promise<number> {
  const token = META_TOKEN();
  if (!token || !campaignId) return 0;
  try {
    const params = new URLSearchParams({
      access_token: token,
      fields: "spend",
      time_range: JSON.stringify({ since, until }),
      level: "campaign",
    });
    const res = await fetch(`https://graph.facebook.com/v21.0/${campaignId}/insights?${params}`);
    if (!res.ok) return 0;
    const body = await res.json();
    return (body.data || []).reduce((s: number, r: { spend?: string }) => s + parseFloat(r.spend || "0"), 0);
  } catch {
    return 0;
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Não executar sábado/domingo
  const hoje = new Date();
  const dia = hoje.getDay();
  if (dia === 0 || dia === 6) {
    return NextResponse.json({ skipped: true, reason: "weekend" });
  }

  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const mesDate = `${mesAtual}-01`;
  const [y, m] = mesAtual.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const since = `${mesAtual}-01`;
  const until = `${mesAtual}-${String(lastDay).padStart(2, "0")}`;

  // Buscar clientes ativos com dados necessários
  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nome, mrr, contrato_id, closer_id")
    .eq("status", "ativo");

  if (!clientes || clientes.length === 0) {
    return NextResponse.json({ success: true, processed: 0, reason: "sem clientes ativos" });
  }

  // Buscar entradas para receita do contrato
  const { data: entradas } = await supabase
    .from("clientes_receita")
    .select("nome, valor_mensal, closer")
    .neq("status_financeiro", "churned");

  const entradasMap = new Map<string, { valor_mensal: number; closer: string }>();
  for (const e of entradas || []) {
    entradasMap.set(e.nome.toLowerCase().trim(), { valor_mensal: e.valor_mensal, closer: e.closer });
  }

  // Buscar dados da mirror para campaign_id dos clientes
  const { data: mirrors } = await supabase
    .from("clientes_notion_mirror")
    .select("cliente, meta_campaign_id, gestor_id");

  const mirrorMap = new Map<string, { meta_campaign_id: string | null; gestor_id: string | null }>();
  for (const m of mirrors || []) {
    if (m.cliente) mirrorMap.set(m.cliente.toLowerCase().trim(), m);
  }

  // Buscar employees para custo_gestor (salário base)
  const { data: employees } = await supabase
    .from("employees")
    .select("id, nome, entity_id")
    .eq("ativo", true);

  const { data: compConfigs } = await supabase
    .from("compensation_config")
    .select("employee_id, salario_base")
    .eq("mes_referencia", mesAtual);

  const salarioMap = new Map<string, number>();
  for (const cc of compConfigs || []) {
    salarioMap.set(cc.employee_id, cc.salario_base || 0);
  }

  // Contar clientes ativos por gestor/closer para dividir custo
  const gestorClienteCount = new Map<string, number>();
  for (const c of clientes) {
    const closerId = c.closer_id;
    if (closerId) {
      gestorClienteCount.set(closerId, (gestorClienteCount.get(closerId) || 0) + 1);
    }
  }

  let processed = 0;

  for (const cliente of clientes) {
    const nomeKey = cliente.nome.toLowerCase().trim();
    const entrada = entradasMap.get(nomeKey);
    const mirror = mirrorMap.get(nomeKey);

    // Receita: valor do contrato ativo no mês
    const receita = entrada?.valor_mensal || cliente.mrr || 0;

    // Custo mídia: spend Meta do cliente via API direta
    let custoMidia = 0;
    const campaignId = mirror?.meta_campaign_id;
    if (campaignId) {
      custoMidia = await fetchCampaignSpend(campaignId, since, until);
    }

    // Custo gestor: salário / nº de clientes ativos do gestor
    let custoGestor = 0;
    const closerId = cliente.closer_id;
    if (closerId) {
      // Encontrar employee vinculado ao closer
      const emp = (employees || []).find((e) => e.entity_id === closerId);
      if (emp) {
        const salario = salarioMap.get(emp.id) || 0;
        const numClientes = gestorClienteCount.get(closerId) || 1;
        custoGestor = salario / numClientes;
      }
    }

    const margemBruta = receita - custoMidia;
    const margemLiquida = receita - custoMidia - custoGestor;
    const margemPct = receita > 0 ? (margemLiquida / receita) * 100 : 0;

    // Upsert em financeiro_margem_cliente
    await supabase
      .from("financeiro_margem_cliente")
      .upsert(
        {
          cliente_id: cliente.id,
          mes_referencia: mesDate,
          receita,
          custo_midia: custoMidia,
          custo_gestor: Math.round(custoGestor * 100) / 100,
          margem_bruta: Math.round(margemBruta * 100) / 100,
          margem_liquida: Math.round(margemLiquida * 100) / 100,
          margem_pct: Math.round(margemPct * 100) / 100,
          calculado_em: new Date().toISOString(),
        },
        { onConflict: "cliente_id,mes_referencia" }
      );

    processed++;
  }

  return NextResponse.json({ success: true, processed, mes: mesAtual });
}
