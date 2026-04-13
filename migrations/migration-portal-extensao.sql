-- ============================================
-- MIGRATION: Portal do Colaborador — extensões
-- Estende tabelas existentes ao invés de duplicar.
-- Executar no SQL Editor do Supabase.
-- ============================================

-- 1) team_members_profile: OTE, nível de cargo, renovação de contrato
ALTER TABLE team_members_profile
  ADD COLUMN IF NOT EXISTS ote numeric,
  ADD COLUMN IF NOT EXISTS cargo_nivel integer,
  ADD COLUMN IF NOT EXISTS data_renovacao_contrato date;

-- 2) Trilha de cargos
CREATE TABLE IF NOT EXISTS trilha_cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  nivel integer NOT NULL UNIQUE,
  descricao text,
  kpis jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE trilha_cargos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_all" ON trilha_cargos FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Conteúdo do portal (cultura, regras)
CREATE TABLE IF NOT EXISTS portal_conteudo (
  tipo text PRIMARY KEY CHECK (tipo IN ('cultura', 'regras')),
  conteudo text NOT NULL DEFAULT '',
  atualizado_por uuid REFERENCES employees(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE portal_conteudo ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_all" ON portal_conteudo FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO portal_conteudo (tipo, conteudo) VALUES
  ('cultura', 'Edite este texto para definir a cultura da Comarka.'),
  ('regras',  'Edite este texto para definir as regras da empresa.')
ON CONFLICT (tipo) DO NOTHING;

-- 4) Benefícios por colaborador
CREATE TABLE IF NOT EXISTS colaboradores_beneficios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  nome text NOT NULL,
  valor numeric,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_colaboradores_beneficios_employee ON colaboradores_beneficios(employee_id);
ALTER TABLE colaboradores_beneficios ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_all" ON colaboradores_beneficios FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Punições por colaborador (soft delete)
CREATE TABLE IF NOT EXISTS colaboradores_punicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  data_ocorrencia date NOT NULL,
  registrado_por uuid REFERENCES employees(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_colaboradores_punicoes_employee ON colaboradores_punicoes(employee_id) WHERE deleted_at IS NULL;
ALTER TABLE colaboradores_punicoes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "service_role_all" ON colaboradores_punicoes FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6) Lock de cronômetro em tarefas_kanban
ALTER TABLE tarefas_kanban
  ADD COLUMN IF NOT EXISTS cronometro_encerrado boolean NOT NULL DEFAULT false;
