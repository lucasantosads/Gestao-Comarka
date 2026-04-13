-- ============================================
-- MIGRATION: Módulo Financeiro Expandido
-- Tabelas: asaas_pagamentos, asaas_auditoria,
--          financeiro_fluxo_caixa, financeiro_margem_cliente,
--          financeiro_exportacoes
-- ============================================

-- 1a. Tabela de pagamentos Asaas
CREATE TABLE IF NOT EXISTS asaas_pagamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asaas_id TEXT UNIQUE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  contrato_id UUID,
  descricao TEXT,
  valor NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'received', 'confirmed', 'overdue', 'refunded')),
  data_vencimento DATE,
  data_pagamento DATE,
  tipo TEXT DEFAULT 'boleto'
    CHECK (tipo IN ('boleto', 'pix', 'credit_card', 'outros')),
  match_status TEXT DEFAULT 'pendente'
    CHECK (match_status IN ('pendente', 'conciliado_auto', 'conciliado_manual', 'sem_match')),
  match_tentativas INTEGER DEFAULT 0,
  aprovacao_criacao_status TEXT
    CHECK (aprovacao_criacao_status IN ('aguardando', 'aprovado', 'reprovado')),
  aprovacao_criacao_por UUID,
  aprovacao_criacao_em TIMESTAMPTZ,
  aprovacao_recebimento_status TEXT
    CHECK (aprovacao_recebimento_status IN ('aguardando', 'aprovado', 'reprovado')),
  aprovacao_recebimento_por UUID,
  aprovacao_recebimento_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Índices asaas_pagamentos
CREATE INDEX IF NOT EXISTS idx_asaas_pag_cliente ON asaas_pagamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_asaas_pag_contrato ON asaas_pagamentos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_asaas_pag_match ON asaas_pagamentos(match_status);
CREATE INDEX IF NOT EXISTS idx_asaas_pag_status ON asaas_pagamentos(status);
CREATE INDEX IF NOT EXISTS idx_asaas_pag_vencimento ON asaas_pagamentos(data_vencimento);

ALTER TABLE asaas_pagamentos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "asaas_pag_all" ON asaas_pagamentos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1b. Tabela de auditoria Asaas
CREATE TABLE IF NOT EXISTS asaas_auditoria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pagamento_id UUID REFERENCES asaas_pagamentos(id) ON DELETE CASCADE,
  acao TEXT NOT NULL
    CHECK (acao IN (
      'criacao_solicitada', 'criacao_aprovada', 'criacao_reprovada',
      'recebimento_solicitado', 'recebimento_aprovado', 'recebimento_reprovado',
      'conciliacao_auto', 'conciliacao_manual', 'sem_match'
    )),
  executado_por UUID,
  observacao TEXT,
  ip_sessao TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE asaas_auditoria ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "asaas_aud_all" ON asaas_auditoria FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1c. Tabela de fluxo de caixa projetado
CREATE TABLE IF NOT EXISTS financeiro_fluxo_caixa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_referencia DATE NOT NULL,
  cenario TEXT NOT NULL
    CHECK (cenario IN ('otimista', 'realista', 'pessimista')),
  receita_projetada NUMERIC(12,2) DEFAULT 0,
  custos_projetados NUMERIC(12,2) DEFAULT 0,
  resultado_projetado NUMERIC(12,2) DEFAULT 0,
  churn_impacto NUMERIC(12,2) DEFAULT 0,
  detalhamento JSONB,
  calculado_em TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (mes_referencia, cenario)
);

ALTER TABLE financeiro_fluxo_caixa ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "fin_fc_all" ON financeiro_fluxo_caixa FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1d. Tabela de margem por cliente
CREATE TABLE IF NOT EXISTS financeiro_margem_cliente (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,
  receita NUMERIC(12,2) DEFAULT 0,
  custo_midia NUMERIC(12,2) DEFAULT 0,
  custo_gestor NUMERIC(12,2) DEFAULT 0,
  margem_bruta NUMERIC(12,2) DEFAULT 0,
  margem_liquida NUMERIC(12,2) DEFAULT 0,
  margem_pct NUMERIC(8,2) DEFAULT 0,
  calculado_em TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (cliente_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_fin_margem_cliente ON financeiro_margem_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fin_margem_mes ON financeiro_margem_cliente(mes_referencia);

ALTER TABLE financeiro_margem_cliente ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "fin_margem_all" ON financeiro_margem_cliente FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1e. Tabela de exportações financeiras
CREATE TABLE IF NOT EXISTS financeiro_exportacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_referencia DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('csv', 'pdf')),
  gerado_por UUID,
  url TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE financeiro_exportacoes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "fin_exp_all" ON financeiro_exportacoes FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
