-- ============================================
-- DASHBOARD COMERCIAL v2 - Migration
-- Executar no SQL Editor do Supabase
-- ============================================

-- 1. Adicionar campos de auth na tabela closers
ALTER TABLE closers ADD COLUMN IF NOT EXISTS usuario text UNIQUE;
ALTER TABLE closers ADD COLUMN IF NOT EXISTS senha_hash text;

-- 2. Criar tabela de contratos individuais
CREATE TABLE IF NOT EXISTS contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id uuid REFERENCES closers(id) ON DELETE CASCADE,
  lancamento_id uuid REFERENCES lancamentos_diarios(id) ON DELETE CASCADE,
  data date NOT NULL,
  nome_cliente text NOT NULL,
  mrr numeric(10,2) DEFAULT 0,
  ltv numeric(10,2) DEFAULT 0,
  mes_referencia text GENERATED ALWAYS AS (
    extract(year from data)::text || '-' || lpad(extract(month from data)::text, 2, '0')
  ) STORED,
  created_at timestamptz DEFAULT now()
);

-- 3. RLS para contratos
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on contratos" ON contratos FOR ALL USING (true) WITH CHECK (true);

-- 4. Remover colunas obsoletas de config_mensal
ALTER TABLE config_mensal DROP COLUMN IF EXISTS custo_por_reuniao;
ALTER TABLE config_mensal DROP COLUMN IF EXISTS meses_contrato;
