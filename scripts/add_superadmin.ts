import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const hash = crypto.createHash('sha256').update('admin123').digest('hex');

async function run() {
    const { error } = await supabase.from('employees').insert({
        nome: 'Super Admin',
        usuario: 'superadmin@admin.com',
        senha_hash: hash,
        role: 'admin',
        ativo: true,
        cargo: 'Diretor'
    });
    if (error) console.error("Erro inserindo superadmin:", error.message);
    else console.log('✅ Superadmin inserido com SUCESSO na nova base!');
}
run();
