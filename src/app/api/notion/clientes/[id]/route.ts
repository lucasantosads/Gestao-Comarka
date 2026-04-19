import { NextRequest, NextResponse } from "next/server";
import { getClienteById, getPageContent } from "@/lib/data";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
);

async function getClienteFromMirror(notionId: string) {
  const { data: m } = await supabase
    .from("clientes_notion_mirror")
    .select("*")
    .eq("notion_id", notionId)
    .maybeSingle();
  if (!m) return null;
  return {
    notion_id: m.notion_id,
    nome: m.cliente || "",
    status: m.status || "",
    situacao: m.situacao || "",
    resultados: m.resultados || "",
    atencao: m.atencao || "",
    nicho: m.nicho || "",
    analista: m.analista || "",
    plataformas: [m.fb_url ? "Meta" : "", m.gads_url ? "Google" : "", m.tiktok_url ? "TikTok" : ""].filter(Boolean).join(", "),
    orcamento: m.orcamento != null ? String(m.orcamento) : "",
    dia_otimizacao: m.dia_otimizar || "",
    ultimo_feedback: m.ultimo_feedback || "",
    ultima_otimizacao: m.otimizacao || "",
    pagamento: m.pagamento || "",
    automacao: "",
    fb: m.fb_url || "",
    gads: m.gads_url || "",
    tiktok: m.tiktok_url || "",
    ...(m.raw_properties || {}),
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const isLocalId = id.startsWith("pending_") || id.startsWith("local_");

    if (isLocalId) {
      const cliente = await getClienteFromMirror(id);
      if (!cliente) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ ...cliente, blocks: [] });
    }

    const [cliente, blocks] = await Promise.all([
      getClienteById(id),
      getPageContent(id),
    ]);

    if (cliente) {
      return NextResponse.json({ ...cliente, blocks });
    }

    const mirrorCliente = await getClienteFromMirror(id);
    if (!mirrorCliente) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ...mirrorCliente, blocks: [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
