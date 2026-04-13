-- ============================================
-- TRIGGER: Auto-incrementar leads_totais
-- Executar no SQL Editor do Supabase
-- ============================================
-- Toda vez que um lead é inserido em leads_crm,
-- incrementa config_mensal.leads_totais do mês correspondente.
-- Se o mês não existe em config_mensal, cria com leads_totais = 1.

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
