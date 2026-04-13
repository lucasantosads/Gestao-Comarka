import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getClientes } from "@/lib/data";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Mapeia Notion Status → Entradas status_financeiro
const NOTION_TO_ENTRADAS: Record<string, string> = {
  "Ativo": "ativo",
  "Planejamento": "ativo",
  "Pausado": "pausado",
  "Aviso 30 dias": "pausado",
  "Inadimplente": "pausado",
  "Finalizado": "churned",
  "Não iniciado": "ativo",
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function GET() {
  try {
    const [notionClientes, { data: entradasClientes }] = await Promise.all([
      getClientes(),
      supabase.from("clientes_receita").select("id, nome, status, status_financeiro, valor_mensal"),
    ]);

    const entradas = entradasClientes || [];
    const entradasMap = new Map<string, typeof entradas[0]>();
    for (const c of entradas) entradasMap.set(normalizeName(c.nome), c);

    const notionMap = new Map<string, typeof notionClientes[0]>();
    for (const c of notionClientes) notionMap.set(normalizeName(c.nome), c);

    // Comparar
    const divergentes: {
      nome: string; notion_id: string | null; entrada_id: string | null;
      notion_status: string; entrada_status: string; notion_esperado_em_entradas: string;
    }[] = [];
    const soNotion: { nome: string; notion_id: string; status: string }[] = [];
    const soEntradas: { nome: string; entrada_id: string; status: string }[] = [];

    for (const nc of notionClientes) {
      const key = normalizeName(nc.nome);
      const ec = entradasMap.get(key);
      if (!ec) {
        soNotion.push({ nome: nc.nome, notion_id: nc.notion_id, status: nc.status });
        continue;
      }
      const esperado = NOTION_TO_ENTRADAS[nc.status] || "ativo";
      const entradaStatus = ec.status_financeiro || ec.status || "";
      if (esperado !== entradaStatus) {
        divergentes.push({
          nome: nc.nome, notion_id: nc.notion_id, entrada_id: ec.id,
          notion_status: nc.status, entrada_status: entradaStatus, notion_esperado_em_entradas: esperado,
        });
      }
    }

    for (const ec of entradas) {
      const key = normalizeName(ec.nome);
      if (!notionMap.has(key)) {
        soEntradas.push({ nome: ec.nome, entrada_id: ec.id, status: ec.status_financeiro || ec.status || "" });
      }
    }

    return NextResponse.json({
      total_notion: notionClientes.length,
      total_entradas: entradas.length,
      divergentes,
      so_notion: soNotion,
      so_entradas: soEntradas,
      resumo: {
        divergentes: divergentes.length,
        so_notion: soNotion.length,
        so_entradas: soEntradas.length,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
