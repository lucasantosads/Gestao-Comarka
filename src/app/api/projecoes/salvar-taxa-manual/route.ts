/**
 * POST /api/projecoes/salvar-taxa-manual
 * Salva uma taxa manual em config_mensal + seta flag _manual = true.
 *
 * Body: { campo: string, valor: number }
 * Campos válidos: funil_lead_para_qualificado, funil_qualificado_para_reuniao,
 *   funil_reuniao_para_proposta, funil_proposta_para_fechamento, noshow_rate
 *
 * NUNCA sobrescreve meta_mrr ou meta_contratos.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CAMPOS_VALIDOS = [
  "funil_lead_para_qualificado",
  "funil_qualificado_para_reuniao",
  "funil_reuniao_para_proposta",
  "funil_proposta_para_fechamento",
  "noshow_rate",
];

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const { campo, valor } = await req.json();

    if (!CAMPOS_VALIDOS.includes(campo)) {
      return NextResponse.json({ error: `Campo "${campo}" não é válido para edição manual` }, { status: 400 });
    }

    if (typeof valor !== "number" || isNaN(valor)) {
      return NextResponse.json({ error: "Valor deve ser numérico" }, { status: 400 });
    }

    const mesAtual = getCurrentMonth();
    const flagCampo = `${campo}_manual`;

    // Upsert: salvar valor + setar flag manual = true
    const { error } = await supabase
      .from("config_mensal")
      .upsert({
        mes_referencia: mesAtual,
        [campo]: valor,
        [flagCampo]: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "mes_referencia" });

    if (error) {
      console.error("[salvar-taxa-manual] Erro:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campo, valor, manual: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
