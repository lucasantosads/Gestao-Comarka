import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface ValorMes { mes: string; valor: number }

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nome, plataforma, valor_mensal, closer, tipo_contrato, dia_pagamento, obs, fidelidade_meses, fidelidade_inicio, valores_por_mes } = body as {
    nome: string; plataforma?: string; valor_mensal: number; closer?: string;
    tipo_contrato?: string; dia_pagamento?: number; obs?: string;
    fidelidade_meses?: number; fidelidade_inicio?: string;
    valores_por_mes?: ValorMes[];
  };
  if (!nome || !valor_mensal) return NextResponse.json({ error: "nome e valor_mensal obrigatórios" }, { status: 400 });

  // Calcular data fim da fidelidade
  let fidelidade_fim: string | null = null;
  if (fidelidade_meses && fidelidade_inicio) {
    const d = new Date(fidelidade_inicio);
    d.setMonth(d.getMonth() + fidelidade_meses);
    fidelidade_fim = d.toISOString().split("T")[0];
  }

  const mesAtual = new Date().toISOString().slice(0, 7) + "-01";
  const { data, error } = await supabase.from("clientes_receita").insert({
    nome, plataforma: plataforma || "META", valor_mensal,
    closer: closer || "", tipo_contrato: tipo_contrato || "mensal",
    dia_pagamento: dia_pagamento || null, status: "ativo",
    mes_fechamento: mesAtual, obs: obs || null,
    fidelidade_meses: fidelidade_meses || null,
    fidelidade_inicio: fidelidade_inicio || null,
    fidelidade_fim: fidelidade_fim,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Se veio array de valores por mês, cria as rows em pagamentos_mensais
  // com status=pendente e valor_esperado definido.
  if (Array.isArray(valores_por_mes) && valores_por_mes.length > 0 && data?.id) {
    const rows = valores_por_mes
      .filter((v) => v && typeof v.valor === "number" && v.valor > 0 && /^\d{4}-\d{2}$/.test(v.mes))
      .map((v) => ({
        cliente_id: data.id,
        mes_referencia: `${v.mes}-01`,
        valor_esperado: v.valor,
        valor_pago: null,
        dia_pagamento: dia_pagamento || null,
        status: "pendente",
      }));
    if (rows.length > 0) {
      const { error: perr } = await supabase
        .from("pagamentos_mensais")
        .upsert(rows, { onConflict: "cliente_id,mes_referencia" });
      if (perr) {
        // Não falha o create do cliente; retorna com aviso.
        return NextResponse.json({ ...data, aviso_valores_por_mes: perr.message });
      }
    }
  }

  return NextResponse.json(data);
}
