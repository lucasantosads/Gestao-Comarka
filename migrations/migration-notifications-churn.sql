-- ============================================
-- MIGRATION: Sistema de Notificações + Churn Log + tabelas de suporte
-- Executar no SQL Editor do Supabase
-- ============================================

-- =============================================
-- 1.1 Notificações Operacionais (novo sistema)
-- Separada da tabela 'notifications' existente (que usa employee_id)
-- =============================================
CREATE TABLE IF NOT EXISTS notif_operacional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  employee_id UUID,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'cliente_piorando', 'feedback_vencido', 'aviso_churn',
    'tarefa_vencida', 'lead_reuniao', 'relatorio_disponivel',
    'onboarding_parado', 'sem_dados_relatorio', 'churn_registrado'
  )),
  titulo TEXT NOT NULL,
  mensagem TEXT,
  cliente_notion_id TEXT,
  tarefa_notion_id TEXT,
  url_destino TEXT,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notif_operacional ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "notif_op_all" ON notif_operacional FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_notif_op_user_lida
  ON notif_operacional(user_id, lida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_op_employee
  ON notif_operacional(employee_id, lida, created_at DESC);

-- =============================================
-- 1.2 Churn Log
-- =============================================
CREATE TABLE IF NOT EXISTS churn_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_notion_id TEXT NOT NULL,
  cliente_nome TEXT NOT NULL,
  data_saida DATE NOT NULL,
  motivo TEXT NOT NULL CHECK (motivo IN (
    'Resultado insatisfatorio', 'Preco', 'Concorrente',
    'Sem verba', 'Mudou de estrategia', 'Sumiu', 'Outro'
  )),
  motivo_detalhe TEXT,
  ltv_total NUMERIC,
  meses_ativo INTEGER,
  gestor_id UUID,
  closer_id UUID,
  nivel_atencao_saida TEXT,
  resultados_saida TEXT,
  mensalidade NUMERIC,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE churn_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "churn_log_all" ON churn_log FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_churn_log_data ON churn_log(data_saida DESC);
CREATE INDEX IF NOT EXISTS idx_churn_log_cliente ON churn_log(cliente_notion_id);

-- Trigger: quando churn é inserido → notificar gestor (se houver user_id)
CREATE OR REPLACE FUNCTION on_churn_insert() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.gestor_id IS NOT NULL THEN
    INSERT INTO notif_operacional (user_id, tipo, titulo, mensagem, cliente_notion_id, url_destino)
    VALUES (
      NEW.gestor_id,
      'churn_registrado',
      'Cliente finalizado: ' || NEW.cliente_nome,
      'Motivo: ' || NEW.motivo || COALESCE(' — ' || NEW.motivo_detalhe, ''),
      NEW.cliente_notion_id,
      '/dashboard/churn'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_churn_notifications ON churn_log;
CREATE TRIGGER trigger_churn_notifications
  AFTER INSERT ON churn_log
  FOR EACH ROW EXECUTE FUNCTION on_churn_insert();

-- =============================================
-- 1.3 Pipeline → Closer Map
-- =============================================
CREATE TABLE IF NOT EXISTS pipeline_closer_map (
  ghl_pipeline_id TEXT PRIMARY KEY,
  closer_id UUID,
  pipeline_name TEXT,
  ativo BOOLEAN DEFAULT true
);

-- =============================================
-- 1.4 Ad Accounts (multi-conta Meta)
-- =============================================
CREATE TABLE IF NOT EXISTS ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_notion_id TEXT,
  account_id TEXT NOT NULL,
  account_name TEXT,
  access_token TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "ad_accounts_all" ON ad_accounts FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO ad_accounts (account_id, account_name, ativo)
VALUES ('act_2851365261838044', 'Comarka Ads', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- 1.5 Workflow Errors
-- =============================================
CREATE TABLE IF NOT EXISTS workflow_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name TEXT,
  node_name TEXT,
  erro TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workflow_errors ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "workflow_errors_all" ON workflow_errors FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- 1.6 Constraint UNIQUE no leads_crm
-- =============================================
DO $$ BEGIN
  ALTER TABLE leads_crm ADD CONSTRAINT leads_crm_opportunity_unique UNIQUE (ghl_opportunity_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 1.7 Relatorio config (adicionar colunas se não existirem)
-- =============================================
DO $$ BEGIN
  ALTER TABLE relatorio_config ADD COLUMN IF NOT EXISTS gestor_notion_id TEXT;
  ALTER TABLE relatorio_config ADD COLUMN IF NOT EXISTS cliente_notion_id TEXT;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
