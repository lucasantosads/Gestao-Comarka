-- Configuração de compensação por colaborador por mês
CREATE TABLE IF NOT EXISTS compensation_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  mes_referencia text NOT NULL,
  salario_base numeric(10,2) DEFAULT 0,
  comissao_percentual numeric(5,2) DEFAULT 0,
  comissao_base text DEFAULT 'mrr' CHECK (comissao_base IN ('mrr', 'valor_total', 'valor_entrada')),
  bonus_meta_atingida numeric(10,2) DEFAULT 0,
  bonus_meta_superada_pct numeric(5,2) DEFAULT 0,
  ote numeric(10,2) DEFAULT 0,
  vale_alimentacao numeric(10,2) DEFAULT 0,
  vale_transporte numeric(10,2) DEFAULT 0,
  outros_beneficios numeric(10,2) DEFAULT 0,
  descricao_beneficios text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, mes_referencia)
);

ALTER TABLE compensation_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_compensation" ON compensation_config FOR ALL USING (true) WITH CHECK (true);

-- Histórico de pagamentos
CREATE TABLE IF NOT EXISTS payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  mes_referencia text NOT NULL,
  salario_base numeric(10,2) DEFAULT 0,
  comissao_calculada numeric(10,2) DEFAULT 0,
  bonus numeric(10,2) DEFAULT 0,
  beneficios numeric(10,2) DEFAULT 0,
  descontos numeric(10,2) DEFAULT 0,
  descricao_descontos text,
  total_liquido numeric(10,2) DEFAULT 0,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'pago')),
  data_pagamento date,
  obs text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, mes_referencia)
);

ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_payments" ON payment_history FOR ALL USING (true) WITH CHECK (true);
