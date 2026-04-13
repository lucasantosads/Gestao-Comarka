/**
 * POST /api/team/profile/upload
 * Body: multipart/form-data { file, notion_id, kind: "foto" | "contrato" }
 * Faz upload no bucket privado correspondente e devolve uma signed URL.
 * Permissões: foto = próprio colaborador ou admin; contrato = só admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession, isSuperAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const BUCKETS = {
  foto: "fotos-colaboradores",
  contrato: "contratos-colaboradores",
} as const;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const notionId = String(form.get("notion_id") || "");
  const kind = String(form.get("kind") || "") as keyof typeof BUCKETS;
  if (!file || !notionId || !BUCKETS[kind]) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const admin = session.role === "admin" || isSuperAdmin(session);
  if (kind === "contrato" && !admin) {
    return NextResponse.json({ error: "Apenas admin pode subir contrato" }, { status: 403 });
  }
  if (kind === "foto" && !admin) {
    // valida ownership por primeiro nome (mesma heurística do GET/PATCH)
    const { getTeam } = await import("@/lib/notion");
    const team = await getTeam();
    const member = team.find((m) => m.notion_id.replace(/-/g, "") === notionId.replace(/-/g, ""));
    const sFirst = (session.nome || "").split(" ")[0].toLowerCase();
    const mFirst = (member?.nome || "").split(" ")[0].toLowerCase();
    if (!sFirst || sFirst !== mFirst) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
  }

  const bucket = BUCKETS[kind];
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${notionId}/${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, new Uint8Array(arrayBuffer), { contentType: file.type, upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Signed URL com longa expiração (1 ano) — buckets são privados.
  const { data: signed, error: sErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  // Persiste URL na profile (foto_url ou contrato_url) — same-row upsert
  const field = kind === "foto" ? "foto_url" : "contrato_url";
  await supabase
    .from("team_members_profile")
    .upsert({ notion_id: notionId, [field]: signed.signedUrl }, { onConflict: "notion_id" });

  return NextResponse.json({ success: true, url: signed.signedUrl, path });
}
