/**
 * Importar despesas do Excel para Supabase
 *
 * Uso: npx tsx scripts/seed-despesas.ts <caminho-do-xlsx>
 *
 * Lê a aba "Lançamento de despesa":
 *   A (data) | B (descrição) | C (conta) | D (categoria) | E (valor)
 *
 * Detecta parcelamentos por regex "X/Y" na descrição
 * Categorias de folha → tipo='fixo', Ads → skip, demais → 'variavel'
 */

import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const FIXO_CATS = ["Equipe Operacional", "Equipe Comercial", "Equipe de MKT", "Prolabore", "Aluguel", "Internet", "Energia", "Contador", "Limpeza"];

async function main() {
  const filePath = process.argv[2];
  if (!filePath) { console.error("Uso: npx tsx scripts/seed-despesas.ts <arquivo.xlsx>"); process.exit(1); }

  const wb = XLSX.readFile(filePath);

  // Aba "Lançamento de despesa"
  const sheetName = wb.SheetNames.find((s) => s.toLowerCase().includes("lan")) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];

  console.log(`Lendo aba: ${sheetName} (${rows.length} linhas)`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rawData = row[0];
    const descricao = String(row[1] || "").trim();
    const conta = String(row[2] || "").trim() || null;
    const categoria = String(row[3] || "").trim();
    const rawValor = row[4];

    if (!rawData || !rawValor || !categoria) { skipped++; continue; }
    if (categoria === "Ads") { skipped++; continue; }

    // Parse data
    let data_lancamento: string;
    if (typeof rawData === "number") {
      const d = XLSX.SSF.parse_date_code(rawData);
      data_lancamento = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    } else {
      const d = new Date(String(rawData));
      if (isNaN(d.getTime())) { skipped++; continue; }
      data_lancamento = d.toISOString().split("T")[0];
    }

    const valor = Math.abs(Number(rawValor));
    if (valor <= 0) { skipped++; continue; }

    // Detectar parcelamento
    let tipo = FIXO_CATS.includes(categoria) ? "fixo" : "variavel";
    let parcela_atual: number | null = null;
    let parcelas_total: number | null = null;
    const match = descricao.match(/(\d+)\s*\/\s*(\d+)/);
    if (match) {
      parcela_atual = parseInt(match[1]);
      parcelas_total = parseInt(match[2]);
      tipo = "parcelamento";
    }

    const { error } = await supabase.from("despesas").insert({
      data_lancamento, descricao, conta, categoria, valor, tipo,
      parcela_atual, parcelas_total,
    });

    if (error) { console.error(`Erro linha ${i + 1}: ${error.message}`); errors++; }
    else { inserted++; }
  }

  console.log(`\nResultado:`);
  console.log(`  Inseridos: ${inserted}`);
  console.log(`  Pulados: ${skipped}`);
  console.log(`  Erros: ${errors}`);

  // Aba "Custos fixos" - Folha de pagamento
  const folhaSheet = wb.SheetNames.find((s) => s.toLowerCase().includes("custo") || s.toLowerCase().includes("fixo"));
  if (folhaSheet) {
    const ws2 = wb.Sheets[folhaSheet];
    const rows2 = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: null }) as unknown[][];
    console.log(`\nLendo folha: ${folhaSheet} (${rows2.length} linhas)`);

    let folhaInserted = 0;
    for (let i = 1; i < Math.min(rows2.length, 20); i++) {
      const row = rows2[i];
      const nome = String(row[0] || "").trim();
      const cargo = String(row[1] || "").trim() || null;
      const rawVal = row[2];
      if (!nome || !rawVal) continue;
      const valor_mensal = Math.abs(Number(rawVal));
      if (valor_mensal <= 0) continue;

      const dia_vencimento = row[3] ? Number(row[3]) : null;
      const meio_pagamento = row[4] ? String(row[4]).trim() : null;

      const { error } = await supabase.from("folha_pagamento").upsert(
        { nome, cargo, valor_mensal, dia_vencimento, meio_pagamento, ativo: true },
        { onConflict: "nome" }
      );
      if (error) console.error(`Folha ${nome}: ${error.message}`);
      else folhaInserted++;
    }
    console.log(`  Folha inseridos: ${folhaInserted}`);
  }
}

main().catch(console.error);
