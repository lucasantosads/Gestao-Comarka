-- ============================================
-- MIGRATION: Adicionar colunas de atribuicao de anuncio em leads_crm
-- Executar no SQL Editor do Supabase
-- ============================================

-- Colunas de atribuicao Meta Ads
ALTER TABLE leads_crm ADD COLUMN IF NOT EXISTS ad_id text;
ALTER TABLE leads_crm ADD COLUMN IF NOT EXISTS adset_id text;
ALTER TABLE leads_crm ADD COLUMN IF NOT EXISTS campaign_id text;
ALTER TABLE leads_crm ADD COLUMN IF NOT EXISTS ad_name text;
ALTER TABLE leads_crm ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE leads_crm ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE leads_crm ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE leads_crm ADD COLUMN IF NOT EXISTS utm_content text;
ALTER TABLE leads_crm ADD COLUMN IF NOT EXISTS ctwa_clid text;
ALTER TABLE leads_crm ADD COLUMN IF NOT EXISTS session_source text;
ALTER TABLE leads_crm ADD COLUMN IF NOT EXISTS valor_total_projeto numeric DEFAULT 0;

-- Index para busca por ad_id
CREATE INDEX IF NOT EXISTS idx_leads_crm_ad_id ON leads_crm(ad_id);
