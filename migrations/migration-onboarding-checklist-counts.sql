-- ============================================
-- MIGRATION: Contadores de checklist em onboarding_tracking
-- ============================================
-- Campos denormalizados para exibir a barra de progresso no kanban
-- sem ter que ir no Notion a cada card. Serão atualizados quando a
-- Fase C (Sheet lateral) introduzir o checklist por cliente.
-- ============================================

ALTER TABLE onboarding_tracking
  ADD COLUMN IF NOT EXISTS checklist_total INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checklist_done INT DEFAULT 0;
