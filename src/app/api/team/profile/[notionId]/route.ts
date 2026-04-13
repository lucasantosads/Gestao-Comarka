/**
 * GET   /api/team/profile/[notionId]   — devolve o profile do colaborador (ou esqueleto vazio)
 * PATCH /api/team/profile/[notionId]   — atualiza campos. Cada chamada respeita as permissões:
 *                                        - Próprio colaborador: foto_url, chave_pix, bio
 *                                        - Admin/super-admin: todos os campos
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession, isSuperAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SELF_FIELDS = new Set(["foto_url", "chave_pix", "bio"]);
const ADMIN_FIELDS = new Set([
  "foto_url", "chave_pix", "bio",
  "data_entrada", "cargo", "salario_base", "contrato_url", "handbook_url",
]);

async function isOwner(notionId: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  // Heurística usada no resto do app: match por primeiro nome.
  // (a lista de membros vem do Notion via getTeam — não há FK direta com employees)
  const { getTeam } = await import("@/lib/notion");
  const team = await getTeam();
  const member = team.find((m) => m.notion_id.replace(/-/g, "") === notionId.replace(/-/g, ""));
  if (!member) return false;
  const sessionFirst = (session.nome || "").split(" ")[0].toLowerCase();
  const memberFirst = (member.nome || "").split(" ")[0].toLowerCase();
  return !!sessionFirst && sessionFirst === memberFirst;
}

export async function GET(_req: NextRequest, { params }: { params: { notionId: string } }) {
  const { data, error } = await supabase
    .from("team_members_profile")
    .select("*")
    .eq("notion_id", params.notionId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const session = await getSession();
  const owner = await isOwner(params.notionId);
  const admin = !!session && (session.role === "admin" || isSuperAdmin(session));

  return NextResponse.json({
    profile: data || { notion_id: params.notionId },
    permissions: { canEdit: owner || admin, canEditAdminFields: admin, isOwner: owner },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { notionId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const owner = await isOwner(params.notionId);
  const admin = session.role === "admin" || isSuperAdmin(session);
  if (!owner && !admin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const allowed = admin ? ADMIN_FIELDS : SELF_FIELDS;
  const body = await req.json();
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (allowed.has(k)) update[k] = v;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nenhum campo permitido para atualização" }, { status: 400 });
  }

  // Upsert para criar a row se ainda não existe
  const { error } = await supabase
    .from("team_members_profile")
    .upsert({ notion_id: params.notionId, ...update }, { onConflict: "notion_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
