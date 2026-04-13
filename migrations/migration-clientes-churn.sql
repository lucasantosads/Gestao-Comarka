-- ============================================================
-- MÓDULO CHURN — Tabela de Clientes + View de Churn Mensal
-- ============================================================

-- 1. Tabela de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  email text,
  telefone text,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_cancelamento date,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'cancelado', 'pausado')),
  motivo_cancelamento text,
  observacao text,
  mrr numeric(12,2) DEFAULT 0,
  closer_id uuid,
  contrato_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_status ON clientes(status);
CREATE INDEX IF NOT EXISTS idx_clientes_data_cancelamento ON clientes(data_cancelamento);

-- RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_clientes" ON clientes FOR ALL USING (true) WITH CHECK (true);

-- 2. View de churn mensal
CREATE OR REPLACE VIEW vw_churn_mensal AS
WITH meses AS (
  SELECT DISTINCT TO_CHAR(data_inicio, 'YYYY-MM') as mes FROM clientes
  UNION
  SELECT DISTINCT TO_CHAR(data_cancelamento, 'YYYY-MM') as mes FROM clientes WHERE data_cancelamento IS NOT NULL
),
dados AS (
  SELECT
    m.mes as mes_referencia,
    -- Clientes ativos no início do mês (entraram antes e não cancelaram antes)
    (SELECT COUNT(*) FROM clientes c
     WHERE c.data_inicio < (m.mes || '-01')::date
     AND (c.data_cancelamento IS NULL OR c.data_cancelamento >= (m.mes || '-01')::date)
    ) as clientes_inicio_mes,
    -- Cancelados no mês
    (SELECT COUNT(*) FROM clientes c
     WHERE c.data_cancelamento IS NOT NULL
     AND TO_CHAR(c.data_cancelamento, 'YYYY-MM') = m.mes
    ) as clientes_cancelados,
    -- MRR perdido
    (SELECT COALESCE(SUM(c.mrr), 0) FROM clientes c
     WHERE c.data_cancelamento IS NOT NULL
     AND TO_CHAR(c.data_cancelamento, 'YYYY-MM') = m.mes
    ) as mrr_perdido,
    -- MRR total no início do mês
    (SELECT COALESCE(SUM(c.mrr), 0) FROM clientes c
     WHERE c.data_inicio < (m.mes || '-01')::date
     AND (c.data_cancelamento IS NULL OR c.data_cancelamento >= (m.mes || '-01')::date)
    ) as mrr_inicio_mes
  FROM meses m
)
SELECT
  mes_referencia,
  clientes_inicio_mes,
  clientes_cancelados,
  CASE WHEN clientes_inicio_mes > 0
    THEN ROUND((clientes_cancelados::numeric / clientes_inicio_mes) * 100, 2)
    ELSE 0
  END as churn_rate,
  mrr_perdido,
  CASE WHEN mrr_inicio_mes > 0
    THEN ROUND((mrr_perdido / mrr_inicio_mes) * 100, 2)
    ELSE 0
  END as mrr_churn_rate
FROM dados
ORDER BY mes_referencia;
