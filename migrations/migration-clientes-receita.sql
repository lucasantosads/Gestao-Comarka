-- Clientes Receita + Pagamentos Mensais

CREATE TABLE IF NOT EXISTS clientes_receita (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  plataforma text NOT NULL DEFAULT 'META',
  valor_mensal numeric NOT NULL,
  ltv_meses integer,
  closer text NOT NULL,
  tipo_contrato text NOT NULL DEFAULT 'mensal',
  dia_pagamento integer,
  status text NOT NULL DEFAULT 'ativo',
  mes_fechamento date,
  obs text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clientes_receita ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_clientes_receita" ON clientes_receita FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS pagamentos_mensais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES clientes_receita(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  valor_pago numeric,
  dia_pagamento integer,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pagamentos_mensais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_pagamentos" ON pagamentos_mensais FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pagamentos_mes ON pagamentos_mensais(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_pagamentos_cliente ON pagamentos_mensais(cliente_id);
ALTER TABLE pagamentos_mensais ADD CONSTRAINT unique_cliente_mes UNIQUE (cliente_id, mes_referencia);
