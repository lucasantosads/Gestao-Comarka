/**
 * POST /api/trafego/verificar-regras
 * Cron a cada 2h (dias úteis). Protegido por CRON_SECRET.
 * 5a. Verifica regras de otimização contra anúncios ativos.
 * 5b. Detecta anomalias de tráfego.
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

const META_BASE = "https://graph.facebook.com/v21.0";

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

  const resultados = { regras_verificadas: 0, alertas_criados: 0, anomalias_detectadas: 0, pausas_automaticas: 0, erros: [] as string[] };

  try {
    // Buscar anúncios ativos
    const { data: adsAtivos } = await supabase
      .from("ads_metadata")
      .select("ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name")
      .eq("status", "ACTIVE");

    if (!adsAtivos || adsAtivos.length === 0) {
      return NextResponse.json({ ...resultados, message: "Nenhum anúncio ativo" });
    }

    // Performance últimas 24h
    const d1 = new Date(Date.now() - 24 * 3600000).toISOString().split("T")[0];
    const { data: perfRecente } = await supabase
      .from("ads_performance")
      .select("*")
      .gte("data_ref", d1);

    // Performance últimos 7 dias (para anomalias)
    const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const { data: perf7d } = await supabase
      .from("ads_performance")
      .select("*")
      .gte("data_ref", d7);

    // Regras ativas
    const { data: regras } = await supabase
      .from("trafego_regras_otimizacao")
      .select("*")
      .eq("ativo", true);

    // Buscar employees para WhatsApp
    const { data: emps } = await supabase
      .from("employees")
      .select("nome, telefone, is_gestor_trafego")
      .eq("ativo", true);
    const gestorTel = (emps || []).find((e) => e.is_gestor_trafego)?.telefone;

    // Clientes com meta_campaign_id
    const { data: clientes } = await supabase
      .from("clientes_notion_mirror")
      .select("notion_id, cliente, meta_campaign_id, orcamento_mensal")
      .not("meta_campaign_id", "is", null);
    const clienteByCampaign = new Map<string, typeof clientes extends (infer T)[] | null ? T : never>();
    for (const c of clientes || []) {
      if (c.meta_campaign_id) clienteByCampaign.set(c.meta_campaign_id, c);
    }

    // 5a. VERIFICAR REGRAS
    for (const ad of adsAtivos) {
      const adPerfs = (perfRecente || []).filter((p) => p.ad_id === ad.ad_id);
      if (adPerfs.length === 0) continue;

      const totalSpend = adPerfs.reduce((s, p) => s + Number(p.spend), 0);
      if (totalSpend === 0) continue;

      const totalLeads = adPerfs.reduce((s, p) => s + p.leads, 0);
      const totalImp = adPerfs.reduce((s, p) => s + p.impressoes, 0);
      const totalCliques = adPerfs.reduce((s, p) => s + p.cliques, 0);
      const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
      const ctr = totalImp > 0 ? (totalCliques / totalImp) * 100 : 0;
      const freqMedia = adPerfs.length > 0 ? adPerfs.reduce((s, p) => s + (p.frequencia || 0), 0) / adPerfs.length : 0;

      const metricValues: Record<string, number> = {
        cpl, ctr, frequencia: freqMedia,
        cpc: totalCliques > 0 ? totalSpend / totalCliques : 0,
        leads_dia: totalLeads, spend_dia: totalSpend,
      };

      for (const regra of regras || []) {
        const val = metricValues[regra.metrica];
        if (val === undefined) continue;
        const t = Number(regra.threshold);

        let disparou = false;
        switch (regra.operador) {
          case ">=": disparou = val >= t; break;
          case "<=": disparou = val <= t; break;
          case ">": disparou = val > t; break;
          case "<": disparou = val < t; break;
          case "=": disparou = val === t; break;
        }

        if (!disparou) continue;
        resultados.regras_verificadas++;

        // Verificar se já existe alerta igual nas últimas 6h
        const h6 = new Date(Date.now() - 6 * 3600000).toISOString();
        const { data: existente } = await supabase
          .from("alertas_snooze")
          .select("id")
          .eq("ad_id", ad.ad_id)
          .eq("tipo", `regra_${regra.metrica}`)
          .gte("snooze_ate", new Date().toISOString())
          .limit(1);

        if (!existente || existente.length === 0) {
          // Inserir alerta
          const snoozeAte = new Date(Date.now() + 6 * 3600000).toISOString();
          await supabase.from("alertas_snooze").insert({
            ad_id: ad.ad_id,
            tipo: `regra_${regra.metrica}`,
            snooze_ate: snoozeAte,
          });
          resultados.alertas_criados++;

          // Chamar avaliação IA
          try {
            const cliente = ad.campaign_id ? clienteByCampaign.get(ad.campaign_id) : null;
            await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? req.url.split("/api/")[0] : ""}/api/ia/avaliar-alerta-trafego`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ad_id: ad.ad_id,
                adset_id: ad.adset_id,
                campaign_id: ad.campaign_id,
                cliente_id: cliente?.notion_id || null,
                metrica: regra.metrica,
                valor_atual: val,
              }),
            });
          } catch (e) {
            resultados.erros.push(`IA avaliação falhou para ${ad.ad_id}: ${e}`);
          }

          // Se ação automática + crítica: pausar
          if (regra.acao_automatica && regra.prioridade === 3) {
            try {
              const pausaTipo = regra.acao_sugerida === "pausar_campanha" ? "campaign"
                : regra.acao_sugerida === "pausar_conjunto" ? "adset" : "ad";
              const pausaId = pausaTipo === "campaign" ? ad.campaign_id
                : pausaTipo === "adset" ? ad.adset_id : ad.ad_id;

              if (pausaId) {
                const token = process.env.META_ADS_ACCESS_TOKEN;
                if (token) {
                  await fetch(`${META_BASE}/${pausaId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "PAUSED", access_token: token }),
                  });
                  resultados.pausas_automaticas++;

                  if (pausaTipo === "ad") {
                    await supabase.from("ads_metadata").update({ status: "PAUSED" }).eq("ad_id", pausaId);
                  }

                  await supabase.from("trafego_regras_historico").insert({
                    regra_id: regra.id,
                    ad_id: ad.ad_id,
                    adset_id: ad.adset_id,
                    campaign_id: ad.campaign_id,
                    acao: "aplicada",
                    valor_metrica_no_momento: val,
                    observacao: `Pausa automática: ${regra.nome}`,
                  });
                }
              }
            } catch (e) {
              resultados.erros.push(`Pausa automática falhou: ${e}`);
            }
          }
        }
      }
    }

    // 5b. DETECTAR ANOMALIAS
    const hojeStr = hoje.toISOString().split("T")[0];
    const ontemStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    for (const ad of adsAtivos) {
      const perfs = (perf7d || []).filter((p) => p.ad_id === ad.ad_id);
      const perfsHoje = perfs.filter((p) => p.data_ref === hojeStr);
      const perfsOntem = perfs.filter((p) => p.data_ref === ontemStr);
      const cliente = ad.campaign_id ? clienteByCampaign.get(ad.campaign_id) : null;

      const spendHoje = perfsHoje.reduce((s, p) => s + Number(p.spend), 0);
      const leadsHoje = perfsHoje.reduce((s, p) => s + p.leads, 0);
      const cplHoje = leadsHoje > 0 ? spendHoje / leadsHoje : 0;

      const spendOntem = perfsOntem.reduce((s, p) => s + Number(p.spend), 0);
      const leadsOntem = perfsOntem.reduce((s, p) => s + p.leads, 0);
      const cplOntem = leadsOntem > 0 ? spendOntem / leadsOntem : 0;

      const media7d = perfs.length > 0 ? perfs.reduce((s, p) => {
        const l = p.leads;
        return l > 0 ? s + Number(p.spend) / l : s;
      }, 0) / Math.max(1, perfs.filter((p) => p.leads > 0).length) : 0;

      const freqMedia = perfs.length > 0 ? perfs.reduce((s, p) => s + (p.frequencia || 0), 0) / perfs.length : 0;

      const anomalias: { tipo: string; valor_anterior: number; valor_atual: number; causa_provavel: string }[] = [];

      // gasto_zerado: spend = 0 por anúncio ativo em horário comercial
      const horaAtual = hoje.getHours();
      if (spendHoje === 0 && horaAtual >= 9 && horaAtual <= 18) {
        anomalias.push({
          tipo: "gasto_zerado",
          valor_anterior: spendOntem,
          valor_atual: 0,
          causa_provavel: "Possível limite de orçamento diário atingido ou problema na entrega",
        });
      }

      // cpl_dobrou
      if (cplHoje > 0 && cplOntem > 0 && cplHoje > cplOntem * 2) {
        anomalias.push({
          tipo: "cpl_dobrou",
          valor_anterior: cplOntem,
          valor_atual: cplHoje,
          causa_provavel: freqMedia > 3
            ? "Público saturado — alta frequência"
            : "Queda na qualidade da audiência ou criativo perdendo efetividade",
        });
      }

      // leads_zerados: spend > R$30 últimas 6h e zero leads
      const spend6h = perfsHoje.reduce((s, p) => s + Number(p.spend), 0);
      if (spend6h > 30 && leadsHoje === 0) {
        anomalias.push({
          tipo: "leads_zerados",
          valor_anterior: leadsOntem,
          valor_atual: 0,
          causa_provavel: "Possível problema no formulário, landing page ou segmentação",
        });
      }

      // performance_queda_brusca: CPL subiu > 40% vs média 7 dias
      if (cplHoje > 0 && media7d > 0 && cplHoje > media7d * 1.4) {
        anomalias.push({
          tipo: "performance_queda_brusca",
          valor_anterior: media7d,
          valor_atual: cplHoje,
          causa_provavel: freqMedia > 3
            ? "Público saturado — alta frequência combinada com CPL crescente"
            : "Possível mudança de leilão ou fadiga de criativo",
        });
      }

      // spend_esgotando / spend_sobrando (se cliente com orçamento)
      if (cliente?.orcamento_mensal && Number(cliente.orcamento_mensal) > 0) {
        const orcamento = Number(cliente.orcamento_mensal);
        const diaDoMes = hoje.getDate();
        const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
        const spendTotal7d = perfs.reduce((s, p) => s + Number(p.spend), 0);
        const spendDiarioMedio = spendTotal7d / 7;
        const diasRestantes = diasNoMes - diaDoMes;
        const spendProjetado = spendDiarioMedio * diasRestantes + spendTotal7d;

        if (spendProjetado > orcamento && diaDoMes < 25) {
          anomalias.push({
            tipo: "spend_esgotando",
            valor_anterior: orcamento,
            valor_atual: spendProjetado,
            causa_provavel: `Ritmo atual vai esgotar orçamento antes do dia 25 (projetado: R$${spendProjetado.toFixed(0)})`,
          });
        }
        if (spendProjetado < orcamento * 0.7 && diaDoMes > 10) {
          anomalias.push({
            tipo: "spend_sobrando",
            valor_anterior: orcamento,
            valor_atual: spendProjetado,
            causa_provavel: `Ritmo atual vai usar menos de 70% do orçamento (projetado: R$${spendProjetado.toFixed(0)})`,
          });
        }
      }

      // Inserir anomalias
      for (const a of anomalias) {
        // Verificar se já existe registro igual no mesmo dia
        const { data: existe } = await supabase
          .from("trafego_anomalias")
          .select("id")
          .eq("ad_id", ad.ad_id)
          .eq("tipo", a.tipo)
          .gte("criado_em", hojeStr + "T00:00:00")
          .limit(1);

        if (existe && existe.length > 0) continue;

        await supabase.from("trafego_anomalias").insert({
          ad_id: ad.ad_id,
          adset_id: ad.adset_id,
          campaign_id: ad.campaign_id,
          cliente_id: cliente?.notion_id || null,
          tipo: a.tipo,
          valor_anterior: a.valor_anterior,
          valor_atual: a.valor_atual,
          causa_provavel: a.causa_provavel,
        });
        resultados.anomalias_detectadas++;

        // Enviar WhatsApp
        if (gestorTel) {
          const nomeObj = ad.ad_name || ad.ad_id;
          await sendWhatsAppText(gestorTel,
            `⚠️ ${a.tipo.replace(/_/g, " ").toUpperCase()} detectada em ${nomeObj}.\nCausa provável: ${a.causa_provavel}\nAção sugerida: Verificar no dashboard.`
          );
        }
      }
    }
  } catch (e) {
    resultados.erros.push(String(e));
  }

  return NextResponse.json(resultados);
}
