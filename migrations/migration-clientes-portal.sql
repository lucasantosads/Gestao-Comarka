-- ============================================
-- MIGRATION: Portal completo de cliente
-- Reuniões, resumos, briefing, verificação
-- Usa notion_id como chave (fonte única = Notion)
-- ============================================

-- 1. Estender clientes_extra (já existe) com briefing e verificação
DO $$ BEGIN
  ALTER TABLE clientes_extra ADD COLUMN IF NOT EXISTS briefing JSONB;
  ALTER TABLE clientes_extra ADD COLUMN IF NOT EXISTS briefing_preenchido_em TIMESTAMPTZ;
  ALTER TABLE clientes_extra ADD COLUMN IF NOT EXISTS ultima_verificacao TIMESTAMPTZ;
  ALTER TABLE clientes_extra ADD COLUMN IF NOT EXISTS nicho TEXT;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 2. Reuniões por cliente (notion_id)
CREATE TABLE IF NOT EXISTS reunioes_cliente (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_notion_id TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'revisao',
  data_reuniao TIMESTAMPTZ NOT NULL,
  link_gravacao TEXT,
  transcricao TEXT,
  resumo_ia TEXT,
  resumo_gerado_em TIMESTAMPTZ,
  notas TEXT,
  status TEXT DEFAULT 'agendada',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE reunioes_cliente ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "reunioes_all" ON reunioes_cliente FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_reunioes_cliente_notion ON reunioes_cliente(cliente_notion_id);
CREATE INDEX IF NOT EXISTS idx_reunioes_cliente_data ON reunioes_cliente(data_reuniao DESC);

-- 3. Resumos semanais gerados por IA
CREATE TABLE IF NOT EXISTS resumos_cliente (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_notion_id TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'semanal',
  conteudo TEXT NOT NULL,
  periodo_inicio DATE,
  periodo_fim DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE resumos_cliente ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "resumos_all" ON resumos_cliente FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_resumos_cliente_notion ON resumos_cliente(cliente_notion_id);

-- 4. Métricas mensais por tese (expansão da clientes_teses existente)
CREATE TABLE IF NOT EXISTS teses_metricas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tese_id UUID NOT NULL REFERENCES clientes_teses(id) ON DELETE CASCADE,
  mes_referencia TEXT NOT NULL,
  investimento NUMERIC(10,2) DEFAULT 0,
  leads INT DEFAULT 0,
  reunioes INT DEFAULT 0,
  contratos INT DEFAULT 0,
  receita_gerada NUMERIC(10,2) DEFAULT 0,
  cpl NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE WHEN leads > 0 THEN investimento / leads ELSE NULL END
  ) STORED,
  roas NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE WHEN investimento > 0 THEN receita_gerada / investimento ELSE NULL END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tese_id, mes_referencia)
);
ALTER TABLE teses_metricas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "teses_metricas_all" ON teses_metricas FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_teses_metricas_tese ON teses_metricas(tese_id);

-- 5. Adicionar campos que faltam em clientes_teses
DO $$ BEGIN
  ALTER TABLE clientes_teses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativa';
  ALTER TABLE clientes_teses ADD COLUMN IF NOT EXISTS meta_leads INT;
  ALTER TABLE clientes_teses ADD COLUMN IF NOT EXISTS meta_contratos INT;
  ALTER TABLE clientes_teses ADD COLUMN IF NOT EXISTS data_inicio DATE;
  ALTER TABLE clientes_teses ADD COLUMN IF NOT EXISTS data_fim DATE;
  ALTER TABLE clientes_teses ADD COLUMN IF NOT EXISTS observacao TEXT;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
