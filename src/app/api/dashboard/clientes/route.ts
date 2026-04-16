/**
 * GET  /api/dashboard/clientes          — lista clientes da Entrada (clientes_receita)
 * PATCH /api/dashboard/clientes          — atualiza um campo editável (status, situacao, etc)
 *
 * Fonte única: clientes_receita (formulário "Entrada"). Cada entrada tem uma row em
 * clientes_notion_mirror linkada por entrada_id (criada automaticamente pelo trigger
 * entrada_to_clientes_mirror — ver migration-fluxo-entrada-clientes.sql). Os campos
 * editáveis (status, situacao, resultados, atencao, analista, etc) são gravados na
 * mirror local. Quando o sync com Notion for desligado, nada quebra.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"), (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"));

function normalize(s: string): string {
  return (s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(ltda|me|eireli|dr|dra|advocacia|advogado|advogados|clinica|consultorio|empresa|negocios)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  const matrix: number[][] = [];
  for (let i = 0; i <= shorter.length; i++) matrix[i] = [i];
  for (let j = 0; j <= longer.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= shorter.length; i++) {
    for (let j = 1; j <= longer.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j - 1] + (shorter[i - 1] === longer[j - 1] ? 0 : 1),
        matrix[i][j - 1] + 1,
        matrix[i - 1][j] + 1,
      );
    }
  }
  return (longer.length - matrix[shorter.length][longer.length]) / longer.length;
}

// Campos da mirror que podem ser atualizados pela UI
const MIRROR_FIELD: Record<string, string> = {
  status: "status",
  situacao: "situacao",
  resultados: "resultados",
  atencao: "atencao",
  nicho: "nicho",
  analista: "analista",
  orcamento: "orcamento",
  dia_otimizacao: "dia_otimizar",
  ultimo_feedback: "ultimo_feedback",
  ultima_otimizacao: "otimizacao",
  pagamento: "pagamento",
};

export async function GET() {
  try {
    const [{ data: mirror }, { data: entradas }, { data: teses }, { data: extras }, { data: reunioes }, { data: contratos }, { data: sdrsData }, { data: closersData }, { data: otimsData }, { data: crmCfgs }] = await Promise.all([
      supabase.from("clientes_notion_mirror").select("*"),
      supabase.from("clientes_receita").select("id, nome, status_financeiro, categoria, valor_mensal"),
      supabase.from("clientes_teses").select("notion_id, orcamento, status, created_at").is("deleted_at", null),
      supabase.from("clientes_extra").select("notion_id, ultima_verificacao, briefing, briefing_preenchido_em"),
      supabase.from("reunioes_cliente").select("cliente_notion_id, data_reuniao").order("data_reuniao", { ascending: false }).limit(500),
      supabase.from("contratos").select("cliente_nome, sdr_id, closer_id, data_fechamento").order("data_fechamento", { ascending: false }),
      supabase.from("sdrs").select("id, nome"),
      supabase.from("closers").select("id, nome"),
      supabase.from("otimizacoes_historico").select("notion_id, data, data_confirmacao, feito").is("deleted_at", null).order("data", { ascending: false }),
      supabase.from("clientes_crm_config").select("cliente_id, ghl_subaccount_id").is("deleted_at", null),
    ]);

    // Fechamento por nome normalizado: pega contrato mais recente
    const sdrById = new Map<string, string>();
    for (const s of (sdrsData || []) as Array<{ id: string; nome: string }>) sdrById.set(s.id, s.nome);
    const closerById = new Map<string, string>();
    for (const c of (closersData || []) as Array<{ id: string; nome: string }>) closerById.set(c.id, c.nome);

    type Fechamento = { sdr_id: string | null; closer_id: string | null; sdr_nome: string | null; closer_nome: string | null };
    const fechamentoByNorm = new Map<string, Fechamento>();
    for (const ct of (contratos || []) as Array<{ cliente_nome: string; sdr_id: string | null; closer_id: string | null }>) {
      const k = normalize(ct.cliente_nome || "");
      if (!k || fechamentoByNorm.has(k)) continue;
      fechamentoByNorm.set(k, {
        sdr_id: ct.sdr_id,
        closer_id: ct.closer_id,
        sdr_nome: ct.sdr_id ? sdrById.get(ct.sdr_id) || null : null,
        closer_nome: ct.closer_id ? closerById.get(ct.closer_id) || null : null,
      });
    }

    const extrasMap = new Map<string, { ultima_verificacao: string | null; briefing: Record<string, unknown> | null; briefing_preenchido_em: string | null }>();
    for (const e of (extras || []) as Array<{ notion_id: string; ultima_verificacao: string | null; briefing: Record<string, unknown> | null; briefing_preenchido_em: string | null }>) {
      extrasMap.set(e.notion_id, { ultima_verificacao: e.ultima_verificacao, briefing: e.briefing, briefing_preenchido_em: e.briefing_preenchido_em });
    }
    const ultimaReuniaoMap = new Map<string, string>();
    for (const r of (reunioes || []) as Array<{ cliente_notion_id: string; data_reuniao: string }>) {
      if (!ultimaReuniaoMap.has(r.cliente_notion_id)) ultimaReuniaoMap.set(r.cliente_notion_id, r.data_reuniao);
    }

    // Fonte única: clientes_receita. Só clientes em status operacional aparecem.
    const operacionais = (entradas || []).filter((e) => {
      const sf = (e as { status_financeiro: string }).status_financeiro || "";
      return ["ativo", "pausado", "pagou_integral", "parceria"].includes(sf);
    }) as Array<{ id: string; nome: string; status_financeiro: string; categoria: string | null; valor_mensal: number }>;

    const tesesMap = new Map<string, number>();
    type TeseRow = { notion_id: string; orcamento: number | null; status: string | null; created_at: string };
    const tesesByNotion = new Map<string, TeseRow[]>();
    for (const t of (teses || []) as TeseRow[]) {
      tesesMap.set(t.notion_id, (tesesMap.get(t.notion_id) || 0) + Number(t.orcamento || 0));
      const arr = tesesByNotion.get(t.notion_id) || [];
      arr.push(t);
      tesesByNotion.set(t.notion_id, arr);
    }

    // Última otimização por cliente (com data_confirmacao) para alertas
    const otimByNotion = new Map<string, { data: string; data_confirmacao: string | null }>();
    for (const o of (otimsData || []) as Array<{ notion_id: string; data: string; data_confirmacao: string | null }>) {
      if (!otimByNotion.has(o.notion_id)) otimByNotion.set(o.notion_id, { data: o.data, data_confirmacao: o.data_confirmacao });
    }

    // CRM config indexado por cliente_id (=notion_id)
    const crmByNotion = new Map<string, string | null>();
    for (const c of (crmCfgs || []) as Array<{ cliente_id: string; ghl_subaccount_id: string | null }>) {
      crmByNotion.set(c.cliente_id, c.ghl_subaccount_id);
    }

    // Index do mirror por entrada_id (primário) e por nome normalizado (fallback de transição)
    type MirrorRow = {
      notion_id: string; cliente: string | null; status: string | null; situacao: string | null;
      resultados: string | null; atencao: string | null; nicho: string | null; analista: string | null;
      orcamento: number | null; orcamento_inicial: number | null; orcamento_atualizado_em: string | null; dia_otimizar: string | null; ultimo_feedback: string | null;
      otimizacao: string | null; pagamento: string | null; fb_url: string | null; gads_url: string | null;
      tiktok_url: string | null; raw_properties: Record<string, unknown> | null; entrada_id: string | null;
    };
    const mirrorByEntrada = new Map<string, MirrorRow>();
    const mirrorByNorm = new Map<string, MirrorRow>();
    for (const m of (mirror || []) as MirrorRow[]) {
      if (m.entrada_id) mirrorByEntrada.set(m.entrada_id, m);
      else mirrorByNorm.set(normalize(m.cliente || ""), m);
    }

    // Itera entradas (fonte única) e pega mirror correspondente
    const result = operacionais
      .map((match) => {
        let m = mirrorByEntrada.get(match.id);
        if (!m) {
          // Fallback de transição: tenta linkar por nome enquanto o trigger não rodou
          const nKey = normalize(match.nome);
          m = mirrorByNorm.get(nKey);
          if (!m) {
            mirrorByNorm.forEach((v, k) => {
              if (!m && similarity(nKey, k) >= 0.85) m = v;
            });
          }
        }
        if (!m) {
          // Sem mirror ainda — retorna esqueleto com status padrão
          m = {
            notion_id: `pending_${match.id}`, cliente: match.nome, status: "Não iniciado",
            situacao: null, resultados: null, atencao: null, nicho: null, analista: null,
            orcamento: null, orcamento_inicial: null, orcamento_atualizado_em: null, dia_otimizar: null, ultimo_feedback: null, otimizacao: null,
            pagamento: null, fb_url: null, gads_url: null, tiktok_url: null,
            raw_properties: null, entrada_id: match.id,
          };
        }

        const somaTeses = tesesMap.get(m.notion_id) || 0;
        // raw_properties contém o snapshot completo do cliente como veio do Notion
        // (todos os campos extras que a UI possa precisar). Espalhamos primeiro,
        // depois sobrescrevemos com os campos canônicos da mirror para garantir
        // que edições feitas via PATCH apareçam mesmo se raw_properties estiver stale.
        const raw = (m.raw_properties || {}) as Record<string, unknown>;
        return {
          ...raw,
          notion_id: m.notion_id,
          nome: m.cliente || (raw.nome as string) || "",
          status: m.status ?? (raw.status as string) ?? "",
          situacao: m.situacao ?? (raw.situacao as string) ?? "",
          resultados: m.resultados ?? (raw.resultados as string) ?? "",
          atencao: m.atencao ?? (raw.atencao as string) ?? "",
          nicho: m.nicho ?? (raw.nicho as string) ?? "",
          analista: m.analista ?? (raw.analista as string) ?? "",
          orcamento: somaTeses > 0 ? String(somaTeses) : (m.orcamento != null ? String(m.orcamento) : (raw.orcamento as string) || ""),
          orcamento_inicial: m.orcamento_inicial != null ? String(m.orcamento_inicial) : "",
          orcamento_atualizado_em: m.orcamento_atualizado_em || "",
          tem_teses: somaTeses > 0 ? "true" : "",
          dia_otimizacao: m.dia_otimizar ?? (raw.dia_otimizacao as string) ?? "",
          ultimo_feedback: m.ultimo_feedback ?? (raw.ultimo_feedback as string) ?? "",
          ultima_otimizacao: m.otimizacao ?? (raw.ultima_otimizacao as string) ?? "",
          pagamento: m.pagamento ?? (raw.pagamento as string) ?? "",
          fb: m.fb_url ?? (raw.fb as string) ?? "",
          gads: m.gads_url ?? (raw.gads as string) ?? "",
          tiktok: m.tiktok_url ?? (raw.tiktok as string) ?? "",
          plataformas: [
            (m.fb_url || raw.fb) ? "Meta" : "",
            (m.gads_url || raw.gads) ? "Google" : "",
            (m.tiktok_url || raw.tiktok) ? "TikTok" : "",
          ].filter(Boolean).join(", "),
          entrada_id: match.id,
          entrada_status_financeiro: match.status_financeiro,
          entrada_categoria: match.categoria || "Advogados",
          entrada_valor_mensal: String(match.valor_mensal || 0),
          ultima_verificacao: extrasMap.get(m.notion_id)?.ultima_verificacao || null,
          briefing_preenchido: !!extrasMap.get(m.notion_id)?.briefing,
          ultima_reuniao: ultimaReuniaoMap.get(m.notion_id) || null,
          // Fechamento: cruza clientes_receita.nome ↔ contratos.cliente_nome (normalizado),
          // pega o contrato mais recente e resolve via tabelas sdrs/closers.
          fechamento: fechamentoByNorm.get(normalize(match.nome)) || { sdr_id: null, closer_id: null, sdr_nome: null, closer_nome: null },
          // Dados para regras de alertas (Fase 7)
          teses_count: (tesesByNotion.get(m.notion_id) || []).length,
          teses_ativas_count: (tesesByNotion.get(m.notion_id) || []).filter((t) => t.status === "Ativa").length,
          primeira_tese_created_at: (tesesByNotion.get(m.notion_id) || [])[0]?.created_at || null,
          ultima_otimizacao_data: otimByNotion.get(m.notion_id)?.data || null,
          ultima_otimizacao_confirmada_em: otimByNotion.get(m.notion_id)?.data_confirmacao || null,
          ghl_subaccount_id: crmByNotion.get(m.notion_id) || null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { notion_id, field, value } = body;
    if (!notion_id || !field) {
      return NextResponse.json({ error: "notion_id e field obrigatórios" }, { status: 400 });
    }
    const col = MIRROR_FIELD[field];
    if (!col) return NextResponse.json({ error: `campo ${field} não editável` }, { status: 400 });

    const update: Record<string, unknown> = { [col]: value };
    if (col === "orcamento") update[col] = value ? Number(value) : null;

    // notion_id="pending_<entrada_id>" significa que o trigger ainda não rodou —
    // criar a mirror row na hora vinculada à entrada.
    if (notion_id.startsWith("pending_")) {
      const entradaId = notion_id.replace("pending_", "");
      const { data: entrada } = await supabase.from("clientes_receita").select("nome").eq("id", entradaId).maybeSingle();
      const newNotionId = `local_${crypto.randomUUID()}`;
      const { error: insErr } = await supabase.from("clientes_notion_mirror").insert({
        notion_id: newNotionId,
        cliente: entrada?.nome || "",
        status: "Não iniciado",
        entrada_id: entradaId,
        ...update,
      });
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      return NextResponse.json({ success: true, notion_id: newNotionId });
    }

    const { error } = await supabase.from("clientes_notion_mirror").update(update).eq("notion_id", notion_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
