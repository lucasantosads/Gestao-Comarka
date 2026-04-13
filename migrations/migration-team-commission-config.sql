-- ============================================
-- MIGRATION: Configuração de metas e comissão por colaborador
-- ============================================
-- Uma row por (colaborador, mes_referencia). Quando não houver row para o
-- mês solicitado, a API faz fallback para a row mais recente do colaborador.
-- ============================================

CREATE TABLE IF NOT EXISTS team_commission_config (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id      uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  cargo               text NOT NULL CHECK (cargo IN ('closer', 'sdr', 'social_seller')),
  meta_reunioes_mes   integer,
  meta_vendas_mes     numeric,
  ote_base            numeric,
  mes_referencia      date NOT NULL, -- sempre dia 1 do mês (ex: 2026-04-01)
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_team_commission_config_colab
  ON team_commission_config(colaborador_id, mes_referencia DESC);

CREATE OR REPLACE FUNCTION set_team_commission_config_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_team_commission_config_updated_at ON team_commission_config;
CREATE TRIGGER trg_team_commission_config_updated_at
  BEFORE UPDATE ON team_commission_config
  FOR EACH ROW EXECUTE FUNCTION set_team_commission_config_updated_at();

ALTER TABLE team_commission_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON team_commission_config;
CREATE POLICY "service_role_all" ON team_commission_config FOR ALL USING (true) WITH CHECK (true);
