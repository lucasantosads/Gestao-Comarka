-- ============================================
-- MIGRATION: Otimizações — soft delete + snapshot de métricas
-- ============================================
-- Acrescenta deleted_at (soft delete), data_confirmacao e
-- snapshot_metricas (JSONB) em otimizacoes_historico.
-- snapshot_metricas payload:
--   { cpl_atual, roas_atual, leads_periodo, spend_periodo,
--     historico_ultima_mudanca }
-- ============================================

ALTER TABLE otimizacoes_historico
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_confirmacao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snapshot_metricas JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_otimizacoes_deleted ON otimizacoes_historico(deleted_at);
