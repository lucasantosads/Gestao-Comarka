-- Migration: cria UNIQUE constraint em leads_crm.ghl_opportunity_id
-- (versão 2 — PostgREST não aceita índice parcial; precisa de constraint real)
--
-- O sync GHL usa `upsert(..., { onConflict: "ghl_opportunity_id" })`, que
-- requer UNIQUE CONSTRAINT (não apenas unique index) nessa coluna.

-- 1. Remover duplicatas (mantém só a row mais recente por ghl_opportunity_id)
WITH ranked AS (
  SELECT id, ghl_opportunity_id,
         ROW_NUMBER() OVER (PARTITION BY ghl_opportunity_id ORDER BY updated_at DESC NULLS LAST, created_at DESC) AS rn
  FROM leads_crm
  WHERE ghl_opportunity_id IS NOT NULL
)
DELETE FROM leads_crm WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Remove o índice parcial (se tiver sido criado pela migration anterior)
DROP INDEX IF EXISTS leads_crm_ghl_opportunity_id_uidx;

-- 3. Cria UNIQUE CONSTRAINT real — aceita múltiplas rows NULL mas zero duplicatas não-NULL
ALTER TABLE leads_crm
  ADD CONSTRAINT leads_crm_ghl_opportunity_id_key UNIQUE (ghl_opportunity_id);
