/**
 * POST /api/financeiro/exportar
 * Gera CSV com dados financeiros do mês para contador. (admin only)
 * Body: { mes: "2026-04", tipo: "csv" }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")
);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { mes, tipo } = await req.json();
  if (!mes) return NextResponse.json({ error: "mes obrigatório" }, { status: 400 });

  const mesDate = `${mes}-01`;
  const [y, m] = mes.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const mesFim = `${mes}-${String(lastDay).padStart(2, "0")}`;

  // Buscar dados
  const [
    { data: pagamentos },
    { data: despesas },
    { data: folha },
    { data: margens },
  ] = await Promise.all([
    supabase
      .from("pagamentos_mensais")
      .select("cliente_id, valor_pago, status, mes_referencia")
      .eq("mes_referencia", mesDate)
      .eq("status", "pago"),
    supabase
      .from("despesas")
      .select("descricao, categoria, valor, data_lancamento")
      .eq("mes_referencia", mes)
      .is("deleted_at", null),
    supabase
      .from("custos_fixos_pagamentos")
      .select("tipo, valor_pago, status")
      .eq("mes_referencia", mes)
      .eq("status", "pago"),
    supabase
      .from("financeiro_margem_cliente")
      .select("*, clientes(nome)")
      .eq("mes_referencia", mesDate)
      .is("deleted_at", null),
  ]);

  // Buscar nomes dos clientes para pagamentos
  const clienteIds = [...new Set((pagamentos || []).map((p) => p.cliente_id).filter(Boolean))];
  const { data: clientesData } = clienteIds.length > 0
    ? await supabase.from("clientes_receita").select("id, nome").in("id", clienteIds)
    : { data: [] };
  const nomeMap = new Map((clientesData || []).map((c) => [c.id, c.nome]));

  const totalReceita = (pagamentos || []).reduce((s, p) => s + (p.valor_pago || 0), 0);
  const totalDespesas = (despesas || []).reduce((s, d) => s + (d.valor || 0), 0);
  const totalFolha = (folha || []).reduce((s, f) => s + (f.valor_pago || 0), 0);
  const resultado = totalReceita - totalDespesas - totalFolha;

  if (tipo === "csv") {
    const lines: string[] = [];
    lines.push("Tipo,Descrição,Categoria,Valor");
    lines.push("");
    lines.push("--- RECEITAS ---,,,");
    for (const p of pagamentos || []) {
      const nome = nomeMap.get(p.cliente_id) || "Cliente";
      lines.push(`Receita,"${nome}",Mensalidade,${(p.valor_pago || 0).toFixed(2)}`);
    }
    lines.push(`TOTAL RECEITAS,,,${totalReceita.toFixed(2)}`);
    lines.push("");
    lines.push("--- DESPESAS ---,,,");
    for (const d of despesas || []) {
      lines.push(`Despesa,"${d.descricao}","${d.categoria}",${(d.valor || 0).toFixed(2)}`);
    }
    lines.push(`TOTAL DESPESAS,,,${totalDespesas.toFixed(2)}`);
    lines.push("");
    lines.push("--- FOLHA ---,,,");
    for (const f of folha || []) {
      lines.push(`Folha,"${f.tipo}",Folha,${(f.valor_pago || 0).toFixed(2)}`);
    }
    lines.push(`TOTAL FOLHA,,,${totalFolha.toFixed(2)}`);
    lines.push("");
    lines.push(`RESULTADO LÍQUIDO,,,${resultado.toFixed(2)}`);

    if ((margens || []).length > 0) {
      lines.push("");
      lines.push("--- MARGEM POR CLIENTE ---,,,");
      lines.push("Cliente,Receita,Custo Mídia,Custo Gestor,Margem Bruta,Margem Líquida,Margem %");
      for (const mg of margens || []) {
        const nome = (mg.clientes as { nome?: string })?.nome || "—";
        lines.push(`"${nome}",${mg.receita},${mg.custo_midia},${mg.custo_gestor},${mg.margem_bruta},${mg.margem_liquida},${mg.margem_pct}%`);
      }
    }

    const csv = lines.join("\n");

    // Registrar exportação
    await supabase.from("financeiro_exportacoes").insert({
      mes_referencia: mesDate,
      tipo: "csv",
      gerado_por: session.employeeId,
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="financeiro_${mes}.csv"`,
      },
    });
  }

  // PDF: retornar dados estruturados para o front gerar
  await supabase.from("financeiro_exportacoes").insert({
    mes_referencia: mesDate,
    tipo: "pdf",
    gerado_por: session.employeeId,
  });

  return NextResponse.json({
    mes,
    receitas: { items: (pagamentos || []).map((p) => ({ nome: nomeMap.get(p.cliente_id) || "Cliente", valor: p.valor_pago })), total: totalReceita },
    despesas: { items: despesas || [], total: totalDespesas },
    folha: { items: folha || [], total: totalFolha },
    resultado,
    margens: margens || [],
  });
}
