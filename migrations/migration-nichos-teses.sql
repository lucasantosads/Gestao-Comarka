-- ============================================
-- MIGRATION: Nichos e Teses (catálogo global + vínculo com clientes e campanhas)
-- ============================================

-- 1. Catálogo global de nichos
CREATE TABLE IF NOT EXISTS nichos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nichos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "nichos_all" ON nichos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Catálogo global de teses (vinculadas a um nicho)
CREATE TABLE IF NOT EXISTS teses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nicho_id UUID NOT NULL REFERENCES nichos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(nicho_id, nome)
);

ALTER TABLE teses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "teses_all" ON teses FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_teses_nicho ON teses(nicho_id) WHERE deleted_at IS NULL;

-- 3. Vínculo cliente ↔ nicho ↔ tese
-- cliente_id usa notion_id (text) para manter compatibilidade com clientes_notion_mirror
CREATE TABLE IF NOT EXISTS clientes_nichos_teses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id TEXT NOT NULL,
  nicho_id UUID NOT NULL REFERENCES nichos(id) ON DELETE CASCADE,
  tese_id UUID NOT NULL REFERENCES teses(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cliente_id, nicho_id, tese_id)
);

ALTER TABLE clientes_nichos_teses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "clientes_nichos_teses_all" ON clientes_nichos_teses FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_cnt_cliente ON clientes_nichos_teses(cliente_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cnt_nicho ON clientes_nichos_teses(nicho_id) WHERE deleted_at IS NULL;

-- 4. Vínculo campanha ↔ nicho ↔ tese
CREATE TABLE IF NOT EXISTS campanhas_nichos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL UNIQUE,
  campaign_name TEXT,
  cliente_id TEXT,
  nicho_id UUID REFERENCES nichos(id),
  tese_id UUID REFERENCES teses(id),
  vinculo_automatico BOOLEAN DEFAULT false,
  confirmado BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE campanhas_nichos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "campanhas_nichos_all" ON campanhas_nichos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_cn_cliente ON campanhas_nichos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cn_nicho ON campanhas_nichos(nicho_id);
