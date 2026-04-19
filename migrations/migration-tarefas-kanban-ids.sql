-- ============================================
-- MIGRATION: Colunas de referência em tarefas_kanban
-- Adiciona responsavel_id, solicitante_id, cliente_id, deleted_at, deleted_by
-- Executar no SQL Editor do Supabase
-- ============================================

-- Responsável (referência employees)
ALTER TABLE tarefas_kanban ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES employees(id);

-- Solicitante (quem criou/solicitou)
ALTER TABLE tarefas_kanban ADD COLUMN IF NOT EXISTS solicitante_id uuid REFERENCES employees(id);

-- Cliente vinculado (opcional)
ALTER TABLE tarefas_kanban ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes(id);

-- Soft delete
ALTER TABLE tarefas_kanban ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE tarefas_kanban ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES employees(id);

-- Índices tarefas_kanban
CREATE INDEX IF NOT EXISTS idx_tarefas_kanban_responsavel_id ON tarefas_kanban(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_kanban_solicitante_id ON tarefas_kanban(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_kanban_cliente_id ON tarefas_kanban(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_kanban_deleted_at ON tarefas_kanban(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- Soft delete na tabela tarefas (sistema legado)
-- ============================================
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES employees(id);

CREATE INDEX IF NOT EXISTS idx_tarefas_deleted_at ON tarefas(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- Limpeza automática: excluir permanentemente tarefas com deleted_at > 30 dias
-- Agendar via pg_cron no Supabase ou via n8n com chamada diária:
--   SELECT cron.schedule('cleanup-tarefas-excluidas', '0 3 * * *', $$SELECT cleanup_tarefas_excluidas()$$);
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_tarefas_excluidas()
RETURNS void AS $$
BEGIN
  DELETE FROM tarefas_kanban WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM tarefas WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;

-- Para ativar no Supabase (requer extensão pg_cron habilitada):
-- SELECT cron.schedule('cleanup-tarefas-excluidas', '0 3 * * *', $$SELECT cleanup_tarefas_excluidas()$$);
