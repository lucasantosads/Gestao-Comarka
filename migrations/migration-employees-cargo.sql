-- ============================================
-- MIGRATION: cargo granular em employees
-- ============================================
-- Adiciona uma coluna `cargo` (texto livre) que descreve a função
-- além do `role` enum existente. O `role` continua sendo usado para
-- permissão (admin/closer/sdr); `cargo` é o título exibido (Closer,
-- SDR, Tráfego, Head, Pleno, Junior, Diretor, Desenvolvimento, etc).
-- ============================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS cargo TEXT;

-- Backfill: preenche cargo a partir do role para registros existentes
UPDATE employees SET cargo = role WHERE cargo IS NULL;
