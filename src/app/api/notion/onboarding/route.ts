import { NextResponse } from "next/server";
import { getOnboarding } from "@/lib/data";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export async function GET() {
  try {
    // 1. Itens do Notion
    const notionItems = await getOnboarding();

    // 2. Itens locais (criados via CRM "comprou") — notion_id começa com "local_"
    const { data: localItems } = await supabase
      .from("onboarding_notion_mirror")
      .select("*")
      .like("notion_id", "local_%");

    // 3. IDs do Notion para evitar duplicatas (caso mirror tenha cópia)
    const notionIds = new Set(notionItems.map((i) => i.notion_id));

    // 4. Mesclar itens locais no shape OnboardingItem
    const locais = (localItems || [])
      .filter((l) => !notionIds.has(l.notion_id))
      .map((l) => ({
        notion_id: l.notion_id,
        nome: l.nome || "",
        etapa: l.etapa || "Passagem de bastão",
        plataformas: l.plataformas || "",
        orcamento: l.orcamento_mensal ? String(l.orcamento_mensal) : "",
        gestor: l.gestor_trafego || "",
        gestor_junior: l.gestor_junior || "",
        head: l.head_trafego || "",
        comercial: l.comercial || "",
        sucesso: l.sucesso_cliente || "",
        produto: l.produto || "",
      }));

    return NextResponse.json([...notionItems, ...locais]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
