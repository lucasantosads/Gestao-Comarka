import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getClientes } from "@/lib/data";

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

async function archivePage(pageId: string): Promise<boolean> {
  const res = await fetch(`${API}/pages/${pageId}`, {
    method: "PATCH", headers: HEADERS,
    body: JSON.stringify({ archived: true }),
  });
  return res.ok;
}

export async function POST() {
  try {
    const [notionClientes, { data: entradasData }] = await Promise.all([
      getClientes(),
      supabase.from("clientes_receita").select("nome"),
    ]);
    const entradas = entradasData || [];

    // Normalizar nomes de Entradas
    const entradasNorm = entradas.map((e) => normalize(e.nome));

    // Para cada cliente do Notion, verificar se tem match em Entradas
    const orfaos: { notion_id: string; nome: string }[] = [];
    for (const n of notionClientes) {
      const nKey = normalize(n.nome);
      // Exact match?
      if (entradasNorm.includes(nKey)) continue;
      // Fuzzy match >= 85%?
      const hasFuzzy = entradasNorm.some((e) => similarity(nKey, e) >= 0.85);
      if (hasFuzzy) continue;
      // Sem match → órfão
      orfaos.push({ notion_id: n.notion_id, nome: n.nome });
    }

    // Arquivar cada órfão
    let arquivados = 0;
    const erros: string[] = [];
    for (const o of orfaos) {
      const ok = await archivePage(o.notion_id);
      if (ok) arquivados++;
      else erros.push(o.nome);
      await new Promise((r) => setTimeout(r, 100));
    }

    return NextResponse.json({
      total_notion_antes: notionClientes.length,
      total_entradas: entradas.length,
      orfaos_detectados: orfaos.length,
      arquivados,
      erros: erros.slice(0, 10),
      total_notion_apos: notionClientes.length - arquivados,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
