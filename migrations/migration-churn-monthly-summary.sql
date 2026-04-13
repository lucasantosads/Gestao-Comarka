-- ============================================
-- MIGRATION: Churn Monthly Summary + Seed Histórico
-- ============================================

CREATE TABLE IF NOT EXISTS churn_monthly_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_mes TEXT NOT NULL UNIQUE,
  num_saidas INTEGER NOT NULL DEFAULT 0,
  total_clientes INTEGER NOT NULL DEFAULT 0,
  churn_rate NUMERIC(10,4) NOT NULL DEFAULT 0,
  is_historico BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE churn_monthly_summary ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "churn_summary_all" ON churn_monthly_summary FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger calc churn_rate auto
CREATE OR REPLACE FUNCTION calc_churn_rate() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_clientes > 0 THEN
    NEW.churn_rate := ROUND((NEW.num_saidas::NUMERIC / NEW.total_clientes) * 100, 4);
  ELSE
    NEW.churn_rate := 0;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calc_churn_rate ON churn_monthly_summary;
CREATE TRIGGER trigger_calc_churn_rate
  BEFORE INSERT OR UPDATE ON churn_monthly_summary
  FOR EACH ROW EXECUTE FUNCTION calc_churn_rate();

-- Trigger atualizar resumo quando churn_log é inserido
CREATE OR REPLACE FUNCTION update_churn_summary_on_insert() RETURNS TRIGGER AS $$
DECLARE
  v_ano_mes TEXT;
BEGIN
  v_ano_mes := TO_CHAR(NEW.data_saida, 'YYYY/MM');
  INSERT INTO churn_monthly_summary (ano_mes, num_saidas, total_clientes, is_historico)
  VALUES (v_ano_mes, 1, 0, false)
  ON CONFLICT (ano_mes) DO UPDATE
    SET num_saidas = churn_monthly_summary.num_saidas + 1,
        updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_churn_summary ON churn_log;
CREATE TRIGGER trigger_update_churn_summary
  AFTER INSERT ON churn_log
  FOR EACH ROW EXECUTE FUNCTION update_churn_summary_on_insert();

-- Seed histórico
INSERT INTO churn_monthly_summary (ano_mes, num_saidas, total_clientes, is_historico) VALUES
  ('2024/10',  0,  30, true),
  ('2024/11',  1,  30, true),
  ('2024/12',  2,  30, true),
  ('2025/01',  3,  36, true),
  ('2025/03',  1,  47, true),
  ('2025/04',  2,  50, true),
  ('2025/05',  5,  58, true),
  ('2025/06',  6,  60, true),
  ('2025/07', 14,  67, true),
  ('2025/08',  5,  68, true),
  ('2025/09', 10,  70, true),
  ('2025/10', 11,  68, true),
  ('2025/11', 14,  68, true),
  ('2025/12',  6,  63, true),
  ('2026/01',  4,  67, true),
  ('2026/02',  2,  80, true),
  ('2026/03',  8,  92, true),
  ('2026/04',  0,  91, false)
ON CONFLICT (ano_mes) DO UPDATE
  SET num_saidas = EXCLUDED.num_saidas,
      total_clientes = EXCLUDED.total_clientes,
      is_historico = EXCLUDED.is_historico;
