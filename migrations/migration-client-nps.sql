-- ============================================
-- MIGRATION: NPS por cliente + tarefa automática no primeiro mês
-- ============================================
-- A "tabela de clientes" canônica é `clientes_notion_mirror` (PK notion_id text).
-- A tarefa automática vai para `tarefas_kanban` (kanban consumido pela página do
-- colaborador), onde `responsavel` é texto livre (nome do gestor).
-- ============================================

CREATE TABLE IF NOT EXISTS client_nps (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_notion_id  text NOT NULL REFERENCES clientes_notion_mirror(notion_id) ON DELETE CASCADE,
  gestor_id          uuid REFERENCES employees(id) ON DELETE SET NULL,
  nps_score          integer NOT NULL CHECK (nps_score BETWEEN 1 AND 10),
  nps_comentario     text,
  mes_referencia     date NOT NULL, -- sempre dia 1 do mês
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_notion_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_client_nps_cliente
  ON client_nps(cliente_notion_id, mes_referencia DESC);
CREATE INDEX IF NOT EXISTS idx_client_nps_mes
  ON client_nps(mes_referencia DESC);

ALTER TABLE client_nps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON client_nps;
CREATE POLICY "service_role_all" ON client_nps FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Trigger: ao inserir um novo cliente, criar tarefa "Coletar NPS"
-- ============================================
CREATE OR REPLACE FUNCTION criar_tarefa_nps_primeiro_mes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Só dispara para clientes recém-criados com analista (gestor) atribuído
  IF NEW.analista IS NOT NULL AND NEW.analista <> '' THEN
    INSERT INTO tarefas_kanban (
      titulo, descricao, responsavel, cliente, urgencia, status, data_vencimento
    ) VALUES (
      'Coletar NPS — ' || COALESCE(NEW.cliente, NEW.notion_id),
      'Primeiro mês: registrar NPS do cliente no sistema',
      NEW.analista,
      NEW.cliente,
      'Média',
      'a_fazer',
      (now() + interval '30 days')::date
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_criar_tarefa_nps ON clientes_notion_mirror;
CREATE TRIGGER trg_criar_tarefa_nps
  AFTER INSERT ON clientes_notion_mirror
  FOR EACH ROW EXECUTE FUNCTION criar_tarefa_nps_primeiro_mes();
