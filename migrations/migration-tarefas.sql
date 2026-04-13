-- Tabela de tarefas internas
CREATE TABLE IF NOT EXISTS tarefas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  criado_por uuid,
  atribuido_para uuid,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  prazo timestamptz NOT NULL,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  tipo text NOT NULL DEFAULT 'outro' CHECK (tipo IN ('lancamento', 'followup', 'confirmacao_reuniao', 'envio_proposta', 'interno', 'outro')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_tarefas" ON tarefas FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_tarefas_atribuido ON tarefas(atribuido_para, status);
CREATE INDEX IF NOT EXISTS idx_tarefas_criado ON tarefas(criado_por);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_tarefas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tarefas_updated_at ON tarefas;
CREATE TRIGGER trg_tarefas_updated_at
  BEFORE UPDATE ON tarefas
  FOR EACH ROW
  EXECUTE FUNCTION update_tarefas_updated_at();

-- Comentários
CREATE TABLE IF NOT EXISTS tarefas_comentarios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id uuid REFERENCES tarefas(id) ON DELETE CASCADE,
  autor_id uuid,
  texto text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tarefas_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_comentarios" ON tarefas_comentarios FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_comentarios_tarefa ON tarefas_comentarios(tarefa_id);
