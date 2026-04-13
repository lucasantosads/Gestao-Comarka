const { Client } = require('pg');
const fs = require('fs');

const run = async () => {
    const client = new Client({
        connectionString: "postgresql://postgres:VittaiaUser2026DBpwd@db.ftmtmzfhysyvkxpukcpa.supabase.co:5432/postgres" // Direct connection
    });

    try {
        await client.connect();
        console.log("🔥 Sucesso: Conectado na raiz do Motor do PostgreSQL Novo!");

        console.log("Lendo e importando os +2500 linhas do schema DDL...");
        const sql = fs.readFileSync('novo_schema.sql', 'utf8');
        await client.query(sql);

        console.log("✅ Ufa! Todas as 72 migrations (Tabelas, RLS e Triggers) importadas com SUCESSO.");
    } catch (err) {
        console.error("❌ Erro critico ao rodar SQL:", err);
    } finally {
        await client.end();
    }
};
run();
