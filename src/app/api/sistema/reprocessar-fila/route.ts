/**
 * POST /api/sistema/reprocessar-fila
 * Protegido por CRON_SECRET. Vercel Cron diariamente às 07h.
 * Não executa aos sábados e domingos.
 *
 * Para cada erro pendente com tentativas < max_tentativas:
 * - Reenvia payload para o endpoint correspondente
 * - Se sucesso: status = 'resolvido'
 * - Se falhou e tentativas = max_tentativas: status = 'falhou', alerta WhatsApp
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppText } from "@/lib/evolution";
import { clearMetaCache } from "@/lib/meta-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mapeamento de origem para endpoint de reprocessamento
function getReprocessUrl(origem: string): string | null {
  const baseUrl = process.env.VERCEL_PROJECT_URL || process.env.NEXT_PUBLIC_VERCEL_URL || "";
  if (!baseUrl) return null;
  const protocol = baseUrl.startsWith("http") ? "" : "https://";
  const base = `${protocol}${baseUrl}`;

  const map: Record<string, string> = {
    webhook_ghl: `${base}/api/webhooks/ghl`,
    webhook_tldv: `${base}/api/webhooks/transcricao`,
    webhook_fathom: `${base}/api/webhooks/transcricao`,
    webhook_asaas: `${base}/api/webhooks/asaas`,
  };
  return map[origem] || null;
}

export async function POST(req: NextRequest) {
  // Validar CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verificar dia da semana (0=domingo, 6=sábado)
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Fim de semana" });
  }

  const adminPhone = process.env.ADMIN_WHATSAPP || "";

  // Buscar erros pendentes com tentativas < max_tentativas
  const { data: erros } = await supabase
    .from("sistema_fila_erros")
    .select("*")
    .eq("status", "pendente")
    .order("criado_em", { ascending: true })
    .limit(50);

  if (!erros || erros.length === 0) {
    return NextResponse.json({ ok: true, processados: 0 });
  }

  let resolvidos = 0;
  let falhos = 0;

  for (const erro of erros) {
    if (erro.tentativas >= erro.max_tentativas) continue;

    // Marcar como processando e incrementar tentativas
    await supabase
      .from("sistema_fila_erros")
      .update({
        status: "processando",
        tentativas: erro.tentativas + 1,
      })
      .eq("id", erro.id);

    let sucesso = false;

    try {
      if (erro.origem === "meta_api") {
        // Para Meta API: limpar cache e considerar resolvido
        clearMetaCache();
        sucesso = true;
      } else {
        // Para webhooks: reenviar payload
        const url = getReprocessUrl(erro.origem);
        if (url && erro.payload) {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(erro.payload),
          });
          sucesso = res.ok;
        } else if (!erro.payload) {
          // Sem payload para reenviar — marcar como resolvido
          sucesso = true;
        }
      }
    } catch {
      sucesso = false;
    }

    if (sucesso) {
      await supabase
        .from("sistema_fila_erros")
        .update({
          status: "resolvido",
          resolvido_em: new Date().toISOString(),
        })
        .eq("id", erro.id);
      resolvidos++;
    } else {
      const novasTentativas = erro.tentativas + 1;
      const novoStatus = novasTentativas >= erro.max_tentativas ? "falhou" : "pendente";

      await supabase
        .from("sistema_fila_erros")
        .update({
          status: novoStatus,
          proxima_tentativa_em: novoStatus === "pendente"
            ? new Date(Date.now() + 3600000).toISOString()
            : null,
        })
        .eq("id", erro.id);

      if (novoStatus === "falhou") {
        falhos++;
        if (adminPhone) {
          await sendWhatsAppText(
            adminPhone,
            `\u26A0\uFE0F *Erro não resolvido após ${erro.max_tentativas} tentativas*\nOrigem: ${erro.origem}\n${erro.mensagem.slice(0, 200)}`
          );
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    total: erros.length,
    resolvidos,
    falhos,
    pendentes: erros.length - resolvidos - falhos,
  });
}
