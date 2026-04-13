import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function PUT(req: NextRequest) {
  const { cliente_id, mes_referencia, valor_pago, dia_pagamento, status: statusInput, justificativa, mes_pagamento } = await req.json();
  if (!cliente_id || !mes_referencia) return NextResponse.json({ error: "cliente_id e mes_referencia obrigatórios" }, { status: 400 });

  const isPago = statusInput === "perdoado" ? true : valor_pago > 0;
  const finalStatus = statusInput === "perdoado" ? "perdoado" : (valor_pago > 0 ? "pago" : "pendente");

  const hoje = new Date();
  const mesPag = mes_pagamento || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("pagamentos_mensais")
    .upsert({
      cliente_id, mes_referencia,
      valor_pago: valor_pago || 0,
      dia_pagamento: dia_pagamento || null,
      status: finalStatus,
      justificativa: statusInput === "perdoado" ? (justificativa || null) : null,
      mes_pagamento: mesPag,
    }, { onConflict: "cliente_id,mes_referencia" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Atualizar LTV: contar total de pagamentos pagos deste cliente
  if (isPago) {
    const { data: allPags } = await supabase
      .from("pagamentos_mensais")
      .select("id")
      .eq("cliente_id", cliente_id)
      .eq("status", "pago");

    const totalMeses = (allPags || []).length;
    await supabase.from("clientes_receita").update({ ltv_meses: totalMeses }).eq("id", cliente_id);
  }

  return NextResponse.json(data);
}
