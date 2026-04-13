/**
 * POST /api/trafego/ciclo-vida-criativos
 * Cron diário às 06h. Protegido por CRON_SECRET.
 * Calcula fase do ciclo de vida dos criativos ativos.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppText } from "@/lib/evolution";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hoje = new Date();
  const dow = hoje.getDay();
  if (dow === 0 || dow === 6) {
    return NextResponse.json({ skipped: true, reason: "weekend" });
  }

  const resultados = { processados: 0, em_fadiga: 0, erros: [] as string[] };

  try {
    // Buscar criativos ativos com ad_id vinculado
    const { data: criativos } = await supabase
      .from("trafego_criativos")
      .select("id, ad_id, nome, cliente_id, data_inicio_veiculacao")
      .eq("status_veiculacao", "ativo")
      .not("ad_id", "is", null)
      .is("deleted_at", null);

    if (!criativos || criativos.length === 0) {
      return NextResponse.json({ ...resultados, message: "Nenhum criativo ativo com ad_id" });
    }

    // Buscar performance dos últimos 30 dias
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const { data: perfAll } = await supabase
      .from("ads_performance")
      .select("ad_id, data_ref, spend, leads, impressoes, cliques, cpl, ctr, frequencia")
      .gte("data_ref", d30)
      .order("data_ref", { ascending: true });

    // Gestor de tráfego para WhatsApp
    const { data: emps } = await supabase
      .from("employees")
      .select("telefone, is_gestor_trafego")
      .eq("ativo", true)
      .eq("is_gestor_trafego", true)
      .limit(1);
    const gestorTel = emps?.[0]?.telefone;

    const mesRef = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];

    for (const criativo of criativos) {
      try {
        const perfs = (perfAll || []).filter((p) => p.ad_id === criativo.ad_id);
        if (perfs.length === 0) continue;

        // Calcular dias de veiculação
        const inicio = criativo.data_inicio_veiculacao
          ? new Date(criativo.data_inicio_veiculacao)
          : new Date(perfs[0].data_ref);
        const diasVeiculacao = Math.max(1, Math.floor((hoje.getTime() - inicio.getTime()) / 86400000));

        // Métricas agregadas
        const totalSpend = perfs.reduce((s, p) => s + Number(p.spend), 0);
        const totalLeads = perfs.reduce((s, p) => s + p.leads, 0);
        const totalImp = perfs.reduce((s, p) => s + p.impressoes, 0);
        const totalCliques = perfs.reduce((s, p) => s + p.cliques, 0);
        const cplMedio = totalLeads > 0 ? totalSpend / totalLeads : 0;
        const ctrMedio = totalImp > 0 ? (totalCliques / totalImp) * 100 : 0;
        const freqMedia = perfs.reduce((s, p) => s + (p.frequencia || 0), 0) / perfs.length;

        // CPL do pico (dias 8-21 com melhor performance)
        const perfsOrdenados = perfs.filter((p) => {
          const d = Math.floor((new Date(p.data_ref).getTime() - inicio.getTime()) / 86400000);
          return d >= 7 && d <= 21;
        });
        const picoPerfs = perfsOrdenados.filter((p) => p.leads > 0);
        const cplPico = picoPerfs.length > 0
          ? picoPerfs.reduce((s, p) => s + Number(p.spend) / p.leads, 0) / picoPerfs.length
          : cplMedio;

        // Verificar se sem veiculação há 7+ dias
        const ultimaPerf = perfs[perfs.length - 1];
        const diasSemVeiculacao = ultimaPerf
          ? Math.floor((hoje.getTime() - new Date(ultimaPerf.data_ref).getTime()) / 86400000)
          : 999;

        // Determinar fase
        let fase: string;
        if (diasSemVeiculacao >= 7) {
          fase = "encerrado";
        } else if (diasVeiculacao <= 7) {
          fase = "aquecimento";
        } else if (diasVeiculacao <= 21) {
          if (cplMedio > 0 && cplPico > 0 && cplMedio > cplPico * 1.2) {
            fase = "fadiga";
          } else if (cplMedio <= cplPico) {
            fase = "pico";
          } else {
            fase = "estavel";
          }
        } else {
          // > 21 dias
          if (cplMedio > 0 && cplPico > 0 && cplMedio > cplPico * 1.2) {
            fase = "fadiga";
          } else {
            fase = "estavel";
          }
        }

        // Score do período (0-10)
        let scorePeriodo = 5;
        if (cplMedio > 0 && cplPico > 0) {
          const ratio = cplPico / cplMedio;
          scorePeriodo = Math.min(10, Math.max(0, Math.round(ratio * 5 + (ctrMedio > 1.5 ? 2 : ctrMedio > 1 ? 1 : 0))));
        }

        // Upsert
        const { error: upsertError } = await supabase
          .from("trafego_criativo_metricas")
          .upsert({
            criativo_id: criativo.id,
            mes_referencia: mesRef,
            cpl: cplMedio,
            ctr: ctrMedio,
            spend: totalSpend,
            leads: totalLeads,
            impressoes: totalImp,
            frequencia: freqMedia,
            score_periodo: scorePeriodo,
            fase_ciclo_vida: fase,
          }, { onConflict: "criativo_id,mes_referencia" });

        if (upsertError) {
          resultados.erros.push(`Upsert falhou para ${criativo.id}: ${upsertError.message}`);
          continue;
        }

        resultados.processados++;

        // Se fadiga: alertar
        if (fase === "fadiga") {
          resultados.em_fadiga++;

          // Verificar se já tem alerta nos últimos 3 dias
          const d3 = new Date(Date.now() - 3 * 86400000).toISOString();
          const { data: alertaExistente } = await supabase
            .from("alertas_snooze")
            .select("id")
            .eq("ad_id", criativo.ad_id!)
            .eq("tipo", "criativo_em_fadiga")
            .gte("snooze_ate", new Date().toISOString())
            .limit(1);

          if (!alertaExistente || alertaExistente.length === 0) {
            await supabase.from("alertas_snooze").insert({
              ad_id: criativo.ad_id!,
              tipo: "criativo_em_fadiga",
              snooze_ate: new Date(Date.now() + 3 * 86400000).toISOString(),
            });

            if (gestorTel) {
              await sendWhatsAppText(gestorTel,
                `⚠️ Criativo "${criativo.nome}" em fase de fadiga — CPL subindo. Considerar trocar criativo ou rotacionar.`
              );
            }
          }

          // Atualizar status do criativo
          await supabase
            .from("trafego_criativos")
            .update({ status_veiculacao: "fadigado" })
            .eq("id", criativo.id);
        }

        if (fase === "encerrado") {
          await supabase
            .from("trafego_criativos")
            .update({ status_veiculacao: "arquivado", data_fim_veiculacao: hoje.toISOString().split("T")[0] })
            .eq("id", criativo.id);
        }
      } catch (e) {
        resultados.erros.push(`Criativo ${criativo.id}: ${e}`);
      }
    }
  } catch (e) {
    resultados.erros.push(String(e));
  }

  return NextResponse.json(resultados);
}
