/**
 * POST /api/clientes/sincronizar-ativos
 *
 * Garante que o Notion tenha EXATAMENTE os 90 clientes operacionais de Entradas:
 * - Advogados (ativos com categoria=Advogados)
 * - MDS (ativos com categoria=MDS)
 * - Pagou Integral
 * - Parcerias
 * - Pausados
 *
 * Ações:
 * 1. Para cada cliente operacional de Entradas sem match no Notion → cria no Notion
 * 2. Para clientes do Notion em (Ativo, Planejamento, Pausado, Não iniciado) que
 *    NÃO estão na lista operacional de Entradas → marca como Finalizado no Notion
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getClientes, DB_IDS, updateClienteStatus } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

const NOTION_KEY = process.env.NOTION_API_KEY || "";
const API = "https://api.notion.com/v1";
const HEADERS = {
  Authorization: `Bearer ${NOTION_KEY}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
};

// Mapa: status_financeiro → Notion Status
const SF_TO_NOTION: Record<string, string> = {
  "ativo": "Ativo",
  "pausado": "Pausado",
  "pagou_integral": "Ativo",
  "parceria": "Ativo",
};

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

async function createNotionCliente(nome: string, status: string, orcamento: number) {
  const props: Record<string, unknown> = {
    "Cliente": { title: [{ text: { content: nome } }] },
    "Status": { select: { name: status } },
  };
  if (orcamento > 0) props["Orçamento"] = { number: orcamento };
  const res = await fetch(`${API}/pages`, {
    method: "POST", headers: HEADERS,
    body: JSON.stringify({ parent: { database_id: DB_IDS.clientes }, properties: props }),
  });
  return res.ok;
}

export async function POST() {
  try {
    const [notionClientes, { data: entradasData }] = await Promise.all([
      getClientes(),
      supabase.from("clientes_receita").select("id, nome, status_financeiro, categoria, valor_mensal"),
    ]);
    const entradas = entradasData || [];

    // Filtrar só os operacionais (que contam como ativos)
    const operacionais = entradas.filter((e) => {
      const sf = e.status_financeiro || "";
      return ["ativo", "pausado", "pagou_integral", "parceria"].includes(sf);
    });

    // === FASE 1: garantir que todos os operacionais existam no Notion ===
    const notionByNorm = new Map(notionClientes.map((c) => [normalize(c.nome), c]));
    let criados = 0;
    const matchedNotionIds = new Set<string>();

    for (const e of operacionais) {
      const key = normalize(e.nome);
      // Exact match
      const exact = notionByNorm.get(key);
      if (exact) {
        matchedNotionIds.add(exact.notion_id);
        // Garantir status correto no Notion
        const expectedStatus = SF_TO_NOTION[e.status_financeiro || "ativo"] || "Ativo";
        if (exact.status !== expectedStatus && exact.status !== "Planejamento" && exact.status !== "Não iniciado") {
          await updateClienteStatus(exact.notion_id, expectedStatus);
          await new Promise((r) => setTimeout(r, 100));
        }
        continue;
      }
      // Fuzzy match
      let fuzzyMatched = false;
      for (const n of notionClientes) {
        if (matchedNotionIds.has(n.notion_id)) continue;
        if (similarity(key, normalize(n.nome)) >= 0.85) {
          matchedNotionIds.add(n.notion_id);
          fuzzyMatched = true;
          break;
        }
      }
      if (fuzzyMatched) continue;

      // Não existe → criar
      const status = SF_TO_NOTION[e.status_financeiro || "ativo"] || "Ativo";
      const ok = await createNotionCliente(e.nome, status, Number(e.valor_mensal || 0));
      if (ok) criados++;
      await new Promise((r) => setTimeout(r, 150));
    }

    // === FASE 2: finalizar Notion clients que NÃO estão nos operacionais ===
    // Buscar novamente o Notion atualizado
    const notionAtualizado = await getClientes();
    const operacionaisNorm = new Set(operacionais.map((e) => normalize(e.nome)));

    let finalizados = 0;
    for (const n of notionAtualizado) {
      const statusAtivos = ["Ativo", "Planejamento", "Pausado", "Não iniciado"];
      if (!statusAtivos.includes(n.status)) continue;

      const key = normalize(n.nome);
      const hasMatch = operacionaisNorm.has(key) ||
        operacionais.some((e) => similarity(key, normalize(e.nome)) >= 0.85);
      if (!hasMatch) {
        await updateClienteStatus(n.notion_id, "Finalizado");
        finalizados++;
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    return NextResponse.json({
      total_entradas: entradas.length,
      operacionais_entradas: operacionais.length,
      criados_no_notion: criados,
      finalizados_no_notion: finalizados,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
