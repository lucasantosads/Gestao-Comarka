-- ============================================
-- MIGRATION: Módulo de tempo/produtividade
-- ============================================

-- 1. Colunas de timer em tarefas (tabela de tarefas internas)
-- A tabela `tarefas` já tem `tipo` com CHECK constraint fixo,
-- então adicionamos `tipo_tarefa` como campo flexível (referencia tipo_tarefa_opcoes).
ALTER TABLE tarefas
  ADD COLUMN IF NOT EXISTS tempo_total_segundos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timer_iniciado_em TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS timer_pausado_em TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS timer_rodando BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo_tarefa TEXT DEFAULT NULL;

-- 2. Colunas de timer em tarefas_kanban (já tem total_segundos, em_andamento, ultimo_inicio)
-- Adicionamos tipo_tarefa para categorização flexível
ALTER TABLE tarefas_kanban
  ADD COLUMN IF NOT EXISTS tipo_tarefa TEXT DEFAULT NULL;

-- 3. Colunas em employees (tabela de colaboradores)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS meta_horas_semanais INTEGER DEFAULT 40,
  ADD COLUMN IF NOT EXISTS alerta_inatividade_horas INTEGER DEFAULT 2;

-- 4. Tabela de sessões de tempo
CREATE TABLE IF NOT EXISTS time_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID REFERENCES employees(id),
  tarefa_id UUID REFERENCES tarefas_kanban(id) ON DELETE CASCADE,
  iniciado_em TIMESTAMPTZ NOT NULL,
  pausado_em TIMESTAMPTZ DEFAULT NULL,
  duracao_segundos INTEGER DEFAULT 0,
  data_referencia DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE time_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "time_sessions_all" ON time_sessions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_time_sessions_colaborador ON time_sessions(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_time_sessions_tarefa ON time_sessions(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_time_sessions_data ON time_sessions(data_referencia);

-- 5. Tabela de tipos de tarefa (catálogo)
CREATE TABLE IF NOT EXISTS tipo_tarefa_opcoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cor TEXT DEFAULT '#6366f1',
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tipo_tarefa_opcoes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tipo_tarefa_opcoes_all" ON tipo_tarefa_opcoes FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Seed de tipos padrão (apenas se tabela vazia)
INSERT INTO tipo_tarefa_opcoes (nome, cor)
SELECT nome, cor FROM (VALUES
  ('Atendimento', '#3b82f6'),
  ('Criativo', '#ec4899'),
  ('Operacional', '#f59e0b'),
  ('Reunião', '#10b981'),
  ('Estratégia', '#8b5cf6')
) AS seed(nome, cor)
WHERE NOT EXISTS (SELECT 1 FROM tipo_tarefa_opcoes LIMIT 1);
