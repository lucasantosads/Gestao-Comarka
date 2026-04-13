-- ============================================
-- MIGRATION: Infraestrutura de Sistema
-- Tabelas: sistema_integracao_status, sistema_fila_erros,
--          sistema_auditoria, sistema_config_historico,
--          sistema_backups, sistema_rate_limit_log
-- Executar no SQL Editor do Supabase
-- ============================================

-- 1a. Status das integrações
CREATE TABLE IF NOT EXISTS public.sistema_integracao_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL,
  status text DEFAULT 'desconhecido'
    CHECK (status IN ('online', 'degradado', 'offline', 'desconhecido')),
  ultimo_ping_em timestamptz,
  ultimo_ping_sucesso_em timestamptz,
  latencia_ms integer,
  latencia_media_ms integer,
  mensagem_erro text,
  atualizado_em timestamptz DEFAULT now()
);

ALTER TABLE public.sistema_integracao_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on sistema_integracao_status"
  ON public.sistema_integracao_status FOR ALL USING (true) WITH CHECK (true);

-- Seed com todas as integrações (somente se tabela vazia)
INSERT INTO public.sistema_integracao_status (nome)
SELECT nome FROM unnest(ARRAY[
  'ghl', 'meta_ads', 'n8n', 'asaas', 'evolution_api',
  'supabase', 'tldv', 'fathom', 'notion', 'google_drive'
]) AS nome
WHERE NOT EXISTS (SELECT 1 FROM public.sistema_integracao_status LIMIT 1);

-- 1b. Fila de erros do sistema
CREATE TABLE IF NOT EXISTS public.sistema_fila_erros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem text NOT NULL
    CHECK (origem IN (
      'webhook_ghl', 'webhook_tldv', 'webhook_fathom', 'webhook_asaas',
      'n8n_sync', 'meta_api', 'evolution_api', 'notion', 'google_drive'
    )),
  tipo_erro text NOT NULL,
  mensagem text NOT NULL,
  payload jsonb,
  tentativas integer DEFAULT 0,
  max_tentativas integer DEFAULT 3,
  status text DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'processando', 'resolvido', 'ignorado', 'falhou')),
  resolvido_por uuid REFERENCES auth.users(id),
  resolvido_em timestamptz,
  proxima_tentativa_em timestamptz,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE public.sistema_fila_erros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on sistema_fila_erros"
  ON public.sistema_fila_erros FOR ALL USING (true) WITH CHECK (true);

-- 1c. Auditoria de ações
CREATE TABLE IF NOT EXISTS public.sistema_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  user_nome text,
  acao text NOT NULL,
  modulo text NOT NULL
    CHECK (modulo IN (
      'trafego', 'financeiro', 'crm', 'closers', 'clientes',
      'projecoes', 'comarka_pro', 'config', 'portal'
    )),
  objeto_tipo text,
  objeto_id text,
  valor_anterior jsonb,
  valor_novo jsonb,
  ip text,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE public.sistema_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on sistema_auditoria"
  ON public.sistema_auditoria FOR ALL USING (true) WITH CHECK (true);

-- 1d. Histórico de alterações de configuração
CREATE TABLE IF NOT EXISTS public.sistema_config_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  campo text NOT NULL,
  objeto_id text NOT NULL,
  valor_anterior jsonb,
  valor_novo jsonb,
  alterado_por uuid REFERENCES auth.users(id),
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE public.sistema_config_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on sistema_config_historico"
  ON public.sistema_config_historico FOR ALL USING (true) WITH CHECK (true);

-- 1e. Backups
CREATE TABLE IF NOT EXISTS public.sistema_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL
    CHECK (status IN ('processando', 'concluido', 'falhou')),
  tabelas_incluidas text[],
  tamanho_bytes bigint,
  google_drive_file_id text,
  google_drive_url text,
  mensagem_erro text,
  iniciado_em timestamptz DEFAULT now(),
  concluido_em timestamptz
);

ALTER TABLE public.sistema_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on sistema_backups"
  ON public.sistema_backups FOR ALL USING (true) WITH CHECK (true);

-- 1f. Rate limit log
CREATE TABLE IF NOT EXISTS public.sistema_rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico text NOT NULL
    CHECK (servico IN ('meta_ads', 'ghl', 'asaas', 'evolution_api')),
  endpoint text,
  chamadas_hora integer DEFAULT 0,
  limite_hora integer,
  chamadas_dia integer DEFAULT 0,
  limite_dia integer,
  pct_utilizado numeric,
  data_hora timestamptz DEFAULT now()
);

ALTER TABLE public.sistema_rate_limit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on sistema_rate_limit_log"
  ON public.sistema_rate_limit_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- ÍNDICES
-- ============================================

-- Unique por serviço+hora: o job de rate-limit garante 1 registro por hora
-- no código (upsert). Sem coluna generated — unique simples com data_hora.
-- O código já faz a deduplicação por hora via query com gte/lt na hora cheia.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sistema_rate_limit_servico_hora
  ON public.sistema_rate_limit_log (servico, data_hora);

CREATE INDEX IF NOT EXISTS idx_sistema_auditoria_user_id ON public.sistema_auditoria(user_id);
CREATE INDEX IF NOT EXISTS idx_sistema_auditoria_modulo ON public.sistema_auditoria(modulo);
CREATE INDEX IF NOT EXISTS idx_sistema_auditoria_criado_em ON public.sistema_auditoria(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_sistema_fila_erros_status ON public.sistema_fila_erros(status);
CREATE INDEX IF NOT EXISTS idx_sistema_fila_erros_origem ON public.sistema_fila_erros(origem);
CREATE INDEX IF NOT EXISTS idx_sistema_rate_limit_servico ON public.sistema_rate_limit_log(servico);
