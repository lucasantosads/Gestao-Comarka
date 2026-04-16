/**
 * GET /api/financeiro/custos-fixos — Lista custos fixos
 * PATCH /api/financeiro/custos-fixos — Edita item (folha, fixo ou parcelamento)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 0;

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

export async function GET() {
  try {
    const [{ data: folha, error: e1 }, { data: fixos, error: e2 }, { data: parcelas, error: e3 }] = await Promise.all([
      supabase.from("folha_pagamento").select("*").eq("ativo", true).order("valor_mensal", { ascending: false }),
      supabase.from("custos_fixos").select("*").eq("ativo", true).order("valor", { ascending: false }),
      supabase.from("parcelamentos").select("*").eq("ativo", true).order("valor_parcela", { ascending: false }),
    ]);

    if (e1 || e2 || e3) return NextResponse.json({ error: (e1 || e2 || e3)!.message }, { status: 500 });

    const hoje = new Date();
    const diaHoje = hoje.getDate();

    const folhaItens = (folha || []).map((f) => ({ ...f, valor: Number(f.valor_mensal) }));
    const fixosItens = (fixos || []).map((f) => ({ ...f, valor: Number(f.valor) }));
    const parcelamentosItens = (parcelas || []).map((p) => ({
      ...p, valor: Number(p.valor_parcela),
      parcelas_restantes: p.parcelas_total - p.parcela_atual,
    }));

    const totalFolha = folhaItens.reduce((s, r) => s + r.valor, 0);
    const totalFixos = fixosItens.reduce((s, r) => s + r.valor, 0);
    const totalParcelamentos = parcelamentosItens.reduce((s, r) => s + r.valor, 0);

    // Alertas de pagamentos do dia e próximos 3 dias
    const alertasHoje: { tipo: string; nome: string; valor: number; dia: number; meio: string | null }[] = [];
    const alertasProximos: typeof alertasHoje = [];

    const checkAlerta = (items: { nome?: string; descricao?: string; valor: number; dia_vencimento: number | null; meio_pagamento?: string | null }[], tipo: string) => {
      for (const item of items) {
        const dia = item.dia_vencimento;
        if (!dia) continue;
        const nome = (item as { nome?: string }).nome || (item as { descricao?: string }).descricao || "";
        if (dia === diaHoje) alertasHoje.push({ tipo, nome, valor: item.valor, dia, meio: item.meio_pagamento || null });
        else if (dia > diaHoje && dia <= diaHoje + 3) alertasProximos.push({ tipo, nome, valor: item.valor, dia, meio: item.meio_pagamento || null });
      }
    };
    checkAlerta(folhaItens, "Folha");
    checkAlerta(fixosItens, "Fixo");
    checkAlerta(parcelamentosItens, "Parcelamento");

    // Projeções de parcelamentos acabando
    const projecoes = parcelamentosItens
      .filter((p) => p.parcelas_restantes > 0 && p.parcelas_restantes <= 6)
      .map((p) => {
        const mesesRestantes = p.parcelas_restantes;
        const dataFim = new Date(hoje);
        dataFim.setMonth(dataFim.getMonth() + mesesRestantes);
        return {
          descricao: p.descricao, categoria: p.categoria,
          parcelas_restantes: p.parcelas_restantes,
          valor_parcela: p.valor,
          valor_total_restante: p.valor * p.parcelas_restantes,
          data_fim_estimada: dataFim.toISOString().slice(0, 7),
          reducao_mensal: p.valor,
        };
      })
      .sort((a, b) => a.parcelas_restantes - b.parcelas_restantes);

    // Análise por setor (folha)
    const setores: Record<string, { pessoas: number; total: number }> = {};
    for (const f of folhaItens) {
      const cargo = f.cargo || "Outros";
      const setor = cargoToSetor(cargo);
      if (!setores[setor]) setores[setor] = { pessoas: 0, total: 0 };
      setores[setor].pessoas++;
      setores[setor].total += f.valor;
    }

    // Distribuição percentual de custos
    const totalGeral = totalFolha + totalFixos + totalParcelamentos;
    const distribuicao = {
      folha_pct: totalGeral > 0 ? (totalFolha / totalGeral) * 100 : 0,
      fixos_pct: totalGeral > 0 ? (totalFixos / totalGeral) * 100 : 0,
      parcelamentos_pct: totalGeral > 0 ? (totalParcelamentos / totalGeral) * 100 : 0,
    };

    return NextResponse.json({
      folha: { itens: folhaItens, total: totalFolha, setores },
      fixos: { itens: fixosItens, total: totalFixos },
      parcelamentos: { itens: parcelamentosItens, total: totalParcelamentos },
      total_geral: totalGeral,
      alertas_hoje: alertasHoje,
      alertas_proximos: alertasProximos,
      projecoes,
      distribuicao,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function cargoToSetor(cargo: string): string {
  const c = cargo.toLowerCase();
  if (c.includes("closer") || c.includes("sdr") || c.includes("adm") || c.includes("comercial")) return "Comercial";
  if (c.includes("pleno") || c.includes("junior") || c.includes("head")) return "Operacional";
  if (c.includes("sm") || c.includes("edicao") || c.includes("edição")) return "Marketing";
  if (c.includes("diretor")) return "Diretoria";
  if (c.includes("desenvolv")) return "Tecnologia";
  return "Outros";
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { tabela, id, ...fields } = body;

  if (!tabela || !id) return NextResponse.json({ error: "tabela e id obrigatórios" }, { status: 400 });

  const allowed: Record<string, string[]> = {
    folha_pagamento: ["nome", "cargo", "valor_mensal", "dia_vencimento", "meio_pagamento", "ativo"],
    custos_fixos: ["descricao", "valor", "dia_vencimento", "meio_pagamento", "categoria", "ativo"],
    parcelamentos: ["descricao", "valor_parcela", "dia_vencimento", "meio_pagamento", "parcela_atual", "parcelas_total", "categoria", "ativo"],
  };

  if (!allowed[tabela]) return NextResponse.json({ error: `Tabela ${tabela} inválida` }, { status: 400 });

  const updateData: Record<string, unknown> = {};
  for (const key of allowed[tabela]) {
    if (fields[key] !== undefined) updateData[key] = fields[key];
  }

  if (Object.keys(updateData).length === 0) return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });

  const { data, error } = await supabase.from(tabela).update(updateData).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
