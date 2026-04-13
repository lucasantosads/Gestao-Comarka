import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface CompConfig {
  salario_base: number;
  comissao_percentual: number;
  comissao_base: "mrr" | "valor_total" | "valor_entrada";
  bonus_meta_atingida: number;
  bonus_meta_superada_pct: number;
  ote: number;
  vale_alimentacao: number;
  vale_transporte: number;
  outros_beneficios: number;
  descricao_beneficios: string | null;
}

interface CompResult {
  salario_base: number;
  comissao_calculada: number;
  comissao_detalhes: { base_nome: string; base_valor: number; percentual: number };
  bonus: number;
  beneficios: number;
  beneficios_detalhes: { va: number; vt: number; outros: number; descricao: string | null };
  total_bruto: number;
  ote: number;
  ote_pct: number;
  meta_atingida: boolean;
  meta_pct: number;
  contratos: number;
}

export async function calculateCompensation(
  employeeId: string,
  role: string,
  entityId: string,
  mesRef: string
): Promise<CompResult | null> {
  // Buscar config
  const { data: config } = await supabase
    .from("compensation_config")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("mes_referencia", mesRef)
    .single();

  if (!config) return null;
  const c = config as CompConfig;

  let baseValor = 0;
  let contratosCount = 0;
  let metaPct = 0;

  if (role === "closer") {
    // Buscar contratos do closer no mês
    const { data: contratos } = await supabase
      .from("contratos")
      .select("mrr, valor_total_projeto, valor_entrada")
      .eq("closer_id", entityId)
      .eq("mes_referencia", mesRef);

    const cts = contratos || [];
    contratosCount = cts.length;

    if (c.comissao_base === "mrr") {
      baseValor = cts.reduce((s, ct) => s + Number(ct.mrr || 0), 0);
    } else if (c.comissao_base === "valor_total") {
      baseValor = cts.reduce((s, ct) => s + Number(ct.valor_total_projeto || 0), 0);
    } else {
      baseValor = cts.reduce((s, ct) => s + Number(ct.valor_entrada || 0), 0);
    }

    // Meta
    const { data: meta } = await supabase
      .from("metas_closers")
      .select("meta_contratos")
      .eq("closer_id", entityId)
      .eq("mes_referencia", mesRef)
      .single();

    if (meta?.meta_contratos) {
      metaPct = (contratosCount / meta.meta_contratos) * 100;
    }
  } else if (role === "sdr") {
    // SDR: comissão baseada em reuniões que viraram contrato
    const { data: reunioes } = await supabase
      .from("reunioes_sdr")
      .select("contrato_id")
      .eq("sdr_id", entityId)
      .eq("mes_referencia", mesRef)
      .not("contrato_id", "is", null);

    contratosCount = (reunioes || []).length;

    // Buscar valor dos contratos associados
    if (contratosCount > 0) {
      const contratoIds = (reunioes || []).map((r) => r.contrato_id).filter(Boolean);
      const { data: cts } = await supabase
        .from("contratos")
        .select("mrr, valor_total_projeto, valor_entrada")
        .in("id", contratoIds);

      const ctsList = cts || [];
      if (c.comissao_base === "mrr") {
        baseValor = ctsList.reduce((s, ct) => s + Number(ct.mrr || 0), 0);
      } else if (c.comissao_base === "valor_total") {
        baseValor = ctsList.reduce((s, ct) => s + Number(ct.valor_total_projeto || 0), 0);
      } else {
        baseValor = ctsList.reduce((s, ct) => s + Number(ct.valor_entrada || 0), 0);
      }
    }

    const { data: meta } = await supabase
      .from("metas_sdr")
      .select("meta_reunioes_agendadas")
      .eq("sdr_id", entityId)
      .eq("mes_referencia", mesRef)
      .single();

    if (meta?.meta_reunioes_agendadas) {
      const { data: lancs } = await supabase
        .from("lancamentos_sdr")
        .select("reunioes_agendadas")
        .eq("sdr_id", entityId)
        .eq("mes_referencia", mesRef);
      const totalReun = (lancs || []).reduce((s, l) => s + Number(l.reunioes_agendadas || 0), 0);
      metaPct = (totalReun / meta.meta_reunioes_agendadas) * 100;
    }
  }

  const comissao = baseValor * (c.comissao_percentual / 100);
  const metaAtingida = metaPct >= 100;
  let bonus = 0;
  if (metaAtingida) {
    bonus = c.bonus_meta_atingida;
    if (metaPct > 100 && c.bonus_meta_superada_pct > 0) {
      bonus += c.bonus_meta_atingida * ((metaPct - 100) / 100) * (c.bonus_meta_superada_pct / 100);
    }
  }

  const beneficios = c.vale_alimentacao + c.vale_transporte + c.outros_beneficios;
  const totalBruto = c.salario_base + comissao + bonus + beneficios;

  const baseNomes = { mrr: "MRR", valor_total: "Valor Total (LTV)", valor_entrada: "Valor de Entrada" };

  return {
    salario_base: c.salario_base,
    comissao_calculada: comissao,
    comissao_detalhes: {
      base_nome: baseNomes[c.comissao_base],
      base_valor: baseValor,
      percentual: c.comissao_percentual,
    },
    bonus,
    beneficios,
    beneficios_detalhes: {
      va: c.vale_alimentacao,
      vt: c.vale_transporte,
      outros: c.outros_beneficios,
      descricao: c.descricao_beneficios,
    },
    total_bruto: totalBruto,
    ote: c.ote,
    ote_pct: c.ote > 0 ? (totalBruto / c.ote) * 100 : 0,
    meta_atingida: metaAtingida,
    meta_pct: metaPct,
    contratos: contratosCount,
  };
}
