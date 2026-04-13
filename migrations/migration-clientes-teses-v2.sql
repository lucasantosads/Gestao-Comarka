-- ============================================
-- MIGRATION: Teses v2 — campos estruturados + soft delete
-- ============================================
-- Acrescenta os campos novos na tabela clientes_teses:
--   nome_tese, tipo (Área do Direito), publico_alvo, status,
--   data_ativacao, observacoes, deleted_at
-- Mantém as colunas legadas `tese` e `orcamento` para não quebrar
-- a soma de orçamento que substitui o orçamento principal do cliente.
-- Backfill: copia tese -> nome_tese onde nome_tese estiver vazio.
-- ============================================

-- Cria a tabela base se ainda não existir (idempotente com migration-clientes-teses.sql)
CREATE TABLE IF NOT EXISTS clientes_teses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id TEXT NOT NULL,
  tese TEXT,
  orcamento NUMERIC(12,2) DEFAULT 0,
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE clientes_teses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "clientes_teses_all" ON clientes_teses FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_clientes_teses_notion ON clientes_teses(notion_id);

ALTER TABLE clientes_teses
  ADD COLUMN IF NOT EXISTS nome_tese TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT,
  ADD COLUMN IF NOT EXISTS publico_alvo TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Ativa' CHECK (status IN ('Ativa', 'Pausada', 'Em Teste')),
  ADD COLUMN IF NOT EXISTS data_ativacao DATE,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Backfill: copia nome legado para nome_tese
UPDATE clientes_teses
SET nome_tese = tese
WHERE nome_tese IS NULL OR nome_tese = '';

-- Default data_ativacao para hoje nos registros existentes que não têm
UPDATE clientes_teses
SET data_ativacao = CURRENT_DATE
WHERE data_ativacao IS NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_teses_status ON clientes_teses(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_teses_deleted ON clientes_teses(deleted_at);
