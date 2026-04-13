-- ============================================
-- MIGRATION: Configuração CRM (GHL) por cliente
-- ============================================
-- Liga cada cliente (notion_id) a uma subaccount GHL + pipeline + mapeamento
-- de etapas do pipeline para status internos do dashboard.
-- stage_mapping: { "<ghl_stage_id>": "<status_interno>" }
-- ============================================

CREATE TABLE IF NOT EXISTS clientes_crm_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id TEXT NOT NULL UNIQUE, -- notion_id (chave interna do cliente no dashboard)
  ghl_subaccount_id TEXT,
  ghl_pipeline_id TEXT,
  stage_mapping JSONB DEFAULT '{}'::jsonb,
  conexao_ativa BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  last_test_at TIMESTAMPTZ,
  last_test_result TEXT, -- 'ok' | 'erro' | null
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE clientes_crm_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "clientes_crm_config_all" ON clientes_crm_config FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_clientes_crm_cliente ON clientes_crm_config(cliente_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_crm_pipeline ON clientes_crm_config(ghl_pipeline_id);
