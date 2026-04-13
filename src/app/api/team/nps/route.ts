/**
 * GET  /api/team/nps?cliente_notion_id=...      → últimos 24 NPS desse cliente
 * GET  /api/team/nps?global=1                   → agregação para a aba "NPS & Performance"
 * POST /api/team/nps                            → INSERT/UPSERT (1 NPS por cliente por mês)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface NpsRow {
  id: string;
  cliente_notion_id: string;
  gestor_id: string | null;
  nps_score: number;
  nps_comentario: string | null;
  mes_referencia: string;
  created_at: string;
}

function classifyNps(score: number): "promotor" | "neutro" | "detrator" {
  if (score >= 9) return "promotor";
  if (score >= 7) return "neutro";
  return "detrator";
}

function mesKey(d: string): string { return d.slice(0, 7); }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get("cliente_notion_id");
  const isGlobal = searchParams.get("global");

  if (clienteId) {
    const { data, error } = await supabase
      .from("client_nps")
      .select("*")
      .eq("cliente_notion_id", clienteId)
      .order("mes_referencia", { ascending: false })
      .limit(24);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  if (isGlobal) {
    const [{ data: nps, error: e1 }, { data: clientes, error: e2 }] = await Promise.all([
      supabase.from("client_nps").select("*").order("mes_referencia", { ascending: false }),
      supabase.from("clientes_notion_mirror").select("notion_id, cliente, analista"),
    ]);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

    const npsList = (nps || []) as NpsRow[];
    const clientesMap = new Map<string, { nome: string; gestor: string | null }>();
    for (const c of (clientes || []) as Array<{ notion_id: string; cliente: string | null; analista: string | null }>) {
      clientesMap.set(c.notion_id, { nome: c.cliente || "", gestor: c.analista || null });
    }

    // ----- Seção 1: NPS por Cliente (último + variação vs mês anterior + comentário) -----
    const porCliente = new Map<string, { ultimo: NpsRow; anterior: NpsRow | null }>();
    for (const row of npsList) {
      const slot = porCliente.get(row.cliente_notion_id);
      if (!slot) porCliente.set(row.cliente_notion_id, { ultimo: row, anterior: null });
      else if (!slot.anterior) slot.anterior = row;
    }
    const npsPorCliente = Array.from(porCliente.entries()).map(([cid, v]) => {
      const meta = clientesMap.get(cid);
      return {
        cliente_notion_id: cid,
        cliente: meta?.nome || cid,
        gestor: meta?.gestor || "—",
        ultimo_score: v.ultimo.nps_score,
        ultimo_mes: v.ultimo.mes_referencia,
        ultimo_comentario: v.ultimo.nps_comentario,
        variacao: v.anterior ? v.ultimo.nps_score - v.anterior.nps_score : null,
        anterior_score: v.anterior?.nps_score ?? null,
      };
    });

    // ----- Seção 2: NPS por Gestor -----
    const porGestor = new Map<string, { soma: number; n: number }>();
    for (const row of npsList) {
      const meta = clientesMap.get(row.cliente_notion_id);
      const g = meta?.gestor || "—";
      const slot = porGestor.get(g) || { soma: 0, n: 0 };
      slot.soma += row.nps_score;
      slot.n += 1;
      porGestor.set(g, slot);
    }
    const npsPorGestor = Array.from(porGestor.entries())
      .map(([gestor, v]) => ({ gestor, media: v.n > 0 ? v.soma / v.n : 0, total: v.n }))
      .sort((a, b) => b.media - a.media);

    // ----- Seção 3: Visão Geral -----
    const total = npsList.length;
    const mediaGeral = total > 0 ? npsList.reduce((s, r) => s + r.nps_score, 0) / total : 0;
    let promotores = 0, neutros = 0, detratores = 0;
    for (const r of npsList) {
      const c = classifyNps(r.nps_score);
      if (c === "promotor") promotores++;
      else if (c === "neutro") neutros++;
      else detratores++;
    }
    // NPS clássico = %promotores - %detratores
    const npsClassico = total > 0 ? ((promotores - detratores) / total) * 100 : 0;

    // Evolução últimos 6 meses (média do mês)
    const hoje = new Date();
    const meses: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const evolucao = meses.map((mk) => {
      const rows = npsList.filter((r) => mesKey(r.mes_referencia) === mk);
      const media = rows.length > 0 ? rows.reduce((s, r) => s + r.nps_score, 0) / rows.length : null;
      return { mes: mk, media, n: rows.length };
    });

    // Alertas: clientes com queda ≥ 2 pontos vs mês anterior
    const alertas = npsPorCliente
      .filter((c) => c.variacao !== null && c.variacao <= -2)
      .map((c) => ({ cliente: c.cliente, gestor: c.gestor, anterior: c.anterior_score, atual: c.ultimo_score, queda: -c.variacao! }));

    return NextResponse.json({
      npsPorCliente,
      npsPorGestor,
      visaoGeral: {
        total,
        mediaGeral,
        npsClassico,
        promotores,
        neutros,
        detratores,
        distribuicao: [
          { label: "Promotores (9-10)", valor: promotores, cor: "#22c55e" },
          { label: "Neutros (7-8)", valor: neutros, cor: "#eab308" },
          { label: "Detratores (1-6)", valor: detratores, cor: "#ef4444" },
        ],
        evolucao,
      },
      alertas,
    });
  }

  return NextResponse.json({ error: "informe cliente_notion_id ou global=1" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  const { cliente_notion_id, nps_score, nps_comentario, mes_referencia } = body || {};
  if (!cliente_notion_id || !nps_score || !mes_referencia) {
    return NextResponse.json({ error: "cliente_notion_id, nps_score, mes_referencia obrigatórios" }, { status: 400 });
  }
  const score = Number(nps_score);
  if (score < 1 || score > 10) return NextResponse.json({ error: "nps_score deve estar entre 1 e 10" }, { status: 400 });

  // Normaliza mes_referencia para o dia 1
  const mesNorm = mes_referencia.length === 7 ? `${mes_referencia}-01` : mes_referencia;

  const { data, error } = await supabase
    .from("client_nps")
    .upsert({
      cliente_notion_id,
      gestor_id: session?.employeeId || null,
      nps_score: score,
      nps_comentario: nps_comentario || null,
      mes_referencia: mesNorm,
    }, { onConflict: "cliente_notion_id,mes_referencia" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, nps: data });
}
