-- ============================================
-- MIGRATION: Campos para leads avulsos
-- ghl_contact_id já existe na tabela
-- ============================================

ALTER TABLE leads_crm
  ADD COLUMN IF NOT EXISTS lead_avulso BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fonte_avulso TEXT DEFAULT NULL;
