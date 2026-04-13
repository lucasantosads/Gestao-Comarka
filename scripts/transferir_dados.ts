import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const oldUrl = 'https://ogfnojbbvumujzfklkhh.supabase.co';
const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const newUrl = 'https://ftmtmzfhysyvkxpukcpa.supabase.co';
const newKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0bXRtemZoeXN5dmt4cHVrY3BhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk2NTc5MiwiZXhwIjoyMDkxNTQxNzkyfQ.mHRWEYOyRRXGHMpdUoz9vcrzSENITQ1beSaE0Uwpsx0';

if (!oldKey) {
    throw new Error("Faltando SUPABASE_SERVICE_ROLE_KEY em .env.local");
}

const oldClient = createClient(oldUrl, oldKey);
const newClient = createClient(newUrl, newKey);

// Ordem corrigida (ads_metadata antes de leads_crm por causa de triggers)
const tablesToDump = [
    'closers',
    'sdrs',
    'config_mensal',
    'metas_closers',
    'metas_sdr',
    'metas_mensais',
    'ads_metadata',
    'ads_performance',
    'leads_crm',
    'leads_crm_historico',
    'leads_ads_attribution',
    'leads_stages_history',
    'contratos',
    'lancamentos_diarios',
    'lancamentos_sdr',
    'alertas_config',
    'alertas_snooze',
    'relatorio_config'
];

async function migrate() {
    console.log('🚀 Iniciando extração e injecção massiva de dados (Via REST API)...');

    for (const table of tablesToDump) {
        console.log(`\n⏳ Lendo tabela: ${table}`);

        let allData = [];
        let start = 0;
        while (true) {
            let { data, error } = await oldClient.from(table).select('*').range(start, start + 999);
            if (error) {
                if (error.code !== "42P01") {
                    console.error(`Erro buscando ${table}:`, error.message);
                }
                break;
            }
            if (!data || data.length === 0) break;
            allData = allData.concat(data);
            start += 1000;
            if (data.length < 1000) break;
        }

        if (allData.length > 0) {
            console.log(`✅ [${table}] ${allData.length} registros extraídos. Escrevendo no novo DB...`);

            const generatedCols = ['no_show', 'comissao_dia', 'mes_referencia', 'valor_total_projeto'];
            const CHUNK_SIZE = 500;

            for (let i = 0; i < allData.length; i += CHUNK_SIZE) {
                const chunk = allData.slice(i, i + CHUNK_SIZE).map(row => {
                    let r = { ...row };
                    for (let col of generatedCols) delete r[col];
                    return r;
                });

                const { error: insertError } = await newClient.from(table).upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });

                if (insertError) {
                    console.error(`❌ Erro inserindo em ${table}:`, insertError.message);
                } else {
                    console.log(`  -> Salvos ${chunk.length} / ${allData.length}`);
                }
            }
        } else {
            console.log(`ℹ️ [${table}] Vazia. Pulo.`);
        }
    }

    console.log('\n✅✅✅ MIGRAÇÃO DE DADOS CONCLUÍDA COM SUCESSO!');
}

migrate();
