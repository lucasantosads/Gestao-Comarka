-- ============================================
-- MIGRATION: Dados extras de clientes (vinculados ao Notion)
-- Campos que não existem no Notion mas são necessários no dashboard
-- ============================================

CREATE TABLE IF NOT EXISTS clientes_extra (
  notion_id text PRIMARY KEY,
  nome text,
  -- Contas de mídia
  meta_account_id text,
  meta_account_name text,
  meta_access_ativo boolean DEFAULT false,
  google_customer_id text,
  google_account_name text,
  google_access_ativo boolean DEFAULT false,
  -- WhatsApp
  whatsapp_group_url text,
  whatsapp_resumo text,
  whatsapp_ultima_atualizacao timestamptz,
  -- Saúde do cliente
  saude_score int DEFAULT 50 CHECK (saude_score >= 0 AND saude_score <= 100),
  saude_observacao text,
  saude_tendencia text CHECK (saude_tendencia IN ('subindo', 'estavel', 'descendo') OR saude_tendencia IS NULL),
  -- IA
  ultima_analise_ia text,
  ultima_analise_ia_em timestamptz,
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clientes_extra ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "allow_all_clientes_extra" ON clientes_extra FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Histórico de otimizações também no Supabase (espelho do Notion + edição local)
CREATE TABLE IF NOT EXISTS otimizacoes_historico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notion_id text NOT NULL,
  data date NOT NULL,
  comentarios text,
  feito text,
  proxima_vez text,
  solicitado text,
  fonte text DEFAULT 'dashboard' CHECK (fonte IN ('dashboard', 'notion')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE otimizacoes_historico ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "allow_all_otimizacoes_historico" ON otimizacoes_historico FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_otimizacoes_historico_cliente ON otimizacoes_historico(notion_id);
CREATE INDEX IF NOT EXISTS idx_otimizacoes_historico_data ON otimizacoes_historico(data DESC);
