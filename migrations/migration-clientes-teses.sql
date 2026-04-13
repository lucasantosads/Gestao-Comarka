-- ============================================
-- MIGRATION: Teses por cliente (com orçamento individual)
-- ============================================

CREATE TABLE IF NOT EXISTS clientes_teses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id TEXT NOT NULL,
  tese TEXT NOT NULL,
  orcamento NUMERIC(12,2) DEFAULT 0,
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE clientes_teses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "clientes_teses_all" ON clientes_teses FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_clientes_teses_notion ON clientes_teses(notion_id);
