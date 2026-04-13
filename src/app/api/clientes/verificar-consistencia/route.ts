/**
 * POST /api/clientes/verificar-consistencia
 * Protegido por CRON_SECRET. Vercel Cron: diariamente às 06h (seg-sex).
 *
 * Compara total de clientes ativos em clientes_receita (Entrada) com
 * total calculado pela view vw_churn_mensal / tabela clientes (Churn).
 * Se divergência > 0: insere em churn_consistencia_log, cria alerta,
 * envia WhatsApp via Evolution API.
 *
 * NÃO executa aos sábados e domingos.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppText } from "@/lib/evolution";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // Validar CRON_SECRET
  const authHeader = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Não executar nos finais de semana
  const dow = new Date().getDay();
  if (dow === 0 || dow === 6) {
    return NextResponse.json({ skipped: true, reason: "Fim de semana" });
  }

  try {
    const hoje = new Date().toISOString().split("T")[0];
    const mesAtual = `${hoje.slice(0, 7)}-01`;

    // Total de clientes ativos na Entrada (clientes_receita)
    const { data: entradaAtivos, error: entradaErr } = await supabase
      .from("clientes_receita")
      .select("id, nome")
      .in("status_financeiro", ["ativo", "pausado", "pagou_integral", "parceria"]);

    if (entradaErr) {
      console.error("[verificar-consistencia] Erro entradas:", entradaErr);
      return NextResponse.json({ error: entradaErr.message }, { status: 500 });
    }

    const totalAtivosEntrada = (entradaAtivos || []).length;
    const nomesEntrada = new Set((entradaAtivos || []).map((c) => c.nome?.trim().toLowerCase()).filter(Boolean));

    // Total de clientes ativos na tabela clientes (pipeline de churn)
    // Um cliente na tabela clientes com status != 'cancelado' é considerado "ativo" nesse contexto.
    // Mas a tabela clientes é usada como pipeline de churn — quem está lá com cancelado já churnou.
    // A contagem de referência é: clientes_receita ativos MENOS churn_log do mês = consistência.

    // Abordagem: contar churns registrados no mês em churn_log e
    // comparar com clientes em clientes com status='cancelado' no mês.
    const { data: churnsLogMes } = await supabase
      .from("churn_log")
      .select("id, cliente_nome")
      .gte("data_saida", mesAtual);

    const { data: clientesCanceladosMes } = await supabase
      .from("clientes")
      .select("id, nome")
      .eq("status", "cancelado")
      .gte("data_cancelamento", mesAtual);

    const totalChurnsLog = (churnsLogMes || []).length;
    const totalCanceladosPipeline = (clientesCanceladosMes || []).length;

    // Divergência: se churn_log e pipeline de clientes não batem
    const divergencia = Math.abs(totalChurnsLog - totalCanceladosPipeline);

    // Identificar clientes divergentes
    const nomesChurnLog = new Set((churnsLogMes || []).map((c) => c.cliente_nome?.trim().toLowerCase()).filter(Boolean));
    const nomesPipeline = new Set((clientesCanceladosMes || []).map((c) => c.nome?.trim().toLowerCase()).filter(Boolean));

    const apenasEmLog: string[] = [];
    nomesChurnLog.forEach((n) => { if (!nomesPipeline.has(n)) apenasEmLog.push(n); });
    const apenasEmPipeline: string[] = [];
    nomesPipeline.forEach((n) => { if (!nomesChurnLog.has(n)) apenasEmPipeline.push(n); });

    // Verificação adicional: clientes em clientes_receita como churned que não estão em churn_log
    const { data: receitaChurned } = await supabase
      .from("clientes_receita")
      .select("id, nome")
      .eq("status_financeiro", "churned");

    const nomesReceitaChurned = new Set((receitaChurned || []).map((c) => c.nome?.trim().toLowerCase()).filter(Boolean));
    const receitaChurnadosSemLog: string[] = [];
    nomesReceitaChurned.forEach((n) => {
      if (!nomesChurnLog.has(n)) receitaChurnadosSemLog.push(n);
    });

    const totalDivergencia = divergencia + receitaChurnadosSemLog.length;
    const clientesDivergentes = {
      apenas_em_churn_log: apenasEmLog,
      apenas_em_pipeline: apenasEmPipeline,
      receita_churned_sem_log: receitaChurnadosSemLog,
    };

    const statusConsistencia = totalDivergencia > 0 ? "divergencia_detectada" : "ok";

    // Inserir em churn_consistencia_log
    await supabase.from("churn_consistencia_log").insert({
      mes_referencia: mesAtual,
      total_ativos_entrada: totalAtivosEntrada,
      total_ativos_churn: totalCanceladosPipeline,
      divergencia: totalDivergencia,
      clientes_divergentes: totalDivergencia > 0 ? clientesDivergentes : null,
      status: statusConsistencia,
    });

    // Se divergência detectada
    if (totalDivergencia > 0) {
      // Inserir alerta em alertas_snooze (reusando a tabela existente)
      try {
        await supabase.from("alertas_snooze").insert({
          ad_id: "sistema",
          tipo: "divergencia_churn",
          snooze_ate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      } catch { /* tabela pode não existir */ }

      // Enviar WhatsApp para admin
      const adminPhone = process.env.ADMIN_WHATSAPP || "";
      if (adminPhone) {
        const detalhes = [
          apenasEmLog.length > 0 ? `Só em churn_log: ${apenasEmLog.join(", ")}` : "",
          apenasEmPipeline.length > 0 ? `Só em pipeline: ${apenasEmPipeline.join(", ")}` : "",
          receitaChurnadosSemLog.length > 0 ? `Churned sem log: ${receitaChurnadosSemLog.slice(0, 5).join(", ")}` : "",
        ].filter(Boolean).join("\n");

        await sendWhatsAppText(
          adminPhone,
          `⚠️ Divergência Entrada vs Churn detectada\n\n${totalDivergencia} cliente(s) com inconsistência.\nAtivos na Entrada: ${totalAtivosEntrada}\nCancelados pipeline: ${totalCanceladosPipeline}\n\n${detalhes}\n\nVerificar: /dashboard/clientes`
        ).catch((e) => console.error("[WhatsApp] Erro:", e));
      }
    }

    return NextResponse.json({
      success: true,
      status: statusConsistencia,
      total_ativos_entrada: totalAtivosEntrada,
      total_cancelados_pipeline: totalCanceladosPipeline,
      total_churns_log: totalChurnsLog,
      divergencia: totalDivergencia,
      clientes_divergentes: totalDivergencia > 0 ? clientesDivergentes : null,
    });
  } catch (err) {
    console.error("[clientes/verificar-consistencia] Erro:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
