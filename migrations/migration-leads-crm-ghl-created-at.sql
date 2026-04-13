-- Migration: adiciona ghl_created_at em leads_crm
-- Contexto: leads_crm.created_at hoje é a data de INSERT no Supabase, não a data
-- em que a oportunidade foi criada no GHL. Isso faz qualquer filtro "por período"
-- contar leads errados — um lead antigo que foi re-sincronizado aparece como novo.
--
-- Fix: coluna nova ghl_created_at populada pelo sync a partir de opp.createdAt.
-- Depois de rodar esta migration, rodar POST /api/sync?source=ghl para popular.

ALTER TABLE leads_crm
  ADD COLUMN IF NOT EXISTS ghl_created_at TIMESTAMPTZ;

-- Index para filtros por período (queries de dashboard, data-health, attribution-start)
CREATE INDEX IF NOT EXISTS idx_leads_crm_ghl_created_at
  ON leads_crm (ghl_created_at DESC);

-- Backfill heurístico: para rows já existentes sem ghl_created_at, usa mes_referencia
-- como aproximação (precisão de mês). Será sobrescrito corretamente no próximo sync.
UPDATE leads_crm
SET ghl_created_at = (mes_referencia || '-01')::date::timestamptz
WHERE ghl_created_at IS NULL
  AND mes_referencia IS NOT NULL;
