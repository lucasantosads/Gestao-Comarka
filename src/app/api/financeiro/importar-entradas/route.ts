import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

interface ClienteInput {
  nome: string; plataforma: string; valor_mensal: number; ltv_meses: number | null;
  closer: string; tipo_contrato: string; dia_pagamento: number | null;
  status: string; mes_fechamento: string | null; obs: string | null;
  pagamentos: { mes: number; valor: number; dia: number | null; status: string }[];
}

export async function POST(req: NextRequest) {
  const body = await req.json() as ClienteInput[];
  const erros: string[] = [];
  let importados = 0;

  for (const c of body) {
    const { data: cliente, error: clienteErr } = await supabase
      .from("clientes_receita")
      .upsert({
        nome: c.nome, plataforma: c.plataforma, valor_mensal: c.valor_mensal,
        ltv_meses: c.ltv_meses, closer: c.closer, tipo_contrato: c.tipo_contrato,
        dia_pagamento: c.dia_pagamento, status: c.status,
        mes_fechamento: c.mes_fechamento, obs: c.obs,
      }, { onConflict: "nome" })
      .select("id")
      .single();

    if (clienteErr || !cliente) {
      erros.push(`${c.nome}: ${clienteErr?.message || "erro desconhecido"}`);
      continue;
    }

    for (const p of c.pagamentos) {
      const mesRef = `2026-${String(p.mes).padStart(2, "0")}-01`;
      const { error: pagErr } = await supabase
        .from("pagamentos_mensais")
        .upsert({
          cliente_id: cliente.id, mes_referencia: mesRef,
          valor_pago: p.valor, dia_pagamento: p.dia, status: p.status,
        }, { onConflict: "cliente_id,mes_referencia" });

      if (pagErr) erros.push(`${c.nome} pag ${p.mes}: ${pagErr.message}`);
    }
    importados++;
  }

  return NextResponse.json({ importados, erros });
}
