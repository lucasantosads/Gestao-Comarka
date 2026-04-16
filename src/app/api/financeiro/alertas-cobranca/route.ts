/**
 * POST /api/financeiro/alertas-cobranca
 * Vercel Cron: todo dia 1 às 07h (dias úteis).
 * Verifica clientes ativos sem cobrança no mês e envia alerta WhatsApp.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppText } from "@/lib/evolution";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

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
  const mesInicio = `${mesAtual}-01`;
  const [y, m] = mesAtual.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const mesFim = `${mesAtual}-${String(lastDay).padStart(2, "0")}`;

  // Buscar clientes ativos
  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nome")
    .eq("status", "ativo")
    .is("data_cancelamento", null);

  if (!clientes || clientes.length === 0) {
    return NextResponse.json({ success: true, alertas: 0, reason: "sem clientes ativos" });
  }

  // Buscar pagamentos do mês atual
  const { data: pagamentos } = await supabase
    .from("asaas_pagamentos")
    .select("cliente_id")
    .gte("data_vencimento", mesInicio)
    .lte("data_vencimento", mesFim)
    .neq("status", "refunded")
    .is("deleted_at", null);

  const clientesComCobranca = new Set((pagamentos || []).map((p) => p.cliente_id).filter(Boolean));

  // Buscar telefone admin para WhatsApp
  const { data: admin } = await supabase
    .from("employees")
    .select("telefone")
    .eq("role", "admin")
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  const adminPhone = admin?.telefone || process.env.ADMIN_WHATSAPP || "";

  let alertasCount = 0;
  const semCobranca: string[] = [];

  for (const cliente of clientes) {
    if (!clientesComCobranca.has(cliente.id)) {
      semCobranca.push(cliente.nome);

      // Inserir alerta
      await supabase.from("alertas").insert({
        tipo: "contrato_sem_cobranca",
        severidade: "atencao",
        titulo: `Cliente sem cobrança: ${cliente.nome}`,
        descricao: `${cliente.nome} não tem cobrança gerada para ${mesAtual}.`,
      }).then(() => {});

      alertasCount++;
    }
  }

  // Enviar WhatsApp consolidado para admin
  if (semCobranca.length > 0 && adminPhone) {
    const meses = hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const msg = `⚠️ *Alerta Financeiro — Clientes sem cobrança*\n\n${semCobranca.length} cliente(s) sem cobrança para ${meses}:\n\n${semCobranca.map((n) => `• ${n}`).join("\n")}\n\nAcesse o dashboard para gerar as cobranças.`;
    await sendWhatsAppText(adminPhone, msg);
  }

  return NextResponse.json({ success: true, alertas: alertasCount, clientes_sem_cobranca: semCobranca });
}
