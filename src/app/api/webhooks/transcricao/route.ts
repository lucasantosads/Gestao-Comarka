/**
 * POST /api/webhooks/transcricao — tl;dv e Fathom transcrições
 * GET  /api/webhooks/transcricao — Health check (retorna 200 com { status: 'ok' })
 *
 * Recebe transcrições de reuniões e salva em leads_crm ou tabela de reuniões.
 * Se erro: insere em sistema_fila_erros.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  return NextResponse.json({ status: "ok", webhook: "transcricao" });
}

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    await logError("webhook_tldv", "Payload JSON inválido", null);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Detectar origem (tl;dv ou Fathom) pelo payload
  const source = payload.source || payload.provider || "unknown";
  const origem = String(source).toLowerCase().includes("fathom") ? "webhook_fathom" : "webhook_tldv";

  try {
    // Extrair dados da transcrição
    const meetingId = (payload.meeting_id || payload.id || payload.meetingId) as string;
    const title = (payload.title || payload.meeting_title || payload.name || "") as string;
    const transcript = (payload.transcript || payload.transcription || payload.text || "") as string;
    const summary = (payload.summary || payload.ai_summary || "") as string;
    const attendees = payload.attendees || payload.participants || [];
    const recordedAt = (payload.recorded_at || payload.date || payload.created_at || new Date().toISOString()) as string;

    // Tentar salvar na tabela de reuniões do cliente (se existir)
    const { error } = await supabase.from("reunioes_clientes").upsert(
      {
        external_id: meetingId || `${origem}_${Date.now()}`,
        titulo: title,
        transcricao: transcript,
        resumo: summary,
        participantes: attendees,
        fonte: origem === "webhook_fathom" ? "fathom" : "tldv",
        data_reuniao: recordedAt,
        criado_em: new Date().toISOString(),
      },
      { onConflict: "external_id" }
    );

    if (error) {
      // Tabela pode não existir — registrar erro mas não falhar
      console.error(`[webhook/transcricao] Erro ao salvar: ${error.message}`);
      await logError(origem, `Erro ao salvar transcrição: ${error.message}`, payload);
    }

    return NextResponse.json({ ok: true, source: origem, meeting_id: meetingId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logError(origem, msg, payload);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function logError(origem: string, mensagem: string, payload: unknown) {
  try {
    await supabase.from("sistema_fila_erros").insert({
      origem: origem as "webhook_tldv" | "webhook_fathom",
      tipo_erro: "processamento_falhou",
      mensagem,
      payload: payload as Record<string, unknown>,
    });
  } catch {}
}
