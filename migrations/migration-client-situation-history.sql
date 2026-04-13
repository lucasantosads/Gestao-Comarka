-- ============================================
-- MIGRATION: Histórico de mudança de situação do cliente
-- ============================================
-- A "tabela de clientes" canônica deste projeto é `clientes_notion_mirror`
-- (PK `notion_id text` — não há `clients`). O histórico mantém o snapshot
-- de cada transição de `situacao`.
-- ============================================

CREATE TABLE IF NOT EXISTS client_situation_history (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_notion_id  text NOT NULL REFERENCES clientes_notion_mirror(notion_id) ON DELETE CASCADE,
  situacao_anterior  text,
  situacao_nova      text,
  data_mudanca       timestamptz NOT NULL DEFAULT now(),
  origem             text NOT NULL DEFAULT 'gestor_manual'
                       CHECK (origem IN ('gestor_manual', 'crm_sync', 'feedback_analysis')),
  contexto           text,
  gestor_id          uuid REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_client_situation_history_cliente
  ON client_situation_history(cliente_notion_id, data_mudanca DESC);

ALTER TABLE client_situation_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON client_situation_history;
CREATE POLICY "service_role_all" ON client_situation_history FOR ALL USING (true) WITH CHECK (true);

-- Trigger: insere automaticamente uma row sempre que `situacao` muda na mirror.
-- Origem padrão = 'gestor_manual' (a maioria das mudanças vem da UI). Quando o
-- cliente edita via API que faz INSERT explícito antes do UPDATE, a row do
-- trigger acaba sendo a mesma linha — só duplicaria se UPDATE direto for usado
-- sem passar pela API. Para evitar duplicatas, o trigger só insere quando a
-- mais recente para esse cliente NÃO foi criada nos últimos 5 segundos com a
-- mesma transição.
CREATE OR REPLACE FUNCTION track_client_situacao_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  recente_id uuid;
BEGIN
  IF NEW.situacao IS DISTINCT FROM OLD.situacao THEN
    SELECT id INTO recente_id
      FROM client_situation_history
     WHERE cliente_notion_id = NEW.notion_id
       AND situacao_anterior IS NOT DISTINCT FROM OLD.situacao
       AND situacao_nova IS NOT DISTINCT FROM NEW.situacao
       AND data_mudanca > now() - interval '5 seconds'
     ORDER BY data_mudanca DESC LIMIT 1;
    IF recente_id IS NULL THEN
      INSERT INTO client_situation_history (cliente_notion_id, situacao_anterior, situacao_nova, origem)
      VALUES (NEW.notion_id, OLD.situacao, NEW.situacao, 'gestor_manual');
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_client_situacao_change ON clientes_notion_mirror;
CREATE TRIGGER trg_client_situacao_change
  AFTER UPDATE OF situacao ON clientes_notion_mirror
  FOR EACH ROW EXECUTE FUNCTION track_client_situacao_change();
