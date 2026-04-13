import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  validarCronSecret,
  ehFimDeSemana,
  mesRefISO,
  diasUteisNoMes,
  inicioSemanaISO,
  jaExisteLancamento,
  recalcularPontosMes,
} from "@/lib/comarka-pro";
import { PONTOS_CATEGORIA } from "@/lib/comarka-pro-config";

export const dynamic = "force-dynamic";

// POST /api/comarka-pro/calcular-automatico
// Chamado pelo Vercel Cron às segundas 06h (America/Sao_Paulo).
// Não executa aos sábados/domingos.
export async function POST(req: NextRequest) {
  if (!validarCronSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (ehFimDeSemana()) {
    return NextResponse.json({ skipped: "weekend" });
  }

  const supa = getSupabaseAdmin();
  const hoje = new Date();
  const mesISO = mesRefISO(hoje);
  const semanaISO = inicioSemanaISO(hoje);

  // 1. buscar gestores de tráfego ativos
  const { data: gestores, error: errG } = await supa
    .from("employees")
    .select("id, nome")
    .eq("ativo", true)
    .eq("is_gestor_trafego", true);
  if (errG) return NextResponse.json({ error: errG.message }, { status: 500 });

  const relatorio: any[] = [];

  for (const g of gestores ?? []) {
    const colaborador_id = g.id as string;
    const criados: string[] = [];

    // ---------- 3a. Cronômetro ----------
    try {
      const diasUteis = diasUteisNoMes(hoje);
      const mesStart = `${mesISO}`;
      const { data: logs } = await supa
        .from("kanban_cronometro_log")
        .select("data")
        .eq("colaborador_id", colaborador_id)
        .gte("data", mesStart);
      const diasDistintos = new Set((logs ?? []).map((l: any) => l.data)).size;
      const pct = diasUteis > 0 ? diasDistintos / diasUteis : 0;
      if (pct >= 0.95) {
        const existe = await jaExisteLancamento({
          colaborador_id,
          mes_referencia: mesISO,
          categoria: "cronometro",
        });
        if (!existe) {
          await supa.from("comarka_pro_lancamentos").insert({
            colaborador_id,
            mes_referencia: mesISO,
            categoria: "cronometro",
            pontos: PONTOS_CATEGORIA.cronometro.pts,
            descricao: `Cronômetro ${(pct * 100).toFixed(0)}% no mês`,
            origem: "automatico",
          });
          criados.push("cronometro");
        }
      }
    } catch (e: any) {
      console.error("[cron] 3a cronometro", colaborador_id, e?.message);
    }

    // ---------- 3b. Aumento de orçamento por cliente ----------
    // Path: clientes (gestor_id) → clientes_meta_historico (meta_campaign_id)
    //    → ads_metadata (campaign_id → ad_id) → ads_performance (spend por semana)
    try {
      // semanaAtualStart removido — não era usado
      const semanaAntStart = new Date(semanaISO);
      semanaAntStart.setUTCDate(semanaAntStart.getUTCDate() - 7);
      const semanaAntISO = semanaAntStart.toISOString().slice(0, 10);

      const { data: clientesDoGestor } = await supa
        .from("clientes")
        .select("notion_id")
        .eq("gestor_id", colaborador_id);

      for (const c of clientesDoGestor ?? []) {
        const notionId = (c as any).notion_id as string | null;
        if (!notionId) continue;

        const { data: hist } = await supa
          .from("clientes_meta_historico")
          .select("meta_campaign_id")
          .eq("cliente_notion_id", notionId);
        const campaignIds = Array.from(new Set((hist ?? []).map((h: any) => h.meta_campaign_id).filter(Boolean)));
        if (campaignIds.length === 0) continue;

        const { data: ads } = await supa
          .from("ads_metadata")
          .select("ad_id")
          .in("campaign_id", campaignIds);
        const adIds = (ads ?? []).map((a: any) => a.ad_id).filter(Boolean);
        if (adIds.length === 0) continue;

        const { data: perfAtual } = await supa
          .from("ads_performance")
          .select("spend, data_ref")
          .in("ad_id", adIds)
          .gte("data_ref", semanaISO);
        const { data: perfAnt } = await supa
          .from("ads_performance")
          .select("spend, data_ref")
          .in("ad_id", adIds)
          .gte("data_ref", semanaAntISO)
          .lt("data_ref", semanaISO);

        const spendAtual = (perfAtual ?? []).reduce((s: number, r: any) => s + Number(r.spend ?? 0), 0);
        const spendAnt = (perfAnt ?? []).reduce((s: number, r: any) => s + Number(r.spend ?? 0), 0);
        if (spendAnt <= 0 || spendAtual < spendAnt * 1.1) continue;

        const existe = await jaExisteLancamento({
          colaborador_id,
          mes_referencia: mesISO,
          categoria: "orcamento",
          cliente_id: null, // cliente ligado via notion (texto), registramos sem FK
          criado_desde: semanaISO,
        });
        if (!existe) {
          await supa.from("comarka_pro_lancamentos").insert({
            colaborador_id,
            mes_referencia: mesISO,
            categoria: "orcamento",
            pontos: PONTOS_CATEGORIA.orcamento.pts,
            descricao: `Aumento de orçamento (${Math.round(((spendAtual - spendAnt) / spendAnt) * 100)}%) — cliente ${notionId.slice(0, 6)}`,
            origem: "automatico",
          });
          criados.push(`orcamento:${notionId.slice(0, 6)}`);
        }
      }
    } catch (e: any) {
      console.error("[cron] 3b orcamento", colaborador_id, e?.message);
    }

    // ---------- 3c. Reuniões com cliente na semana ----------
    // Máximo 1 ponto por cliente (cliente_notion_id) por semana.
    try {
      const { data: reunioes } = await supa
        .from("reunioes_cliente")
        .select("cliente_notion_id, data_reuniao")
        .eq("gestor_id", colaborador_id)
        .gte("data_reuniao", semanaISO);
      const notionsDaSemana = Array.from(
        new Set((reunioes ?? []).map((r: any) => r.cliente_notion_id).filter(Boolean)),
      );

      for (const notionId of notionsDaSemana) {
        const existe = await jaExisteLancamento({
          colaborador_id,
          mes_referencia: mesISO,
          categoria: "reuniao_cliente",
          criado_desde: semanaISO,
          cliente_id: null,
        });
        // há 1 lançamento por semana do colaborador, mas precisamos garantir 1 por cliente/semana.
        // refinamento: checar descrição contendo o notionId.
        if (existe) {
          const { data: jaComEsseCliente } = await supa
            .from("comarka_pro_lancamentos")
            .select("id")
            .eq("colaborador_id", colaborador_id)
            .eq("categoria", "reuniao_cliente")
            .is("deleted_at", null)
            .gte("criado_em", semanaISO)
            .ilike("descricao", `%${notionId}%`)
            .limit(1);
          if ((jaComEsseCliente ?? []).length > 0) continue;
        }
        await supa.from("comarka_pro_lancamentos").insert({
          colaborador_id,
          mes_referencia: mesISO,
          categoria: "reuniao_cliente",
          pontos: PONTOS_CATEGORIA.reuniao_cliente.pts,
          descricao: `Reunião com cliente ${notionId}`,
          origem: "automatico",
        });
        criados.push(`reuniao:${notionId.slice(0, 6)}`);
      }
    } catch (e: any) {
      console.error("[cron] 3c reuniao_cliente", colaborador_id, e?.message);
    }

    // ---------- 3d. Organização / otimizações no prazo ----------
    try {
      const mesStart = mesISO;
      const { data: otis } = await supa
        .from("otimizacoes_historico")
        .select("id, status, data_confirmacao, created_at")
        .gte("created_at", mesStart);
      const doMes = otis ?? [];
      if (doMes.length > 0) {
        const todasConfirmadas = doMes.every(
          (o: any) => o.status === "confirmada" && o.data_confirmacao != null,
        );
        if (todasConfirmadas) {
          const existe = await jaExisteLancamento({
            colaborador_id,
            mes_referencia: mesISO,
            categoria: "organizacao",
          });
          if (!existe) {
            await supa.from("comarka_pro_lancamentos").insert({
              colaborador_id,
              mes_referencia: mesISO,
              categoria: "organizacao",
              pontos: PONTOS_CATEGORIA.organizacao.pts,
              descricao: "Otimizações do mês no prazo",
              origem: "automatico",
            });
            criados.push("organizacao");
          }
        }
      }
    } catch (e: any) {
      console.error("[cron] 3d organizacao", colaborador_id, e?.message);
    }

    // ---------- recalcular ----------
    if (criados.length > 0) {
      await recalcularPontosMes(colaborador_id, hoje);
    }
    relatorio.push({ colaborador_id, nome: g.nome, criados });
  }

  return NextResponse.json({ ok: true, relatorio });
}
