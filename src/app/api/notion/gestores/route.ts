/**
 * GET /api/notion/gestores
 * Lista apenas os membros do Time Operacional (Diretor, Head, Gestor Pleno, Junior, Desenvolvimento).
 * Cruza os usuários do Notion com o time operacional.
 */
import { NextResponse } from "next/server";
import { getTeam } from "@/lib/data";

export const dynamic = "force-dynamic";

const NOTION_KEY = process.env.NOTION_API_KEY || "";
const HEADERS = {
  Authorization: `Bearer ${NOTION_KEY}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
};

// Cargos que fazem parte do Time Operacional
function isOperacional(cargo: string): boolean {
  const c = (cargo || "").toLowerCase();
  return c.includes("diretor") || c.includes("ceo")
    || c.includes("head") || c.includes("pleno") || c.includes("junior")
    || c.includes("trafego") || c.includes("tráfego") || c.includes("desenvolv");
}

function normalizeName(s: string): string {
  return (s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export async function GET() {
  try {
    // 1. Buscar usuários do Notion
    const res = await fetch("https://api.notion.com/v1/users?page_size=100", { headers: HEADERS });
    if (!res.ok) return NextResponse.json([], { status: 200 });
    const data = await res.json();
    const people = (data.results || []).filter((u: { type: string }) => u.type === "person");

    // 2. Buscar time e identificar operacionais
    const team = await getTeam();
    const operacionaisNames = new Set(
      team.filter((m) => isOperacional(m.cargo)).map((m) => normalizeName(m.nome))
    );

    // 3. Filtrar users que estão no time operacional (match por nome)
    const filtered = people
      .map((p: { id: string; name?: string; person?: { email?: string } }) => {
        const nomeNotion = p.name || "";
        const nomeNorm = normalizeName(nomeNotion);
        // Match por nome completo ou primeiro nome
        const isOp = operacionaisNames.has(nomeNorm)
          || Array.from(operacionaisNames).some((n) => n.split(" ")[0] === nomeNorm.split(" ")[0]);
        return isOp ? { id: p.id, nome: nomeNotion, email: p.person?.email || "" } : null;
      })
      .filter((x: { id: string; nome: string; email: string } | null): x is { id: string; nome: string; email: string } => x !== null)
      .sort((a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome));

    return NextResponse.json(filtered);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
