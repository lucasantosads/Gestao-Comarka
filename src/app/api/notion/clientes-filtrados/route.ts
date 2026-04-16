/**
 * GET /api/notion/clientes-filtrados
 *
 * Retorna clientes do Notion, mas filtrados para corresponder aos clientes
 * operacionais de Entradas (ativo | pausado | pagou_integral | parceria).
 *
 * Não altera nada — apenas filtra na camada da dashboard.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getClientes } from "@/lib/data";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

function normalize(s: string): string {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(ltda|me|eireli|dr|dra|advocacia|advogado|advogados|clinica|consultorio|empresa|negocios)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  const matrix: number[][] = [];
  for (let i = 0; i <= shorter.length; i++) matrix[i] = [i];
  for (let j = 0; j <= longer.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= shorter.length; i++) {
    for (let j = 1; j <= longer.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j - 1] + (shorter[i - 1] === longer[j - 1] ? 0 : 1),
        matrix[i][j - 1] + 1,
        matrix[i - 1][j] + 1,
      );
    }
  }
  return (longer.length - matrix[shorter.length][longer.length]) / longer.length;
}

export async function GET() {
  try {
    const [notionClientes, { data: entradasData }] = await Promise.all([
      getClientes(),
      supabase.from("clientes_receita").select("id, nome, status_financeiro, categoria, valor_mensal"),
    ]);
    const entradas = entradasData || [];

    // Clientes operacionais de Entradas (os 90)
    const operacionais = entradas.filter((e) => {
      const sf = e.status_financeiro || "";
      return ["ativo", "pausado", "pagou_integral", "parceria"].includes(sf);
    });

    const operacionaisNorm = operacionais.map((e) => ({ ...e, _norm: normalize(e.nome) }));

    // Buscar todas as teses agregadas por notion_id
    const { data: teses } = await supabase.from("clientes_teses").select("notion_id, orcamento").is("deleted_at", null);
    const tesesMap = new Map<string, number>();
    for (const t of teses || []) {
      tesesMap.set(t.notion_id, (tesesMap.get(t.notion_id) || 0) + Number(t.orcamento || 0));
    }

    // Para cada cliente do Notion, checar se existe match em operacionais
    const filtrados = notionClientes
      .map((n) => {
        const nKey = normalize(n.nome);
        let match = operacionaisNorm.find((e) => e._norm === nKey);
        if (!match) {
          match = operacionaisNorm.find((e) => similarity(nKey, e._norm) >= 0.85);
        }
        if (!match) return null;
        // Soma das teses (se houver) sobrescreve o orcamento do Notion
        const somaTeses = tesesMap.get(n.notion_id) || 0;
        return {
          ...n,
          orcamento: somaTeses > 0 ? String(somaTeses) : n.orcamento,
          tem_teses: somaTeses > 0 ? "true" : "",
          entrada_id: match.id,
          entrada_status_financeiro: match.status_financeiro,
          entrada_categoria: match.categoria || "Advogados",
          entrada_valor_mensal: String(match.valor_mensal || 0),
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    return NextResponse.json(filtrados);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
