/**
 * GET  /api/onboarding/checklist/[notion_id] — lista os items do checklist deste cliente.
 *                                              Na primeira chamada, popula a partir do template.
 * PATCH /api/onboarding/checklist/[notion_id] { id, checked } — toggle de um item
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

async function ensureItems(notionId: string) {
  const { data: existing } = await supabase
    .from("onboarding_checklist_items")
    .select("template_item_id")
    .eq("notion_id", notionId);

  const existingTemplateIds = new Set((existing || []).map((i) => i.template_item_id).filter(Boolean));

  const { data: template } = await supabase
    .from("onboarding_template_items")
    .select("id, ordem, secao, texto")
    .order("ordem");

  const toInsert = (template || []).filter((t) => !existingTemplateIds.has(t.id));
  if (toInsert.length > 0) {
    await supabase.from("onboarding_checklist_items").insert(
      toInsert.map((t) => ({
        notion_id: notionId,
        template_item_id: t.id,
        secao: t.secao,
        texto: t.texto,
        ordem: t.ordem,
        checked: false,
      }))
    );
  }
}

async function syncTrackingCounts(notionId: string) {
  const { data: items } = await supabase
    .from("onboarding_checklist_items")
    .select("checked")
    .eq("notion_id", notionId);
  const total = (items || []).length;
  const done = (items || []).filter((i) => i.checked).length;
  await supabase.from("onboarding_tracking")
    .update({ checklist_total: total, checklist_done: done, updated_at: new Date().toISOString() })
    .eq("notion_id", notionId);
}

export async function GET(_req: NextRequest, { params }: { params: { notion_id: string } }) {
  const notionId = params.notion_id;
  if (!notionId) return NextResponse.json({ error: "notion_id obrigatório" }, { status: 400 });

  await ensureItems(notionId);
  await syncTrackingCounts(notionId);

  const { data, error } = await supabase
    .from("onboarding_checklist_items")
    .select("*")
    .eq("notion_id", notionId)
    .order("ordem", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function PATCH(req: NextRequest, { params }: { params: { notion_id: string } }) {
  const notionId = params.notion_id;
  const { id, checked } = await req.json();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { error } = await supabase
    .from("onboarding_checklist_items")
    .update({ checked: !!checked, checked_at: checked ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("notion_id", notionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await syncTrackingCounts(notionId);
  return NextResponse.json({ success: true });
}
