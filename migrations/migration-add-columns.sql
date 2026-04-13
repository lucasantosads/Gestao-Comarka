-- ============================================
-- MIGRATION: Adicionar colunas faltantes
-- Executar no SQL Editor do Supabase
-- ============================================

-- 1. Adicionar meta_reunioes_feitas na tabela metas_sdr
ALTER TABLE metas_sdr ADD COLUMN IF NOT EXISTS meta_reunioes_feitas int DEFAULT 0;

-- 2. Trigger para auto-incrementar leads_totais quando um lead é inserido
CREATE OR REPLACE FUNCTION increment_leads_totais()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO config_mensal (mes_referencia, leads_totais, investimento)
  VALUES (NEW.mes_referencia, 1, 0)
  ON CONFLICT (mes_referencia)
  DO UPDATE SET leads_totais = config_mensal.leads_totais + 1,
                updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_leads ON leads_crm;
CREATE TRIGGER trg_increment_leads
  AFTER INSERT ON leads_crm
  FOR EACH ROW
  EXECUTE FUNCTION increment_leads_totais();
