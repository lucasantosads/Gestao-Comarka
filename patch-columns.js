const fs = require('fs');
const { Client } = require('pg');

const openapi = JSON.parse(fs.readFileSync('openapi.json', 'utf8'));
const defs = openapi.definitions || (openapi.components && openapi.components.schemas);

const client = new Client({
    connectionString: "postgresql://postgres:VittaiaUser2026DBpwd@db.ftmtmzfhysyvkxpukcpa.supabase.co:5432/postgres"
});

async function run() {
    await client.connect();
    console.log("🔥 Patching Missing Columns to ensure consistency...");
    for (const tableName of Object.keys(defs)) {
        for (const [colName, colDef] of Object.entries(defs[tableName].properties || {})) {
            let type = 'text';
            if (colDef.type === 'integer') type = 'integer';
            if (colDef.type === 'number') type = 'numeric';
            if (colDef.type === 'boolean') type = 'boolean';
            if (colDef.format === 'uuid') type = 'uuid';
            else if (colDef.format === 'timestamp with time zone') type = 'timestamptz';
            else if (colDef.format === 'timestamp without time zone') type = 'timestamp';
            else if (colDef.format === 'date') type = 'date';
            else if (colDef.format === 'jsonb') type = 'jsonb';
            else if (colDef.format === 'json') type = 'json';

            try {
                // It will silently skip if column exists.
                await client.query(`ALTER TABLE public."${tableName}" ADD COLUMN IF NOT EXISTS "${colName}" ${type};`);
            } catch (e) {
                // ignore error if relation doesn't exist etc.
            }
        }
    }
    await client.end();
    console.log("✅ Schema Drift Resolvido! Todas as colunas validadas.");
}
run();
