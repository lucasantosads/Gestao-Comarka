-- ============================================
-- MIGRATION: performance_manual — dados manuais por nicho/tese/cliente/mês
-- ============================================

CREATE TABLE IF NOT EXISTS performance_manual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nicho_id UUID REFERENCES nichos(id),
  tese_id UUID REFERENCES teses(id),
  cliente_id TEXT,
  mes_referencia TEXT NOT NULL,
  contratos_fechados INT DEFAULT 0,
  faturamento_total NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(nicho_id, tese_id, cliente_id, mes_referencia)
);

ALTER TABLE performance_manual ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "performance_manual_all" ON performance_manual FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_perf_manual_nicho ON performance_manual(nicho_id);
CREATE INDEX IF NOT EXISTS idx_perf_manual_tese ON performance_manual(tese_id);
CREATE INDEX IF NOT EXISTS idx_perf_manual_mes ON performance_manual(mes_referencia);
