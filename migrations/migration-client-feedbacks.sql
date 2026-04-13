-- ============================================
-- MIGRATION: Feedbacks de Clientes + alerta de orçamento estagnado
-- ============================================
-- Cria a tabela `client_feedbacks` (registros periódicos do gestor sobre o
-- cliente) e adiciona `orcamento_atualizado_em` em `clientes_notion_mirror`
-- para detectar orçamento sem crescimento por 60+ dias.
--
-- A "tabela de clientes" canônica deste projeto é `clientes_notion_mirror`
-- (PK `notion_id text`), portanto a FK aqui usa `cliente_notion_id text`.
-- ============================================

CREATE TABLE IF NOT EXISTS client_feedbacks (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_notion_id           text NOT NULL REFERENCES clientes_notion_mirror(notion_id) ON DELETE CASCADE,
  gestor_id                   uuid REFERENCES employees(id) ON DELETE SET NULL,
  data_feedback               date NOT NULL,
  n_contratos                 integer,
  contratos_nao_informado     boolean NOT NULL DEFAULT false,
  faturamento                 numeric,
  faturamento_nao_informado   boolean NOT NULL DEFAULT false,
  data_envio_feedback         date,
  envio_nao_informado         boolean NOT NULL DEFAULT false,
  observacoes                 text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_feedbacks_cliente
  ON client_feedbacks(cliente_notion_id, data_feedback DESC);
CREATE INDEX IF NOT EXISTS idx_client_feedbacks_gestor
  ON client_feedbacks(gestor_id);

ALTER TABLE client_feedbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON client_feedbacks;
CREATE POLICY "service_role_all" ON client_feedbacks FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Orçamento estagnado
-- ============================================
ALTER TABLE clientes_notion_mirror
  ADD COLUMN IF NOT EXISTS orcamento_atualizado_em timestamptz;

-- Backfill com updated_at para clientes existentes
UPDATE clientes_notion_mirror
   SET orcamento_atualizado_em = COALESCE(orcamento_atualizado_em, now())
 WHERE orcamento IS NOT NULL;

-- Trigger: sempre que orcamento mudar, atualiza orcamento_atualizado_em
CREATE OR REPLACE FUNCTION mirror_track_orcamento_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.orcamento IS DISTINCT FROM OLD.orcamento THEN
    NEW.orcamento_atualizado_em = now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mirror_track_orcamento ON clientes_notion_mirror;
CREATE TRIGGER trg_mirror_track_orcamento
  BEFORE UPDATE ON clientes_notion_mirror
  FOR EACH ROW EXECUTE FUNCTION mirror_track_orcamento_change();
