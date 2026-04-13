-- ============================================
-- MIGRATION: Espelho local do Notion
-- Objetivo: ter backup em Supabase para migração futura
-- Não é usado para leituras no dashboard (Notion ainda é a fonte)
-- ============================================

-- Clientes (DB 2549240cff2d486fbd346c4b0ef2a3ae)
CREATE TABLE IF NOT EXISTS clientes_notion_mirror (
  notion_id TEXT PRIMARY KEY,
  cliente TEXT,
  status TEXT,
  situacao TEXT,
  resultados TEXT,
  atencao TEXT,
  nicho TEXT,
  analista TEXT,
  orcamento NUMERIC,
  dia_otimizar TEXT,
  ultimo_feedback DATE,
  otimizacao DATE,
  pagamento TEXT,
  automacao BOOLEAN,
  fb_url TEXT,
  gads_url TEXT,
  tiktok_url TEXT,
  raw_properties JSONB,
  ultimo_sync_em TIMESTAMPTZ DEFAULT now(),
  editado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE clientes_notion_mirror ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "clientes_mirror_all" ON clientes_notion_mirror FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_clientes_mirror_status ON clientes_notion_mirror(status);
CREATE INDEX IF NOT EXISTS idx_clientes_mirror_analista ON clientes_notion_mirror(analista);

-- Onboarding (DB fffb5b1a3b988152960fe2877b92bcdd)
CREATE TABLE IF NOT EXISTS onboarding_notion_mirror (
  notion_id TEXT PRIMARY KEY,
  nome TEXT,
  etapa TEXT,
  plataformas TEXT,
  orcamento_mensal NUMERIC,
  gestor_trafego TEXT,
  gestor_junior TEXT,
  head_trafego TEXT,
  comercial TEXT,
  sucesso_cliente TEXT,
  produto TEXT,
  raw_properties JSONB,
  ultimo_sync_em TIMESTAMPTZ DEFAULT now(),
  editado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE onboarding_notion_mirror ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "onboarding_mirror_all" ON onboarding_notion_mirror FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_onboarding_mirror_etapa ON onboarding_notion_mirror(etapa);

-- Team (DB 74207bb81ed24fe7aad47eeb4b43a367)
CREATE TABLE IF NOT EXISTS team_notion_mirror (
  notion_id TEXT PRIMARY KEY,
  nome TEXT,
  cargo TEXT,
  funcoes TEXT,
  email TEXT,
  telefone TEXT,
  status TEXT,
  drive TEXT,
  raw_properties JSONB,
  ultimo_sync_em TIMESTAMPTZ DEFAULT now(),
  editado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE team_notion_mirror ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "team_mirror_all" ON team_notion_mirror FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_team_mirror_cargo ON team_notion_mirror(cargo);
