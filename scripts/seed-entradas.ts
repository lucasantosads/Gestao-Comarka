/**
 * Seed: importar 50 clientes reais para clientes_receita + pagamentos_mensais
 * Executar: npx tsx scripts/seed-entradas.ts
 */

const BASE = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "https://dashboard-comercial-one.vercel.app";

type Pag = { mes: number; valor: number; dia: number | null; status: string };

interface Cliente {
  nome: string; plataforma: string; valor_mensal: number; ltv_meses: number | null;
  closer: string; tipo_contrato: string; dia_pagamento: number | null;
  status: string; mes_fechamento: string | null; obs: string | null;
  pagamentos: Pag[];
}

function p(mes: number, valor: number, dia?: number): Pag {
  return { mes, valor, dia: dia || null, status: "pago" };
}

const clientes: Cliente[] = [
  { nome: "ARAUJO E SAMPAIO", plataforma: "META", valor_mensal: 2500, ltv_meses: 12, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 1, status: "ativo", mes_fechamento: null, obs: null, pagamentos: [p(1,2500),p(2,2500),p(3,2500),p(4,2500)] },
  { nome: "DARCI ECCEL", plataforma: "META", valor_mensal: 1500, ltv_meses: 3, closer: "Mariana", tipo_contrato: "12M", dia_pagamento: 1, status: "ativo", mes_fechamento: "2026-01-01", obs: "30/01/26 - 30/01/27", pagamentos: [p(2,1500),p(3,1500),p(4,1500)] },
  { nome: "ROSANA E IVO", plataforma: "META", valor_mensal: 1700, ltv_meses: 1, closer: "Mariana", tipo_contrato: "3M", dia_pagamento: 4, status: "ativo", mes_fechamento: "2026-02-01", obs: "3M - 25/02 -25/05", pagamentos: [p(3,1700)] },
  { nome: "MARQUES ADVOGADO", plataforma: "META", valor_mensal: 1500, ltv_meses: 16, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 5, status: "ativo", mes_fechamento: null, obs: null, pagamentos: [p(1,1500),p(2,1500),p(3,1500)] },
  { nome: "CIRILLO ADVOCACIA", plataforma: "META", valor_mensal: 2500, ltv_meses: 4, closer: "Lucas", tipo_contrato: "6M", dia_pagamento: 5, status: "churned", mes_fechamento: null, obs: "Inicio 10/10 até 10/04 - 6M", pagamentos: [p(1,2500)] },
  { nome: "RYAN PYRRHO", plataforma: "META", valor_mensal: 1800, ltv_meses: 10, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 5, status: "ativo", mes_fechamento: null, obs: null, pagamentos: [p(1,1800),p(2,1800),p(3,1800)] },
  { nome: "MACHADO E COSTA", plataforma: "META", valor_mensal: 2500, ltv_meses: 1, closer: "Lucas", tipo_contrato: "3M", dia_pagamento: 5, status: "ativo", mes_fechamento: null, obs: "3 MESES", pagamentos: [p(1,2500),p(2,2500),p(3,2500)] },
  { nome: "JUCIMARCIA", plataforma: "META", valor_mensal: 1500, ltv_meses: 8, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 5, status: "ativo", mes_fechamento: null, obs: null, pagamentos: [p(1,1500),p(3,1500)] },
  { nome: "JULIA REIS DANTAS", plataforma: "META", valor_mensal: 2000, ltv_meses: 5, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 5, status: "ativo", mes_fechamento: null, obs: null, pagamentos: [p(1,2000),p(2,2000),p(3,2000)] },
  { nome: "KAIRO RODRIGUES", plataforma: "META", valor_mensal: 3000, ltv_meses: 2, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 5, status: "churned", mes_fechamento: null, obs: null, pagamentos: [p(1,3000),p(2,3000)] },
  { nome: "ISABELLA GARCIA MENEZES", plataforma: "META", valor_mensal: 1400, ltv_meses: 1, closer: "Mariana", tipo_contrato: "1M", dia_pagamento: 5, status: "ativo", mes_fechamento: "2026-02-01", obs: "1M", pagamentos: [p(3,1400)] },
  { nome: "CLEITON SOUZA", plataforma: "META", valor_mensal: 1500, ltv_meses: 5, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 5, status: "ativo", mes_fechamento: null, obs: null, pagamentos: [p(1,1500),p(2,1500),p(3,1500)] },
  { nome: "FG TREINAMENTOS / EMILY", plataforma: "META", valor_mensal: 2000, ltv_meses: 2, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 5, status: "ativo", mes_fechamento: null, obs: "05/02 - 05/05", pagamentos: [p(2,2000),p(3,2000)] },
  { nome: "HAILTON - CUNHA E NOGUEIRA", plataforma: "META", valor_mensal: 2000, ltv_meses: 2, closer: "Lucas", tipo_contrato: "3M", dia_pagamento: 5, status: "ativo", mes_fechamento: null, obs: "3M | 05/02 - 05/05", pagamentos: [p(2,2000),p(3,2000)] },
  { nome: "RODRIGO MELO", plataforma: "META", valor_mensal: 2497, ltv_meses: 1, closer: "Lucas", tipo_contrato: "3M", dia_pagamento: 10, status: "ativo", mes_fechamento: "2026-02-01", obs: "3M - 25/02 -25/05", pagamentos: [p(2,2497)] },
  { nome: "CLAUDINALLY JUSTULA", plataforma: "META", valor_mensal: 1200, ltv_meses: 1, closer: "Mariana", tipo_contrato: "mensal", dia_pagamento: 10, status: "ativo", mes_fechamento: "2026-02-01", obs: null, pagamentos: [p(2,1200)] },
  { nome: "ANA CAROLINA (CAV)", plataforma: "META", valor_mensal: 1800, ltv_meses: 2, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 10, status: "ativo", mes_fechamento: "2026-03-01", obs: null, pagamentos: [p(3,1800)] },
  { nome: "MATHEUS CAMPELO", plataforma: "META", valor_mensal: 1500, ltv_meses: 1, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 10, status: "ativo", mes_fechamento: "2026-03-01", obs: null, pagamentos: [p(3,1500)] },
  { nome: "LIPORACI ADV", plataforma: "META", valor_mensal: 2000, ltv_meses: 1, closer: "Rogério", tipo_contrato: "mensal", dia_pagamento: 10, status: "ativo", mes_fechamento: "2026-03-01", obs: null, pagamentos: [p(3,1500)] },
  { nome: "CAMILA FERNANDES", plataforma: "META", valor_mensal: 1500, ltv_meses: 1, closer: "Mariana", tipo_contrato: "3M", dia_pagamento: 10, status: "churned", mes_fechamento: "2026-03-01", obs: "3M", pagamentos: [] },
  { nome: "ARTHUR", plataforma: "META", valor_mensal: 1800, ltv_meses: 2, closer: "Rogério", tipo_contrato: "mensal", dia_pagamento: 10, status: "ativo", mes_fechamento: "2026-01-01", obs: "30/01- 30/04", pagamentos: [p(1,1500),p(3,1800)] },
  { nome: "ADRIZZYA/ ARAUJO E CABRAL", plataforma: "META", valor_mensal: 1500, ltv_meses: 3, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 10, status: "ativo", mes_fechamento: null, obs: null, pagamentos: [p(1,1500),p(2,1500),p(3,1500)] },
  { nome: "JAU PIRES", plataforma: "GOOGLE", valor_mensal: 1500, ltv_meses: 21, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 10, status: "ativo", mes_fechamento: null, obs: null, pagamentos: [p(1,1500),p(2,1500),p(3,1500)] },
  { nome: "GONÇALVES E BATISTA", plataforma: "META", valor_mensal: 1800, ltv_meses: 8, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 10, status: "ativo", mes_fechamento: null, obs: null, pagamentos: [p(1,1800),p(2,1800),p(3,1800)] },
  { nome: "VIANA E BRAVIN", plataforma: "META", valor_mensal: 1500, ltv_meses: 1, closer: "Rogério", tipo_contrato: "mensal", dia_pagamento: 10, status: "ativo", mes_fechamento: "2026-03-01", obs: "2- 1800 3- 2000", pagamentos: [p(3,1500)] },
  { nome: "MSL ADVOGADOS", plataforma: "META", valor_mensal: 2200, ltv_meses: 6, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 10, status: "ativo", mes_fechamento: null, obs: null, pagamentos: [p(1,2200),p(2,2200),p(3,2200)] },
  { nome: "FABIO SANTOS", plataforma: "META", valor_mensal: 2000, ltv_meses: 1, closer: "Mariana", tipo_contrato: "3M", dia_pagamento: 10, status: "ativo", mes_fechamento: "2026-02-01", obs: "3M - 25/2 - 25/5", pagamentos: [p(2,2000)] },
  { nome: "PEDRO - CERQUEIRA E SAMPAIO", plataforma: "META", valor_mensal: 1500, ltv_meses: 1, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 10, status: "ativo", mes_fechamento: "2026-03-01", obs: null, pagamentos: [p(3,1500)] },
  { nome: "GABRIEL E LUANA - TELES", plataforma: "META", valor_mensal: 1791, ltv_meses: 3, closer: "Mariana", tipo_contrato: "12M", dia_pagamento: 10, status: "ativo", mes_fechamento: "2026-01-01", obs: "20/01/26 - 20/01/27", pagamentos: [p(1,1791),p(2,1791),p(3,1791)] },
  { nome: "ANA FLAVIA RIBEIRO - AFR", plataforma: "META", valor_mensal: 1800, ltv_meses: 1, closer: "Rogério", tipo_contrato: "mensal", dia_pagamento: 15, status: "ativo", mes_fechamento: "2026-03-01", obs: null, pagamentos: [p(3,1500)] },
  { nome: "DIEGO GONÇALVES", plataforma: "META", valor_mensal: 1500, ltv_meses: 1, closer: "Rogério", tipo_contrato: "mensal", dia_pagamento: 15, status: "ativo", mes_fechamento: "2026-03-01", obs: null, pagamentos: [p(3,1500)] },
  { nome: "MARIANNE ANDRADE", plataforma: "META", valor_mensal: 1500, ltv_meses: 7, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 15, status: "ativo", mes_fechamento: null, obs: null, pagamentos: [p(1,1500),p(2,1500),p(3,1500)] },
  { nome: "RICARDO TRANCOSO", plataforma: "META", valor_mensal: 1500, ltv_meses: 1, closer: "Rogério", tipo_contrato: "mensal", dia_pagamento: 15, status: "ativo", mes_fechamento: "2026-03-01", obs: "terceiro mes 2k", pagamentos: [p(3,1500)] },
  { nome: "KAYNÃ MOTA", plataforma: "META", valor_mensal: 1400, ltv_meses: 21, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 15, status: "ativo", mes_fechamento: null, obs: null, pagamentos: [p(1,1400),p(2,1400),p(3,1400)] },
  { nome: "MSC ADVOGADOS", plataforma: "META", valor_mensal: 1500, ltv_meses: 9, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 15, status: "churned", mes_fechamento: null, obs: null, pagamentos: [p(1,1500),p(2,3000)] },
  { nome: "PEDRO HENRIQUE", plataforma: "META", valor_mensal: 1500, ltv_meses: 16, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 15, status: "churned", mes_fechamento: null, obs: null, pagamentos: [] },
  { nome: "EDIMEIA BEATRIZ", plataforma: "META", valor_mensal: 2000, ltv_meses: 1, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 20, status: "ativo", mes_fechamento: "2026-03-01", obs: null, pagamentos: [p(3,2000)] },
  { nome: "ABREU E ZANOTTO", plataforma: "META", valor_mensal: 2000, ltv_meses: 3, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 20, status: "churned", mes_fechamento: null, obs: null, pagamentos: [p(1,2000),p(2,2000)] },
  { nome: "GABI CANUTO", plataforma: "META", valor_mensal: 2300, ltv_meses: 10, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 20, status: "churned", mes_fechamento: null, obs: null, pagamentos: [p(1,2300),p(2,2300)] },
  { nome: "ANTONIO JORGE", plataforma: "META", valor_mensal: 1500, ltv_meses: 11, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 20, status: "churned", mes_fechamento: null, obs: null, pagamentos: [p(1,1500),p(2,1500)] },
  { nome: "JOSIAS MAIA", plataforma: "META", valor_mensal: 2000, ltv_meses: 10, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 20, status: "ativo", mes_fechamento: null, obs: "retorna 20/1", pagamentos: [p(1,2000),p(2,2000),p(3,2000)] },
  { nome: "MARTINI ADVOCACIA", plataforma: "META", valor_mensal: 1000, ltv_meses: 5, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 20, status: "churned", mes_fechamento: null, obs: "1K POR 3M", pagamentos: [p(1,1000),p(2,1000)] },
  { nome: "JOÃO GOBBO", plataforma: "META", valor_mensal: 1800, ltv_meses: 5, closer: "Lucas", tipo_contrato: "mensal", dia_pagamento: 20, status: "ativo", mes_fechamento: null, obs: null, pagamentos: [p(1,1800),p(2,1800),p(3,1800)] },
  { nome: "RIBEIRO COSTA", plataforma: "META", valor_mensal: 3000, ltv_meses: 2, closer: "Lucas", tipo_contrato: "3M", dia_pagamento: 20, status: "churned", mes_fechamento: null, obs: "3M - 28/01/26 - 28/04", pagamentos: [p(1,3000),p(2,3000)] },
  { nome: "RENATO TORRES", plataforma: "META", valor_mensal: 1500, ltv_meses: 2, closer: "Mariana", tipo_contrato: "3M", dia_pagamento: 20, status: "ativo", mes_fechamento: "2026-01-01", obs: "3M 19/01 ATE 19/04", pagamentos: [p(1,1500),p(2,1500)] },
  { nome: "TEM DIREITO/MARTINS", plataforma: "META", valor_mensal: 1500, ltv_meses: 3, closer: "Mariana", tipo_contrato: "3M", dia_pagamento: 20, status: "ativo", mes_fechamento: "2026-01-01", obs: "3 MESES", pagamentos: [p(1,1500),p(2,1500),p(3,1500)] },
  { nome: "LARISSA CARVALHO SANTANA", plataforma: "META", valor_mensal: 1700, ltv_meses: 3, closer: "Rogério", tipo_contrato: "3M", dia_pagamento: 20, status: "ativo", mes_fechamento: "2026-01-01", obs: "3 MESES", pagamentos: [p(2,1700),p(3,1700)] },
  { nome: "JHULLIANE", plataforma: "META", valor_mensal: 1500, ltv_meses: 2, closer: "Mariana", tipo_contrato: "3M", dia_pagamento: 20, status: "ativo", mes_fechamento: "2026-01-01", obs: "3M 20/01 - 20/04", pagamentos: [p(1,1500),p(2,1500),p(3,1500)] },
  { nome: "FERNANDO MIGUEL", plataforma: "META", valor_mensal: 1500, ltv_meses: 2, closer: "Rogério", tipo_contrato: "3M", dia_pagamento: 20, status: "ativo", mes_fechamento: null, obs: "3M- 1500, 1800, 2000", pagamentos: [p(1,1500),p(2,1500),p(3,1500)] },
  { nome: "JAINE - OLIVEIRA E PERES", plataforma: "META", valor_mensal: 1500, ltv_meses: 1, closer: "Mariana", tipo_contrato: "mensal", dia_pagamento: 20, status: "ativo", mes_fechamento: null, obs: "2K dia 10 + 2x 1.5k", pagamentos: [p(1,1500),p(2,1500),p(3,1500)] },
];

async function run() {
  console.log(`Importando ${clientes.length} clientes...`);
  const res = await fetch(`${BASE}/api/financeiro/importar-entradas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(clientes),
  });
  const data = await res.json();
  console.log(`Importados: ${data.importados}`);
  if (data.erros?.length > 0) console.log("Erros:", data.erros);
}

run().catch(console.error);
