-- ============================================
-- MIGRATION: Comarka Pro — pontuação, ranking e gamificação
-- ============================================
-- Decisões de alinhamento com o repo real:
--   * Tabela de pessoas é `employees` (não `colaboradores_rh`).
--   * Autenticação é JWT próprio via cookie; FKs apontam para employees(id),
--     não para auth.users.
--   * Adiciona flags `is_head_operacional`, `is_gestor_trafego` e `cargo_nivel`
--     em employees para suportar o módulo.
--   * Cria `kanban_cronometro_log` (não existia) para servir de fonte ao job
--     automático de cronômetro.
--   * Regra 3d (otimizações) usa `otimizacoes_historico` (nome real).
-- ============================================

-- ---------- 0. Extensões / ajustes em employees ----------
DO $$ BEGIN
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS cargo_nivel TEXT CHECK (cargo_nivel IN ('jr','pleno','sr'));
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_head_operacional BOOLEAN DEFAULT false;
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_gestor_trafego BOOLEAN DEFAULT false;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ---------- 1. kanban_cronometro_log (fonte do job 3a) ----------
CREATE TABLE IF NOT EXISTS kanban_cronometro_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  duracao_min INTEGER NOT NULL DEFAULT 0,
  tarefa_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE kanban_cronometro_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "kanban_cronometro_log_all" ON kanban_cronometro_log FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_kanban_cron_colab_data ON kanban_cronometro_log(colaborador_id, data);

-- ---------- 2. comarka_pro_config ----------
CREATE TABLE IF NOT EXISTS comarka_pro_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  temporada_atual INTEGER DEFAULT 1,
  premio_mensal_1 NUMERIC,
  premio_mensal_2 NUMERIC,
  premio_mensal_3 NUMERIC,
  premio_trimestral_1 NUMERIC,
  premio_trimestral_2 NUMERIC,
  premio_trimestral_3 NUMERIC,
  premio_semestral_1 NUMERIC,
  premio_semestral_2 NUMERIC,
  premio_semestral_3 NUMERIC,
  premio_anual_1 NUMERIC,
  premio_anual_2 NUMERIC,
  premio_anual_3 NUMERIC,
  multiplicador_sequencia NUMERIC DEFAULT 1.2,
  meses_sequencia_necessarios INTEGER DEFAULT 3,
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE comarka_pro_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "comarka_pro_config_all" ON comarka_pro_config FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- seed de linha única
INSERT INTO comarka_pro_config (temporada_atual)
SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM comarka_pro_config);

-- ---------- 3. comarka_pro_temporadas ----------
CREATE TABLE IF NOT EXISTS comarka_pro_temporadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  trimestre INTEGER NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
  inicio DATE NOT NULL,
  fim DATE NOT NULL,
  encerrada BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE comarka_pro_temporadas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "comarka_pro_temporadas_all" ON comarka_pro_temporadas FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_comarka_pro_temporadas_periodo ON comarka_pro_temporadas(ano, trimestre);

-- ---------- 4. comarka_pro_pontos ----------
CREATE TABLE IF NOT EXISTS comarka_pro_pontos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,
  temporada_id UUID REFERENCES comarka_pro_temporadas(id) ON DELETE SET NULL,
  pontos_brutos INTEGER DEFAULT 0,
  multiplicador_ativo NUMERIC DEFAULT 1.0,
  pontos_finais INTEGER DEFAULT 0,
  meses_sequencia INTEGER DEFAULT 0,
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE (colaborador_id, mes_referencia)
);
ALTER TABLE comarka_pro_pontos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "comarka_pro_pontos_all" ON comarka_pro_pontos FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_comarka_pro_pontos_colaborador ON comarka_pro_pontos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_comarka_pro_pontos_mes ON comarka_pro_pontos(mes_referencia);

-- ---------- 5. comarka_pro_lancamentos ----------
CREATE TABLE IF NOT EXISTS comarka_pro_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'cronometro','aula','implementacao','nps','orcamento',
    'feedback_cliente','roteiro','reuniao_cliente','organizacao',
    'penalizacao_atraso','penalizacao_aula','penalizacao_desorganizacao',
    'penalizacao_erro_grave','penalizacao_erro_leve','penalizacao_grupo'
  )),
  pontos INTEGER NOT NULL,
  descricao TEXT,
  origem TEXT NOT NULL CHECK (origem IN ('automatico','manual')),
  referencia_id UUID,
  aprovado_por UUID REFERENCES employees(id) ON DELETE SET NULL,
  cliente_id UUID,
  deleted_at TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE comarka_pro_lancamentos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "comarka_pro_lancamentos_all" ON comarka_pro_lancamentos FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_comarka_pro_lanc_colaborador ON comarka_pro_lancamentos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_comarka_pro_lanc_mes ON comarka_pro_lancamentos(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_comarka_pro_lanc_categoria ON comarka_pro_lancamentos(categoria);
CREATE INDEX IF NOT EXISTS idx_comarka_pro_lanc_deleted ON comarka_pro_lancamentos(deleted_at);

-- ---------- 6. comarka_pro_roteiros ----------
CREATE TABLE IF NOT EXISTS comarka_pro_roteiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  ad_id TEXT,
  ad_match_status TEXT DEFAULT 'pendente' CHECK (ad_match_status IN ('pendente','encontrado','nao_encontrado')),
  metricas_snapshot JSONB,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','reprovado')),
  aprovado_por UUID REFERENCES employees(id) ON DELETE SET NULL,
  aprovado_em TIMESTAMPTZ,
  observacao_aprovador TEXT,
  cliente_id UUID,
  mes_referencia DATE NOT NULL,
  deleted_at TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE comarka_pro_roteiros ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "comarka_pro_roteiros_all" ON comarka_pro_roteiros FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_comarka_pro_roteiros_titulo ON comarka_pro_roteiros(titulo);
CREATE INDEX IF NOT EXISTS idx_comarka_pro_roteiros_ad ON comarka_pro_roteiros(ad_id);
CREATE INDEX IF NOT EXISTS idx_comarka_pro_roteiros_status ON comarka_pro_roteiros(status);

-- ---------- 7. comarka_pro_feedbacks ----------
CREATE TABLE IF NOT EXISTS comarka_pro_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  cliente_id UUID,
  descricao TEXT NOT NULL,
  evidencia_url TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','reprovado')),
  aprovado_por UUID REFERENCES employees(id) ON DELETE SET NULL,
  aprovado_em TIMESTAMPTZ,
  mes_referencia DATE NOT NULL,
  deleted_at TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE comarka_pro_feedbacks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "comarka_pro_feedbacks_all" ON comarka_pro_feedbacks FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_comarka_pro_feedbacks_colaborador ON comarka_pro_feedbacks(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_comarka_pro_feedbacks_mes ON comarka_pro_feedbacks(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_comarka_pro_feedbacks_status ON comarka_pro_feedbacks(status);
