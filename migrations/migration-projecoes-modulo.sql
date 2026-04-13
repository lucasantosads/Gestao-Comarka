-- ============================================
-- MIGRATION: Módulo de Projeções Expandido
-- Tabelas: projecoes_cenarios, projecoes_historico_acuracia,
--          projecoes_alertas + campos em config_mensal e metas_closers
-- ============================================

-- 1a. Novos campos em config_mensal (taxas de funil + flags manuais)
ALTER TABLE config_mensal ADD COLUMN IF NOT EXISTS funil_lead_para_qualificado NUMERIC;
ALTER TABLE config_mensal ADD COLUMN IF NOT EXISTS funil_lead_para_qualificado_manual BOOLEAN DEFAULT false;

ALTER TABLE config_mensal ADD COLUMN IF NOT EXISTS funil_qualificado_para_reuniao NUMERIC;
ALTER TABLE config_mensal ADD COLUMN IF NOT EXISTS funil_qualificado_para_reuniao_manual BOOLEAN DEFAULT false;

ALTER TABLE config_mensal ADD COLUMN IF NOT EXISTS funil_reuniao_para_proposta NUMERIC;
ALTER TABLE config_mensal ADD COLUMN IF NOT EXISTS funil_reuniao_para_proposta_manual BOOLEAN DEFAULT false;

ALTER TABLE config_mensal ADD COLUMN IF NOT EXISTS funil_proposta_para_fechamento NUMERIC;
ALTER TABLE config_mensal ADD COLUMN IF NOT EXISTS funil_proposta_para_fechamento_manual BOOLEAN DEFAULT false;

ALTER TABLE config_mensal ADD COLUMN IF NOT EXISTS meta_mrr NUMERIC;
ALTER TABLE config_mensal ADD COLUMN IF NOT EXISTS meta_mrr_manual BOOLEAN DEFAULT false;

ALTER TABLE config_mensal ADD COLUMN IF NOT EXISTS meta_contratos INTEGER;
ALTER TABLE config_mensal ADD COLUMN IF NOT EXISTS meta_contratos_manual BOOLEAN DEFAULT false;

ALTER TABLE config_mensal ADD COLUMN IF NOT EXISTS noshow_rate NUMERIC;
ALTER TABLE config_mensal ADD COLUMN IF NOT EXISTS noshow_rate_manual BOOLEAN DEFAULT false;

-- 1b. Tabela projecoes_cenarios
CREATE TABLE IF NOT EXISTS projecoes_cenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_referencia DATE NOT NULL,
  nome TEXT NOT NULL CHECK (nome IN ('base', 'otimista', 'pessimista', 'simulacao')),
  orcamento_meta NUMERIC(12,2),
  noshow_rate NUMERIC(8,4),
  taxa_qualificacao NUMERIC(8,4),
  taxa_reuniao NUMERIC(8,4),
  taxa_fechamento NUMERIC(8,4),
  closers_ativos INTEGER,
  leads_projetados INTEGER,
  qualificados_projetados INTEGER,
  reunioes_projetadas INTEGER,
  propostas_projetadas INTEGER,
  contratos_projetados INTEGER,
  mrr_projetado NUMERIC(12,2),
  investimento_projetado NUMERIC(12,2),
  cac_projetado NUMERIC(12,2),
  is_simulacao BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proj_cenarios_mes ON projecoes_cenarios(mes_referencia);

ALTER TABLE projecoes_cenarios ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "proj_cenarios_all" ON projecoes_cenarios FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1c. Tabela projecoes_historico_acuracia
CREATE TABLE IF NOT EXISTS projecoes_historico_acuracia (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_referencia DATE NOT NULL UNIQUE,
  mrr_projetado NUMERIC(12,2),
  mrr_realizado NUMERIC(12,2),
  contratos_projetados INTEGER,
  contratos_realizados INTEGER,
  leads_projetados INTEGER,
  leads_realizados INTEGER,
  acuracia_mrr NUMERIC(8,2),
  acuracia_contratos NUMERIC(8,2),
  acuracia_leads NUMERIC(8,2),
  acuracia_media NUMERIC(8,2),
  calculado_em TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proj_acuracia_mes ON projecoes_historico_acuracia(mes_referencia);

ALTER TABLE projecoes_historico_acuracia ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "proj_acuracia_all" ON projecoes_historico_acuracia FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1d. Tabela projecoes_alertas
CREATE TABLE IF NOT EXISTS projecoes_alertas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_referencia DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('meta_inalcancavel', 'gargalo_funil', 'ritmo_insuficiente')),
  mensagem TEXT,
  deficit NUMERIC(12,2),
  acoes_sugeridas JSONB,
  visualizado BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proj_alertas_mes ON projecoes_alertas(mes_referencia);

ALTER TABLE projecoes_alertas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "proj_alertas_all" ON projecoes_alertas FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1e. Campos de sugestão IA em metas_closers
ALTER TABLE metas_closers ADD COLUMN IF NOT EXISTS meta_sugerida_ia NUMERIC(12,2);
ALTER TABLE metas_closers ADD COLUMN IF NOT EXISTS meta_sugerida_justificativa TEXT;
