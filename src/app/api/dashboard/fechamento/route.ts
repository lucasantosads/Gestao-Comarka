/**
 * GET /api/dashboard/fechamento?nome=<cliente_nome>
 * Retorna SDR e Closer que fecharam o cliente, cruzando contratos por
 * cliente_nome (normalizado), com o contrato mais recente como fonte.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 300;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function normalize(s: string): string {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(ltda|me|eireli|dr|dra|advocacia|advogado|advogados|clinica|consultorio|empresa|negocios)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(req: NextRequest) {
  const nome = req.nextUrl.searchParams.get("nome") || "";
  if (!nome) return NextResponse.json({ error: "nome obrigatório" }, { status: 400 });
  const key = normalize(nome);

  const [{ data: contratos }, { data: sdrs }, { data: closers }] = await Promise.all([
    supabase.from("contratos").select("cliente_nome, sdr_id, closer_id, data_fechamento").order("data_fechamento", { ascending: false }),
    supabase.from("sdrs").select("id, nome"),
    supabase.from("closers").select("id, nome"),
  ]);

  const sdrById = new Map((sdrs || []).map((s: { id: string; nome: string }) => [s.id, s.nome]));
  const closerById = new Map((closers || []).map((c: { id: string; nome: string }) => [c.id, c.nome]));

  const match = (contratos || []).find((c: { cliente_nome: string }) => normalize(c.cliente_nome) === key) as
    | { sdr_id: string | null; closer_id: string | null; data_fechamento: string }
    | undefined;

  return NextResponse.json({
    sdr_id: match?.sdr_id || null,
    closer_id: match?.closer_id || null,
    sdr_nome: match?.sdr_id ? sdrById.get(match.sdr_id) || null : null,
    closer_nome: match?.closer_id ? closerById.get(match.closer_id) || null : null,
    data_fechamento: match?.data_fechamento || null,
  });
}
