/**
 * POST /api/projecoes/verificar-alertas
 * Protegido por CRON_SECRET. Vercel Cron: diariamente às 08h (seg-sex).
 *
 * 6a. Alerta de meta inalcançável:
 *   - Calcula ritmo atual e projeta fechamento
 *   - Se projeção < meta E dias úteis restantes <= 10: insere alerta
 *   - Chama Gemini Flash para gerar ações emergenciais
 *   - Envia WhatsApp via Evolution API
 *
 * 6b. Gargalo do funil:
 *   - Perda proporcional por etapa vs. histórico 3M
 *   - Se perda > 20% acima da média: insere alerta
 *
 * NÃO executa aos sábados e domingos.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callAI } from "@/lib/ai-client";
import { sendWhatsAppText } from "@/lib/evolution";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getDiasUteis() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let diasUteisTotal = 0;
  let diasUteisPassados = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay();
    if (dow >= 1 && dow <= 5) {
      diasUteisTotal++;
      if (d <= now.getDate()) diasUteisPassados++;
    }
  }
  return { diasUteisTotal, diasUteisPassados, diasUteisRestantes: diasUteisTotal - diasUteisPassados };
}

function getMonthsRange(n: number): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

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
    const mesAtual = getCurrentMonth();
    const mesAtualDate = `${mesAtual}-01`;
    const { diasUteisPassados, diasUteisRestantes } = getDiasUteis();
    const alertasInseridos: string[] = [];

    // Buscar dados atuais
    const [
      { data: configAtual },
      { data: lancamentos },
      { data: leadsAtual },
    ] = await Promise.all([
      supabase.from("config_mensal").select("*").eq("mes_referencia", mesAtual).single(),
      supabase.from("lancamentos_diarios").select("ganhos,reunioes_marcadas,reunioes_feitas").eq("mes_referencia", mesAtual),
      supabase.from("leads_crm").select("id,etapa,data_reuniao_agendada,data_proposta_enviada").eq("mes_referencia", mesAtual),
    ]);

    const cfg = configAtual || {};
    const lanc = lancamentos || [];
    const leads = leadsAtual || [];

    // ===== 6a. ALERTA DE META INALCANÇÁVEL =====
    const contratosAteMomento = lanc.reduce((s, l) => s + (l.ganhos || 0), 0);
    const metaContratos = cfg.meta_contratos || 0;

    if (metaContratos > 0 && diasUteisPassados > 0) {
      const ritmoAtual = contratosAteMomento / diasUteisPassados;
      const projecaoFechamento = contratosAteMomento + (ritmoAtual * diasUteisRestantes);

      if (projecaoFechamento < metaContratos && diasUteisRestantes <= 10) {
        const deficit = metaContratos - Math.round(projecaoFechamento);

        // Gerar ações emergenciais com Gemini Flash
        let acoesIA: string[] = [];
        try {
          const iaResult = await callAI({
            provider: "gemini",
            systemPrompt: "Você é um COO de agência de marketing jurídico. Responda APENAS JSON: { \"acoes\": [\"ação 1\", \"ação 2\", ...] } com no máximo 5 ações emergenciais.",
            userContent: `Situação crítica: faltam ${deficit} contratos para bater a meta de ${metaContratos} e restam apenas ${diasUteisRestantes} dias úteis. Ritmo atual: ${ritmoAtual.toFixed(2)} contratos/dia. Reuniões feitas: ${lanc.reduce((s, l) => s + (l.reunioes_feitas || 0), 0)}. Leads no pipeline: ${leads.length}. Gere ações emergenciais realistas para os próximos ${diasUteisRestantes} dias.`,
            maxTokens: 500,
          });
          try {
            const parsed = JSON.parse(iaResult.text.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
            acoesIA = parsed.acoes || [];
          } catch {
            acoesIA = [iaResult.text.slice(0, 200)];
          }
        } catch (e) {
          console.error("[verificar-alertas] Erro IA:", e);
        }

        // Inserir alerta
        await supabase.from("projecoes_alertas").insert({
          mes_referencia: mesAtualDate,
          tipo: "meta_inalcancavel",
          mensagem: `Meta de ${metaContratos} contratos inalcançável no ritmo atual. Projeção: ${Math.round(projecaoFechamento)} contratos. Deficit: ${deficit}. Restam ${diasUteisRestantes} dias úteis.`,
          deficit,
          acoes_sugeridas: acoesIA,
        });
        alertasInseridos.push("meta_inalcancavel");

        // Enviar WhatsApp para admin
        const adminPhone = process.env.ADMIN_WHATSAPP || "";
        if (adminPhone) {
          await sendWhatsAppText(
            adminPhone,
            `⚠️ ALERTA META INALCANÇÁVEL\n\nMeta: ${metaContratos} contratos\nAtual: ${contratosAteMomento}\nProjeção: ${Math.round(projecaoFechamento)}\nDeficit: ${deficit}\nDias úteis restantes: ${diasUteisRestantes}\n\nRitmo necessário: ${((metaContratos - contratosAteMomento) / Math.max(1, diasUteisRestantes)).toFixed(1)} contratos/dia`
          ).catch((e) => console.error("[WhatsApp] Erro:", e));
        }
      }
    }

    // ===== 6b. GARGALO DO FUNIL =====
    // Dados da semana atual
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay() + 1); // segunda
    const inicioSemanaStr = inicioSemana.toISOString().split("T")[0];

    // Taxas da semana atual
    const leadsSemana = leads.length; // simplificação: leads do mês como proxy
    const qualificadosSemana = leads.filter((l) =>
      !["oportunidade", "lead_qualificado", "desqualificado", "desistiu"].includes(l.etapa)
    ).length;
    const reunioesFeitasSemana = lanc.reduce((s, l) => s + (l.reunioes_feitas || 0), 0);
    const propostasSemana = leads.filter((l) => l.data_proposta_enviada).length;
    const contratosSemana = contratosAteMomento;

    // Buscar histórico 3M para comparar
    const months3M = getMonthsRange(3);
    const [{ data: leads3M }, { data: lanc3M }] = await Promise.all([
      supabase.from("leads_crm").select("id,etapa,data_proposta_enviada").in("mes_referencia", months3M),
      supabase.from("lancamentos_diarios").select("reunioes_feitas,ganhos").in("mes_referencia", months3M),
    ]);

    const all3M = leads3M || [];
    const lanc3MAll = lanc3M || [];
    const safe = (n: number, d: number) => (d > 0 ? n / d : 0);

    const hist3M = {
      qualificacao: safe(all3M.filter((l) => !["oportunidade", "lead_qualificado", "desqualificado", "desistiu"].includes(l.etapa)).length, all3M.length),
      reuniao: safe(lanc3MAll.reduce((s, l) => s + (l.reunioes_feitas || 0), 0), all3M.filter((l) => !["oportunidade", "lead_qualificado", "desqualificado", "desistiu"].includes(l.etapa)).length),
      proposta: safe(all3M.filter((l) => l.data_proposta_enviada).length, lanc3MAll.reduce((s, l) => s + (l.reunioes_feitas || 0), 0)),
      fechamento: safe(lanc3MAll.reduce((s, l) => s + (l.ganhos || 0), 0), all3M.filter((l) => l.data_proposta_enviada).length),
    };

    const atual = {
      qualificacao: safe(qualificadosSemana, leadsSemana),
      reuniao: safe(reunioesFeitasSemana, qualificadosSemana),
      proposta: safe(propostasSemana, reunioesFeitasSemana),
      fechamento: safe(contratosSemana, propostasSemana),
    };

    // Identificar gargalo: etapa com maior perda proporcional vs. histórico
    const etapas = [
      { nome: "qualificacao", label: "Lead → Qualificado", atual: atual.qualificacao, hist: hist3M.qualificacao },
      { nome: "reuniao", label: "Qualificado → Reunião", atual: atual.reuniao, hist: hist3M.reuniao },
      { nome: "proposta", label: "Reunião → Proposta", atual: atual.proposta, hist: hist3M.proposta },
      { nome: "fechamento", label: "Proposta → Fechamento", atual: atual.fechamento, hist: hist3M.fechamento },
    ];

    for (const etapa of etapas) {
      if (etapa.hist > 0) {
        const perda = (etapa.hist - etapa.atual) / etapa.hist;
        if (perda > 0.20) {
          await supabase.from("projecoes_alertas").insert({
            mes_referencia: mesAtualDate,
            tipo: "gargalo_funil",
            mensagem: `Gargalo na etapa "${etapa.label}": taxa atual ${(etapa.atual * 100).toFixed(1)}% vs. média 3M ${(etapa.hist * 100).toFixed(1)}% (queda de ${(perda * 100).toFixed(0)}%)`,
            deficit: null,
            acoes_sugeridas: [`Investigar queda na conversão de ${etapa.label}`, `Taxa caiu ${(perda * 100).toFixed(0)}% em relação à média dos últimos 3 meses`],
          });
          alertasInseridos.push(`gargalo_funil:${etapa.nome}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      alertas_inseridos: alertasInseridos,
      dados: {
        contratos_atual: contratosAteMomento,
        meta_contratos: metaContratos,
        dias_uteis_restantes: diasUteisRestantes,
      },
    });
  } catch (err) {
    console.error("[projecoes/verificar-alertas] Erro:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
