import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getClientes } from "@/lib/data";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\b(ltda|me|eireli|dr|dra|advocacia|advogado|advogados|clinica|consultorio|empresa|negocios)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Levenshtein similarity 0-1
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  // Distance
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
    const [notionClientes, { data: entradasClientes }] = await Promise.all([
      getClientes(),
      supabase.from("clientes_receita").select("id, nome, status, status_financeiro, valor_mensal"),
    ]);

    const entradas = entradasClientes || [];

    // Mapas normalizados
    type NotionC = typeof notionClientes[0];
    type EntradaC = { id: string; nome: string; status: string; status_financeiro: string | null; valor_mensal: number };

    const notionByNorm = new Map<string, NotionC>();
    for (const c of notionClientes) notionByNorm.set(normalize(c.nome), c);

    // Match exact primeiro
    const matched: { entrada: EntradaC; notion: NotionC; similarity: number }[] = [];
    const unmatchedEntradas: EntradaC[] = [];
    const usedNotionIds = new Set<string>();

    for (const e of entradas) {
      const nKey = normalize(e.nome);
      const exact = notionByNorm.get(nKey);
      if (exact && !usedNotionIds.has(exact.notion_id)) {
        matched.push({ entrada: e, notion: exact, similarity: 1 });
        usedNotionIds.add(exact.notion_id);
      } else {
        unmatchedEntradas.push(e);
      }
    }

    // Fuzzy match nas não-matcheadas (threshold >= 0.85)
    const fuzzyMatches: { entrada: EntradaC; notion: NotionC; similarity: number }[] = [];
    const stillUnmatched: EntradaC[] = [];
    const notionAvailable = notionClientes.filter((n) => !usedNotionIds.has(n.notion_id));

    for (const e of unmatchedEntradas) {
      const nKey = normalize(e.nome);
      let best: { notion: NotionC; sim: number } | null = null;
      for (const n of notionAvailable) {
        if (usedNotionIds.has(n.notion_id)) continue;
        const sim = similarity(nKey, normalize(n.nome));
        if (sim >= 0.85 && (!best || sim > best.sim)) {
          best = { notion: n, sim };
        }
      }
      if (best) {
        fuzzyMatches.push({ entrada: e, notion: best.notion, similarity: best.sim });
        usedNotionIds.add(best.notion.notion_id);
      } else {
        stillUnmatched.push(e);
      }
    }

    // Sugestões fuzzy (para os que ainda não bateram): top 3 mais similares
    const sugestoes: { entrada: EntradaC; candidatos: { notion_id: string; nome: string; sim: number }[] }[] = [];
    for (const e of stillUnmatched) {
      const nKey = normalize(e.nome);
      const cands = notionClientes
        .filter((n) => !usedNotionIds.has(n.notion_id))
        .map((n) => ({ notion_id: n.notion_id, nome: n.nome, sim: similarity(nKey, normalize(n.nome)) }))
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 3)
        .filter((c) => c.sim >= 0.5);
      if (cands.length > 0) {
        sugestoes.push({ entrada: e, candidatos: cands });
      }
    }

    // Clientes do Notion que não têm par em Entradas
    const semPar = notionClientes.filter((n) => !usedNotionIds.has(n.notion_id));

    return NextResponse.json({
      total_entradas: entradas.length,
      total_notion: notionClientes.length,
      matched_exact: matched.length,
      matched_fuzzy: fuzzyMatches.length,
      sem_match: stillUnmatched.length - sugestoes.length,
      com_sugestao: sugestoes.length,
      notion_sem_par: semPar.length,
      fuzzyMatches: fuzzyMatches.map((f) => ({
        entrada_id: f.entrada.id, entrada_nome: f.entrada.nome,
        notion_id: f.notion.notion_id, notion_nome: f.notion.nome,
        similarity: Math.round(f.similarity * 100),
      })),
      sugestoes: sugestoes.map((s) => ({
        entrada_id: s.entrada.id, entrada_nome: s.entrada.nome,
        candidatos: s.candidatos,
      })),
      sem_match_final: stillUnmatched.filter((e) => !sugestoes.find((s) => s.entrada.id === e.id)).map((e) => ({
        id: e.id, nome: e.nome, status_financeiro: e.status_financeiro,
      })),
      notion_sem_par_lista: semPar.map((n) => ({ notion_id: n.notion_id, nome: n.nome, status: n.status })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
