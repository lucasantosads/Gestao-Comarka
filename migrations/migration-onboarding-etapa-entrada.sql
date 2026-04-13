-- ============================================
-- MIGRATION: data de entrada na etapa atual do onboarding
-- ============================================
-- Acrescenta etapa_entrada_em em onboarding_tracking para calcular
-- "dias na coluna atual" no kanban. Atualizado pelo PATCH sempre que
-- etapa_atual muda.
-- ============================================

ALTER TABLE onboarding_tracking
  ADD COLUMN IF NOT EXISTS etapa_entrada_em TIMESTAMPTZ;

-- Backfill: para registros existentes, usa updated_at se houver, senão iniciado_em
UPDATE onboarding_tracking
SET etapa_entrada_em = COALESCE(updated_at, iniciado_em)
WHERE etapa_entrada_em IS NULL;
