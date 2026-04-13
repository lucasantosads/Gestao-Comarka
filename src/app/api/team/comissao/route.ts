/**
 * GET   /api/team/comissao?notion_id=...&mes=YYYY-MM
 *       Calcula a comissão do colaborador no mês solicitado.
 *       Retorna { cargo, meta, realizado, pctAtingido, comissao, faixaAtualLabel,
 *                 proximaFaixa, detalhe, config, historico, permissions }
 *
 * PATCH /api/team/comissao
 *       Body: { notion_id, mes, cargo, meta_reunioes_mes?, meta_vendas_mes?, ote_base? }
 *       Apenas admin/super-admin. UPSERT em team_commission_config.
 *
 * Mapeamento employee↔notion_id usa a mesma heurística do resto do app:
 * primeiro nome do membro do Notion (getTeam) bate com primeiro nome do
 * employee (case-insensitive).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession, isSuperAdmin } from "@/lib/session";
import { calcularComissaoSdr, calcularComissaoCloser, type CargoComissao, type ComissaoResultado } from "@/lib/comissao";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface ResolvedMember {
  notionId: string;
  nome: string;
  cargo: CargoComissao;
  employeeId: string | null;
  closerId: string | null;
  sdrId: string | null;
}

async function resolveMember(notionId: string): Promise<ResolvedMember | null> {
  const { getTeam } = await import("@/lib/notion");
  const team = await getTeam();
  const member = team.find((m) => m.notion_id.replace(/-/g, "") === notionId.replace(/-/g, ""));
  if (!member) return null;

  const cargoLower = (member.cargo || "").toLowerCase();
  let cargo: CargoComissao | null = null;
  if (cargoLower.includes("closer")) cargo = "closer";
  else if (cargoLower.includes("social seller") || cargoLower.includes("social_seller")) cargo = "social_seller";
  else if (cargoLower.includes("sdr")) cargo = "sdr";
  if (!cargo) return null;

  const firstName = member.nome.split(" ")[0];
  const ilike = `%${firstName}%`;

  const [empRes, closerRes, sdrRes] = await Promise.all([
    supabase.from("employees").select("id").ilike("nome", ilike).maybeSingle(),
    cargo === "closer"
      ? supabase.from("closers").select("id").ilike("nome", ilike).maybeSingle()
      : Promise.resolve({ data: null }),
    cargo === "sdr" || cargo === "social_seller"
      ? supabase.from("sdrs").select("id").ilike("nome", ilike).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    notionId,
    nome: member.nome,
    cargo,
    employeeId: (empRes.data as { id: string } | null)?.id || null,
    closerId: (closerRes.data as { id: string } | null)?.id || null,
    sdrId: (sdrRes.data as { id: string } | null)?.id || null,
  };
}

async function loadConfigPara(employeeId: string, mes: string): Promise<{
  meta_reunioes_mes: number | null;
  meta_vendas_mes: number | null;
  ote_base: number | null;
  mes_referencia: string;
} | null> {
  // Tenta a row do mês exato; se não houver, pega a mais recente <= mes.
  const mesIso = `${mes}-01`;
  const { data: exato } = await supabase
    .from("team_commission_config")
    .select("meta_reunioes_mes, meta_vendas_mes, ote_base, mes_referencia")
    .eq("colaborador_id", employeeId)
    .eq("mes_referencia", mesIso)
    .maybeSingle();
  if (exato) return exato;

  const { data: anterior } = await supabase
    .from("team_commission_config")
    .select("meta_reunioes_mes, meta_vendas_mes, ote_base, mes_referencia")
    .eq("colaborador_id", employeeId)
    .lte("mes_referencia", mesIso)
    .order("mes_referencia", { ascending: false })
    .limit(1)
    .maybeSingle();
  return anterior || null;
}

async function realizadoSdr(sdrId: string, mes: string): Promise<number> {
  const { data } = await supabase
    .from("lancamentos_diarios")
    .select("reunioes_feitas")
    .eq("sdr_id", sdrId)
    .eq("mes_referencia", mes);
  return (data || []).reduce((s: number, l: { reunioes_feitas: number }) => s + (l.reunioes_feitas || 0), 0);
}

async function realizadoCloser(closerId: string, mes: string): Promise<number> {
  const { data } = await supabase
    .from("contratos")
    .select("mrr")
    .eq("closer_id", closerId)
    .eq("mes_referencia", mes);
  return (data || []).reduce((s: number, c: { mrr: number | null }) => s + Number(c.mrr || 0), 0);
}

function mesAtualISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mesAnterior(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function calcularPara(member: ResolvedMember, mes: string): Promise<{
  resultado: ComissaoResultado | null;
  config: { meta_reunioes_mes: number | null; meta_vendas_mes: number | null; ote_base: number | null; mes_referencia: string } | null;
}> {
  const cfg = member.employeeId ? await loadConfigPara(member.employeeId, mes) : null;

  if (member.cargo === "sdr" || member.cargo === "social_seller") {
    const meta = Number(cfg?.meta_reunioes_mes || 0);
    const realizado = member.sdrId ? await realizadoSdr(member.sdrId, mes) : 0;
    const r = calcularComissaoSdr({ comparecimentos: realizado, metaReunioes: meta });
    return { resultado: { ...r, cargo: member.cargo }, config: cfg };
  }
  if (member.cargo === "closer") {
    const meta = Number(cfg?.meta_vendas_mes || 0);
    const realizado = member.closerId ? await realizadoCloser(member.closerId, mes) : 0;
    return { resultado: calcularComissaoCloser({ totalVendido: realizado, metaVendas: meta }), config: cfg };
  }
  return { resultado: null, config: cfg };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const notionId = searchParams.get("notion_id");
  const mes = searchParams.get("mes") || mesAtualISO();
  if (!notionId) return NextResponse.json({ error: "notion_id obrigatório" }, { status: 400 });

  const member = await resolveMember(notionId);
  if (!member) {
    // Membro existe mas não tem cargo de comissão — retorna 200 com resultado vazio
    // para que o frontend oculte o card sem poluir logs com 404.
    const session = await getSession();
    const isAdmin = !!session && (session.role === "admin" || isSuperAdmin(session));
    return NextResponse.json({
      member: null,
      mes,
      resultado: null,
      config: null,
      historico: [],
      permissions: { canView: isAdmin, canEditConfig: isAdmin },
      reason: "sem_cargo_comissao",
    });
  }

  const { resultado, config } = await calcularPara(member, mes);

  // Histórico dos últimos 6 meses (incluindo o atual)
  const historico: Array<{ mes: string; comissao: number; meta: number; realizado: number; pctAtingido: number }> = [];
  for (let i = 0; i < 6; i++) {
    const m = mesAnterior(mes, i);
    const { resultado: r } = await calcularPara(member, m);
    if (r) historico.push({ mes: m, comissao: r.comissao, meta: r.meta, realizado: r.realizado, pctAtingido: r.pctAtingido });
  }

  const session = await getSession();
  const isAdmin = !!session && (session.role === "admin" || isSuperAdmin(session));
  const isOwner = !!session && (session.nome || "").split(" ")[0].toLowerCase() === member.nome.split(" ")[0].toLowerCase();

  return NextResponse.json({
    member: { notion_id: member.notionId, nome: member.nome, cargo: member.cargo },
    mes,
    resultado,
    config,
    historico,
    permissions: {
      canView: isAdmin || isOwner,
      canEditConfig: isAdmin,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const isAdmin = session.role === "admin" || isSuperAdmin(session);
  if (!isAdmin) return NextResponse.json({ error: "Apenas admin pode configurar metas" }, { status: 403 });

  const body = await req.json();
  const { notion_id, mes, cargo, meta_reunioes_mes, meta_vendas_mes, ote_base } = body || {};
  if (!notion_id || !mes || !cargo) {
    return NextResponse.json({ error: "notion_id, mes e cargo obrigatórios" }, { status: 400 });
  }

  const member = await resolveMember(notion_id);
  if (!member?.employeeId) return NextResponse.json({ error: "Colaborador não encontrado em employees" }, { status: 404 });

  const { error } = await supabase
    .from("team_commission_config")
    .upsert({
      colaborador_id: member.employeeId,
      cargo,
      mes_referencia: `${mes}-01`,
      meta_reunioes_mes: meta_reunioes_mes != null ? Number(meta_reunioes_mes) : null,
      meta_vendas_mes: meta_vendas_mes != null ? Number(meta_vendas_mes) : null,
      ote_base: ote_base != null ? Number(ote_base) : null,
    }, { onConflict: "colaborador_id,mes_referencia" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
