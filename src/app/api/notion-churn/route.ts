/**
 * GET /api/notion-churn
 * Lê dados de churn das databases do Notion.
 */
import { NextResponse } from "next/server";

export const revalidate = 60; // KPI aggregation

const NOTION_KEY = process.env.NOTION_API_KEY || "";
const CHURN_DB = "de30a3018cb04f8c89b22ac53fca026d";
const RATE_DB = "17244a05ec0e4257969c3bbe6334964a";
const HEADERS = {
  Authorization: `Bearer ${NOTION_KEY}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
};

interface ChurnRecord {
  id: string;
  nome: string;
  status: string;
  motivo: string;
  valor: number;
  data: string;
  totalClientes: number;
}

interface ChurnRate {
  mes: string;
  saidas: number;
  totalClientes: number;
  churnRate: number;
}

async function queryDb(dbId: string) {
  const all: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  while (true) {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST", headers: HEADERS, body: JSON.stringify(body),
    });
    if (!res.ok) break;
    const data = await res.json();
    all.push(...data.results);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return all;
}

function getText(prop: Record<string, unknown>): string {
  if (!prop) return "";
  const type = prop.type as string;
  if (type === "title") return ((prop.title as { plain_text: string }[]) || []).map((t) => t.plain_text).join("");
  if (type === "rich_text") return ((prop.rich_text as { plain_text: string }[]) || []).map((t) => t.plain_text).join("");
  if (type === "select") return (prop.select as { name: string } | null)?.name || "";
  if (type === "number") return String(prop.number ?? "");
  if (type === "date") return (prop.date as { start: string } | null)?.start || "";
  return "";
}

export async function GET() {
  if (!NOTION_KEY) return NextResponse.json({ error: "NOTION_API_KEY not set" }, { status: 500 });

  try {
    const [churnRows, rateRows] = await Promise.all([queryDb(CHURN_DB), queryDb(RATE_DB)]);

    const churns: ChurnRecord[] = churnRows.map((r: Record<string, unknown>) => {
      const props = r.properties as Record<string, Record<string, unknown>>;
      return {
        id: r.id as string,
        nome: getText(props.Name),
        status: getText(props.Status),
        motivo: getText(props.Motivo),
        valor: Number(getText(props.Valor)) || 0,
        data: getText(props.Data),
        totalClientes: Number(getText(props["Total de Clientes na data"])) || 0,
      };
    }).sort((a, b) => b.data.localeCompare(a.data));

    const rates: ChurnRate[] = rateRows.map((r: Record<string, unknown>) => {
      const props = r.properties as Record<string, Record<string, unknown>>;
      // Encontrar a chave de saídas dinamicamente (Notion usa \xa0 — non-breaking space)
      const saidasKey = Object.keys(props).find((k) => k.toLowerCase().includes("saída") || k.toLowerCase().includes("saida") || k.toLowerCase().includes("nº")) || "Nº de saídas";
      const totalKey = Object.keys(props).find((k) => k.toLowerCase().includes("total")) || "Total de clientes";
      const churnKey = Object.keys(props).find((k) => k.toLowerCase() === "churn") || "Churn";
      const mesKey = Object.keys(props).find((k) => k.toLowerCase().includes("ano") || k.toLowerCase().includes("mês")) || "Ano/mês";

      const saidas = Number(getText(props[saidasKey])) || 0;
      const total = Number(getText(props[totalKey])) || 0;
      // Tentar pegar o churn da fórmula do Notion (mais preciso) — vem como decimal (0.087)
      const churnFormula = Number(getText(props[churnKey]));
      const churnRate = !isNaN(churnFormula) && churnFormula > 0
        ? churnFormula * 100
        : (total > 0 ? (saidas / total) * 100 : 0);
      return {
        mes: getText(props[mesKey]),
        saidas,
        totalClientes: total,
        churnRate,
      };
    }).sort((a, b) => a.mes.localeCompare(b.mes));

    return NextResponse.json({ churns, rates });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
