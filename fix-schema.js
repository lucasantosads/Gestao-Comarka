const fs = require('fs');
const openapi = JSON.parse(fs.readFileSync('openapi.json', 'utf8'));

// Trata componentes schema (OpenAPI 3) ou definitions (OpenAPI 2)
let defs = openapi.definitions || (openapi.components && openapi.components.schemas);
if (!defs) {
    console.error("Formato OpenAPI desconhecido! Abortando.", Object.keys(openapi));
    process.exit(1);
}

const currentSql = fs.readFileSync('novo_schema.sql', 'utf8');

const regex = /create(.*?)table\s+if\s+not\s+exists\s+(?:public\.)?([a-zA-Z0-9_]+)/gi;
const existingTables = [...currentSql.matchAll(regex)].map(m => m[2].toLowerCase());

console.log("Tabelas documentadas localmente:", existingTables);

let sql = '-- FALLBACK DE CRIACAO DE TABELAS AUSENTES (CRIADAS VIA INTERFACE/OPENAPI)\n\n';

for (const tableName of Object.keys(defs)) {
    if (existingTables.includes(tableName.toLowerCase())) {
        continue;
    }
    console.log("Injetando tabela ausente:", tableName);
    sql += `CREATE TABLE IF NOT EXISTS public."${tableName}" (\n`;
    const columns = [];
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

        let extra = '';
        if (colName === 'id' && type === 'uuid') extra = ' PRIMARY KEY DEFAULT gen_random_uuid()';
        else if (colName === 'id' && type === 'integer') extra = ' PRIMARY KEY';

        columns.push(`  "${colName}" ${type}${extra}`);
    }
    sql += columns.join(',\n') + '\n);\n';
    sql += 'ALTER TABLE public."' + tableName + '" ENABLE ROW LEVEL SECURITY; \n';
    sql += 'CREATE POLICY "Allow_ALL_' + tableName + '" ON public."' + tableName + '" FOR ALL USING (true) WITH CHECK (true);\n\n';
}

fs.writeFileSync('novo_schema.sql', sql + '\n\n' + currentSql);
console.log('Patch OpenAPI finalizado com SUCESSO.');
