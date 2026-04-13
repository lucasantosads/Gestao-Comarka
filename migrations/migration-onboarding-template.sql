-- ============================================
-- MIGRATION: Onboarding Template + Tracking
-- ============================================

-- Template do checklist padrão (uma linha por item)
CREATE TABLE IF NOT EXISTS onboarding_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem INT NOT NULL DEFAULT 0,
  secao TEXT NOT NULL,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE onboarding_template_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "onb_template_all" ON onboarding_template_items FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tracking de tempo de cada onboarding
CREATE TABLE IF NOT EXISTS onboarding_tracking (
  notion_id TEXT PRIMARY KEY,
  cliente_nome TEXT,
  iniciado_em TIMESTAMPTZ DEFAULT now(),
  finalizado_em TIMESTAMPTZ,
  tempo_total_segundos INT,
  etapa_atual TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE onboarding_tracking ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "onb_tracking_all" ON onboarding_tracking FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed do checklist padrão (estrutura mapeada das páginas existentes)
INSERT INTO onboarding_template_items (ordem, secao, texto) VALUES
  -- Passagem de bastão
  (10, 'Passagem de bastão', 'Colocar resumo da reunião do CRM'),

  -- Administrativo e Financeiro
  (20, 'Administrativo e Financeiro', 'Verificar contrato assinado + dados conferidos'),
  (21, 'Administrativo e Financeiro', 'Cadastrar no Asaas'),
  (22, 'Administrativo e Financeiro', 'Apresentação e primeiro boleto'),
  (23, 'Administrativo e Financeiro', 'Pagamento confirmado'),
  (24, 'Administrativo e Financeiro', 'Nota fiscal emitida'),
  (25, 'Administrativo e Financeiro', 'Grupo WhatsApp criado (padrão: Cliente - Comarka Ads)'),
  (26, 'Administrativo e Financeiro', 'Foto da logo no grupo'),

  -- Entrada pt.1 (Gestor Junior)
  (30, 'Entrada', 'Criar em Clientes com Status "Não iniciado"'),
  (31, 'Entrada', 'Briefing preenchido + transcrito'),
  (32, 'Entrada', 'Pesquisa de mercado (concorrentes, biblioteca Meta, Answer the Public)'),
  (33, 'Entrada', 'Portal do cliente criado + links configurados'),
  (34, 'Entrada', 'Planilha de leads criada'),
  (35, 'Entrada', 'Planilha de controle financeiro enviada'),
  (36, 'Entrada', 'Portal de aulas enviado'),

  -- Entrada pt.2 (CS)
  (40, 'Entrada', 'Criar cliente no NPS'),
  (41, 'Entrada', 'Reunião de onboarding agendada'),

  -- Conexões do cliente
  (50, 'Conexões do cliente', 'Facebook Ads: conexão de contas, página, pixel, ABNT'),
  (51, 'Conexões do cliente', 'Google Ads: acesso, TAG, conversões, GTM, palavras-chave'),
  (52, 'Conexões do cliente', 'Conta backup criada'),
  (53, 'Conexões do cliente', 'Dados empresariais e logo'),
  (54, 'Conexões do cliente', 'Formas de pagamento'),
  (55, 'Conexões do cliente', 'API de conversões / Pixel'),
  (56, 'Conexões do cliente', 'Cadastro na automação de relatórios + checkbox Automação marcado'),

  -- Ações finais
  (60, 'Ações finais', 'Anúncios iniciados'),
  (61, 'Ações finais', 'Mensagem de ativação enviada no grupo'),
  (62, 'Ações finais', 'Status atualizado para "Ativo" na página de Clientes')
ON CONFLICT DO NOTHING;
