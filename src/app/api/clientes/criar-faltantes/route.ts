import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getClientes, DB_IDS } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const NOTION_KEY = process.env.NOTION_API_KEY || "";
const API = "https://api.notion.com/v1";
const HEADERS = {
  Authorization: `Bearer ${NOTION_KEY}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
};

// status_financeiro → Notion Status
const SF_TO_NOTION: Record<string, string> = {
  "ativo": "Ativo",
  "pausado": "Pausado",
  "pagou_integral": "Ativo",
  "parceria": "Ativo",
  "churned": "Finalizado",
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
  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `${res.status}: ${err.slice(0, 150)}` };
  }
  return { success: true };
}

export async function POST() {
  try {
    const [notionClientes, { data: entradasData }] = await Promise.all([
      getClientes(),
      supabase.from("clientes_receita").select("id, nome, status, status_financeiro, valor_mensal"),
    ]);
    const entradas = entradasData || [];

    const notionByNorm = new Map<string, typeof notionClientes[0]>();
    for (const c of notionClientes) notionByNorm.set(normalize(c.nome), c);

    const usedNotionIds = new Set<string>();
    const faltantes: { nome: string; status_financeiro: string; valor_mensal: number }[] = [];

    for (const e of entradas) {
      const nKey = normalize(e.nome);
      // 1. Exact match
      const exact = notionByNorm.get(nKey);
      if (exact && !usedNotionIds.has(exact.notion_id)) {
        usedNotionIds.add(exact.notion_id);
        continue;
      }
      // 2. Fuzzy match >= 85%
      let matched = false;
      for (const n of notionClientes) {
        if (usedNotionIds.has(n.notion_id)) continue;
        if (similarity(nKey, normalize(n.nome)) >= 0.85) {
          usedNotionIds.add(n.notion_id);
          matched = true;
          break;
        }
      }
      if (!matched) {
        faltantes.push({
          nome: e.nome,
          status_financeiro: e.status_financeiro || e.status || "ativo",
          valor_mensal: Number(e.valor_mensal || 0),
        });
      }
    }

    // Criar os faltantes no Notion
    let criados = 0;
    const erros: { nome: string; error: string }[] = [];
    for (const f of faltantes) {
      const notionStatus = SF_TO_NOTION[f.status_financeiro] || "Ativo";
      const result = await createNotionCliente(f.nome, notionStatus, f.valor_mensal);
      if (result.success) criados++;
      else erros.push({ nome: f.nome, error: result.error || "?" });
      // Pequeno delay para não sobrecarregar a API do Notion
      await new Promise((r) => setTimeout(r, 150));
    }

    return NextResponse.json({
      total_entradas: entradas.length,
      total_notion_antes: notionClientes.length,
      faltantes_detectados: faltantes.length,
      criados,
      erros: erros.slice(0, 10),
      total_erros: erros.length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
