-- ============================================
-- FIX: Índices + Seed que faltaram
-- Rodar após as tabelas já existirem
-- ============================================

-- Seed em sistema_integracao_status (somente se vazia)
INSERT INTO public.sistema_integracao_status (nome)
SELECT nome FROM unnest(ARRAY[
  'ghl', 'meta_ads', 'n8n', 'asaas', 'evolution_api',
  'supabase', 'tldv', 'fathom', 'notion', 'google_drive'
]) AS nome
WHERE NOT EXISTS (SELECT 1 FROM public.sistema_integracao_status LIMIT 1);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sistema_auditoria_user_id ON public.sistema_auditoria(user_id);
CREATE INDEX IF NOT EXISTS idx_sistema_auditoria_modulo ON public.sistema_auditoria(modulo);
CREATE INDEX IF NOT EXISTS idx_sistema_auditoria_criado_em ON public.sistema_auditoria(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_sistema_fila_erros_status ON public.sistema_fila_erros(status);
CREATE INDEX IF NOT EXISTS idx_sistema_fila_erros_origem ON public.sistema_fila_erros(origem);
CREATE INDEX IF NOT EXISTS idx_sistema_rate_limit_servico ON public.sistema_rate_limit_log(servico);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sistema_rate_limit_servico_hora ON public.sistema_rate_limit_log(servico, data_hora);
