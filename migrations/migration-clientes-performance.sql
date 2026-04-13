-- ============================================
-- Migration: Performance de Clientes
-- Adiciona vínculo cliente ↔ campanha Meta + score de saúde + risco churn
-- + histórico de vínculos Meta + snapshots de métricas em otimizações/reuniões
-- + alertas de cliente (campanha sem leads, etc).
--
-- ALVO: clientes_notion_mirror (é onde vivem nicho, status, situacao, fb_url,
-- gads_url, analista, entrada_id, etc — ver migration-fluxo-entrada-clientes.sql).
-- clientes_receita é apenas a "Entrada" financeira e não carrega metadata.
--
-- Idempotente: pode ser executada múltiplas vezes sem efeito colateral.
-- Campo `nicho` NÃO é adicionado pois já existe na mirror.
-- ============================================

-- 1. Colunas novas em clientes_notion_mirror
ALTER TABLE clientes_notion_mirror ADD COLUMN IF NOT EXISTS meta_campaign_id text;
ALTER TABLE clientes_notion_mirror ADD COLUMN IF NOT EXISTS meta_adset_id text;
ALTER TABLE clientes_notion_mirror ADD COLUMN IF NOT EXISTS meta_leads_mes integer;           -- meta mensal individual de leads
ALTER TABLE clientes_notion_mirror ADD COLUMN IF NOT EXISTS meta_leads_semana integer;        -- legado, mantido por compat
ALTER TABLE clientes_notion_mirror ADD COLUMN IF NOT EXISTS meta_roas_minimo numeric(10,2);   -- ROAS mínimo aceitável
ALTER TABLE clientes_notion_mirror ADD COLUMN IF NOT EXISTS score_saude integer;
ALTER TABLE clientes_notion_mirror ADD COLUMN IF NOT EXISTS score_calculado_em timestamptz;
ALTER TABLE clientes_notion_mirror ADD COLUMN IF NOT EXISTS risco_churn text;                 -- 'baixo' | 'medio' | 'alto'
ALTER TABLE clientes_notion_mirror ADD COLUMN IF NOT EXISTS risco_churn_motivo text;
ALTER TABLE clientes_notion_mirror ADD COLUMN IF NOT EXISTS risco_churn_acao text;            -- ação sugerida pela IA
ALTER TABLE clientes_notion_mirror ADD COLUMN IF NOT EXISTS risco_calculado_em timestamptz;

-- Checks leves
DO $$ BEGIN
  ALTER TABLE clientes_notion_mirror ADD CONSTRAINT mirror_score_range CHECK (score_saude IS NULL OR (score_saude >= 0 AND score_saude <= 100));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE clientes_notion_mirror ADD CONSTRAINT mirror_risco_valid CHECK (risco_churn IS NULL OR risco_churn IN ('baixo','medio','alto'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_mirror_meta_campaign_id ON clientes_notion_mirror(meta_campaign_id) WHERE meta_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mirror_score_saude ON clientes_notion_mirror(score_saude) WHERE score_saude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mirror_risco_churn ON clientes_notion_mirror(risco_churn) WHERE risco_churn IS NOT NULL;
-- Nota: `nicho` já tem uso na mirror via raw_properties + coluna dedicada. Não criamos índice novo pra não duplicar.

-- 2. Histórico de vínculos cliente ↔ campanha Meta
CREATE TABLE IF NOT EXISTS clientes_meta_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_notion_id text NOT NULL,
  meta_campaign_id text NOT NULL,
  meta_adset_id text,
  vigencia_inicio date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim date,                                  -- null = vínculo atual
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE clientes_meta_historico ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "clientes_meta_historico_all" ON clientes_meta_historico
    FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_cli_meta_hist_cliente ON clientes_meta_historico(cliente_notion_id);
CREATE INDEX IF NOT EXISTS idx_cli_meta_hist_atual ON clientes_meta_historico(cliente_notion_id) WHERE vigencia_fim IS NULL;
CREATE INDEX IF NOT EXISTS idx_cli_meta_hist_campaign ON clientes_meta_historico(meta_campaign_id);

-- 3. Trigger: mantém clientes_meta_historico sincronizado com as mudanças
--    de meta_campaign_id em clientes_notion_mirror.
CREATE OR REPLACE FUNCTION fn_clientes_meta_historico_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.meta_campaign_id IS NOT NULL THEN
      INSERT INTO clientes_meta_historico
        (cliente_notion_id, meta_campaign_id, meta_adset_id, vigencia_inicio, vigencia_fim)
      VALUES
        (NEW.notion_id, NEW.meta_campaign_id, NEW.meta_adset_id, CURRENT_DATE, NULL);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Só age se o campaign_id mudou
    IF NEW.meta_campaign_id IS DISTINCT FROM OLD.meta_campaign_id THEN
      -- Fecha o vínculo atual (se houver)
      UPDATE clientes_meta_historico
         SET vigencia_fim = CURRENT_DATE
       WHERE cliente_notion_id = NEW.notion_id
         AND vigencia_fim IS NULL;

      -- Abre novo vínculo se o campaign novo não for null
      IF NEW.meta_campaign_id IS NOT NULL THEN
        INSERT INTO clientes_meta_historico
          (cliente_notion_id, meta_campaign_id, meta_adset_id, vigencia_inicio, vigencia_fim)
        VALUES
          (NEW.notion_id, NEW.meta_campaign_id, NEW.meta_adset_id, CURRENT_DATE, NULL);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_meta_historico_ins ON clientes_notion_mirror;
CREATE TRIGGER trg_clientes_meta_historico_ins
  AFTER INSERT ON clientes_notion_mirror
  FOR EACH ROW
  EXECUTE FUNCTION fn_clientes_meta_historico_sync();

DROP TRIGGER IF EXISTS trg_clientes_meta_historico_upd ON clientes_notion_mirror;
CREATE TRIGGER trg_clientes_meta_historico_upd
  AFTER UPDATE OF meta_campaign_id ON clientes_notion_mirror
  FOR EACH ROW
  EXECUTE FUNCTION fn_clientes_meta_historico_sync();

-- Backfill: cria vínculo atual para quem já tem meta_campaign_id preenchido
--           e ainda não tem registro aberto em clientes_meta_historico.
INSERT INTO clientes_meta_historico (cliente_notion_id, meta_campaign_id, meta_adset_id, vigencia_inicio, vigencia_fim)
SELECT m.notion_id, m.meta_campaign_id, m.meta_adset_id, CURRENT_DATE, NULL
FROM clientes_notion_mirror m
WHERE m.meta_campaign_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM clientes_meta_historico h
     WHERE h.cliente_notion_id = m.notion_id
       AND h.vigencia_fim IS NULL
  );

-- 4. Snapshots de métricas em otimizações e reuniões
DO $$ BEGIN
  ALTER TABLE otimizacoes_historico ADD COLUMN IF NOT EXISTS snapshot_metricas jsonb;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE reunioes_cliente ADD COLUMN IF NOT EXISTS snapshot_metricas jsonb;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 5. Alertas de cliente (tabela nova).
--    Nota: NÃO reaproveitamos `alertas_snooze` — o schema atual exige `ad_id NOT NULL`
--    e é voltado para snooze de alertas de anúncio, não alertas ativos por cliente.
CREATE TABLE IF NOT EXISTS alertas_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_notion_id text NOT NULL,
  tipo text NOT NULL,                -- 'campanha_sem_leads', futuro: 'cpl_alto', 'roas_baixo'...
  mensagem text NOT NULL,
  criado_em timestamptz DEFAULT now(),
  resolvido_em timestamptz,          -- soft close
  notificado_whatsapp boolean DEFAULT false,
  metadata jsonb
);

ALTER TABLE alertas_cliente ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "alertas_cliente_all" ON alertas_cliente
    FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_alertas_cliente_notion ON alertas_cliente(cliente_notion_id);
CREATE INDEX IF NOT EXISTS idx_alertas_cliente_tipo ON alertas_cliente(tipo);
CREATE INDEX IF NOT EXISTS idx_alertas_cliente_ativos
  ON alertas_cliente(cliente_notion_id, tipo)
  WHERE resolvido_em IS NULL;
