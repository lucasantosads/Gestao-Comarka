const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const NOTION_KEY = process.env.NOTION_API_KEY!;
const DATABASE_ID = "135b5b1a-3b98-8080-ae82-fe4635169a02";

const statusMap: Record<string, string> = {
  Oportunidade: "oportunidade",
  "Lead Qualificado": "lead_qualificado",
  "Reunião Agendada": "reuniao_agendada",
  "Proposta enviada": "proposta_enviada",
  "Negociação": "negociacao",
  "Follow-up": "follow_up",
  "No-Show": "no_show",
  Contrato: "assinatura_contrato",
  Comprou: "comprou",
  Desistiu: "desistiu",
};

function getText(prop: any): string | null {
  if (!prop) return null;
  if (prop.type === "rich_text") return prop.rich_text?.[0]?.plain_text || null;
  if (prop.type === "title") return prop.title?.[0]?.plain_text || null;
  if (prop.type === "email") return prop.email || null;
  if (prop.type === "phone_number") return prop.phone_number || null;
  if (prop.type === "url") return prop.url || null;
  return null;
}
function getNum(prop: any): number | null { return prop?.number ?? null; }
function getDate(prop: any): string | null { return prop?.date?.start || null; }
function getSelect(prop: any): string | null { return prop?.select?.name || null; }
function getMulti(prop: any): string | null { return (prop?.multi_select || []).map((o: any) => o.name).join(", ") || null; }
function getStatus(prop: any): string | null { return prop?.status?.name || null; }
function getCreated(prop: any): string | null { return prop?.created_time || null; }

async function queryNotion(cursor?: string) {
  const body: any = { page_size: 100 };
  if (cursor) body.start_cursor = cursor;
  const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${NOTION_KEY}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function upsertSupabase(row: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads_crm`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
}

async function main() {
  let cursor: string | undefined;
  let total = 0;
  let erros = 0;

  console.log("🚀 Iniciando migração do Notion CRM...");

  do {
    const data = await queryNotion(cursor);

    for (const page of data.results || []) {
      try {
        const p = page.properties;
        const statusNotion = getStatus(p["Status"]);
        const etapa = statusNotion ? statusMap[statusNotion] || "oportunidade" : "oportunidade";

        // Find title field
        let nome = "Sem nome";
        for (const key of Object.keys(p)) {
          if (p[key].type === "title" && p[key].title?.[0]?.plain_text) {
            nome = p[key].title[0].plain_text;
            break;
          }
        }

        const preenchido = getCreated(p["Preenchido em:"]) || page.created_time;
        const mesRef = preenchido?.slice(0, 7) || new Date().toISOString().slice(0, 7);

        const row: any = {
          notion_page_id: page.id,
          ghl_contact_id: `notion-${page.id}`,
          nome,
          email: getText(p["E-mail"]),
          telefone: getText(p["Telefone"]),
          instagram: getText(p["Instagram"]),
          site: getText(p["Site"]),
          area_atuacao: getText(p["Area de atuação"]),
          ad_id: getText(p["AD ID"]),
          lead_id: getText(p["Lead ID"]),
          link_proposta: getText(p["Link da proposta"]),
          etapa,
          origem_utm: getSelect(p["Origem (utm_source)"]),
          funil: getMulti(p["Funil"]),
          qualidade_lead: getSelect(p["Qualidade do Lead"]),
          motivo_desistencia: getSelect(p["Motivo da perda"]),
          valor_entrada: getNum(p["Entrada"]),
          mensalidade: getNum(p["Mensalidade"]),
          faturamento: getNum(p["Faturamento"]),
          valor_total_projeto: getNum(p["Total do projeto"]),
          fidelidade_meses: getNum(p["Fidelidade"]),
          agendamento: getDate(p["Agendamento"]),
          data_venda: getDate(p["Data da venda"]),
          follow_up_1: getDate(p["1 Follow up"]),
          follow_up_2: getDate(p["2 Follow up"]),
          primeiro_contato: getDate(p["Primeiro contato"]),
          preenchido_em: preenchido,
          mes_referencia: mesRef,
        };

        if (etapa === "reuniao_agendada") row.data_reuniao_agendada = getDate(p["Agendamento"]);
        if (etapa === "comprou") row.data_comprou = getDate(p["Data da venda"]);

        await upsertSupabase(row);
        total++;
        if (total % 50 === 0) console.log(`✓ ${total} leads migrados...`);
      } catch (err: any) {
        console.error(`❌ Erro "${page.id}":`, err.message?.slice(0, 100));
        erros++;
      }
    }

    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  console.log(`\n✅ Migração concluída! Total: ${total} | Erros: ${erros}`);
}

main().catch(console.error);
