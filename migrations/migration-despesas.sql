-- Tabela de despesas
CREATE TABLE IF NOT EXISTS despesas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  data_lancamento date NOT NULL,
  descricao text NOT NULL,
  conta text,
  categoria text NOT NULL,
  valor numeric(10,2) NOT NULL,
  tipo text NOT NULL DEFAULT 'variavel',
  parcela_atual int,
  parcelas_total int,
  mes_referencia text GENERATED ALWAYS AS (to_char(data_lancamento, 'YYYY-MM')) STORED,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_despesas" ON despesas FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_despesas_mes ON despesas(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_despesas_categoria ON despesas(categoria);

-- Tabela de folha de pagamento
CREATE TABLE IF NOT EXISTS folha_pagamento (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  cargo text,
  valor_mensal numeric(10,2) NOT NULL,
  dia_vencimento int,
  meio_pagamento text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE folha_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_folha" ON folha_pagamento FOR ALL USING (true) WITH CHECK (true);
