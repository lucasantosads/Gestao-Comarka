import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const oldUrl = 'https://ogfnojbbvumujzfklkhh.supabase.co';
const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const newUrl = 'https://ftmtmzfhysyvkxpukcpa.supabase.co';
const newKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0bXRtemZoeXN5dmt4cHVrY3BhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk2NTc5MiwiZXhwIjoyMDkxNTQxNzkyfQ.mHRWEYOyRRXGHMpdUoz9vcrzSENITQ1beSaE0Uwpsx0';

const oldClient = createClient(oldUrl, oldKey);
const newClient = createClient(newUrl, newKey);

const tablesToFix = ['config_mensal', 'contratos', 'ads_metadata'];

async function fix() {
    console.log('🚀 Iniciando re-importação das 3 tabelas faltantes...');

    for (const table of tablesToFix) {
        console.log(`\n⏳ Lendo tabela: ${table}`);

        let allData = [];
        let start = 0;
        while (true) {
            let { data, error } = await oldClient.from(table).select('*').range(start, start + 999);
            if (error) break;
            if (!data || data.length === 0) break;
            allData = allData.concat(data);
            start += 1000;
            if (data.length < 1000) break;
        }

        if (allData.length > 0) {
            console.log(`✅ [${table}] ${allData.length} registros extraídos. Escrevendo no novo DB...`);

            const generatedCols = ['no_show', 'comissao_dia', 'valor_total_projeto'];
            const conflictKey = table === 'ads_metadata' ? 'ad_id' : 'id';

            const CHUNK_SIZE = 500;
            for (let i = 0; i < allData.length; i += CHUNK_SIZE) {
                const chunk = allData.slice(i, i + CHUNK_SIZE).map(row => {
                    let r = { ...row };

                    // Remover apenas os fields gerados não aceitos no Insert
                    for (let col of generatedCols) delete r[col];

                    // Fix contratos not null migrations clash
                    if (table === 'contratos') {
                        r.data = row.data_fechamento || row.created_at || new Date().toISOString();
                        r.nome_cliente = row.cliente_nome || 'Sem Nome';
                        delete r.mes_referencia; // generated in contratos
                    }

                    return r;
                });

                const { error: insertError } = await newClient.from(table).upsert(chunk, { onConflict: conflictKey, ignoreDuplicates: true });

                if (insertError) {
                    console.error(`❌ Erro inserindo em ${table}:`, insertError.message);
                } else {
                    console.log(`  -> Salvos ${chunk.length} / ${allData.length}`);
                }
            }
        }
    }
    console.log('\n✅✅✅ PATCH CONCLUÍDO!');
}

fix();
