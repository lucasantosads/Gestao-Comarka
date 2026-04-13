const fs = require('fs');
const https = require('https');

const API_KEY = 'sbp_cacff619be703fc9db7bc910c8cbb077a639c700';

const req = https.request('https://api.supabase.com/v1/projects/ftmtmzfhysyvkxpukcpa/api-keys', {
    headers: {
        'Authorization': `Bearer ${API_KEY}`
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('API_KEYS:', data));
});
req.on('error', console.error);
req.end();

// Build schema script
const files = [
    'schema.sql',
    'migration-v2.sql',
    'migration-trafego-pago-v2.sql',
    'migration-alertas-config.sql',
    'migration-relatorio-config.sql',
    'migration-leads-attribution-trigger.sql',
    'trigger-auto-leads-v2.sql',
    'migration-add-columns.sql'
];

let finalSql = '-- SCRIPT DE INICIALIZAÇÃO GERADO AUTOMATICAMENTE\n\n';
for (const file of files) {
    try {
        const content = fs.readFileSync(`./migrations/${file}`, 'utf8');
        finalSql += `-- ========================\n-- ${file}\n-- ========================\n\n${content}\n\n`;
    } catch (e) {
        console.error(`Erro lendo ${file}:`, e.message);
    }
}
fs.writeFileSync('novo_schema.sql', finalSql);
console.log('novo_schema.sql criado com sucesso!');
