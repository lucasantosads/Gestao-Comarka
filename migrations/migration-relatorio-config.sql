-- ============================================
-- MIGRATION: Relatório Semanal Config
-- Executar no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS public.relatorio_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome text NOT NULL,
  whatsapp text NOT NULL,
  dia_semana int DEFAULT 1, -- 0=dom, 1=seg, 2=ter...
  hora int DEFAULT 8,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE public.relatorio_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on relatorio_config" ON public.relatorio_config FOR ALL USING (true) WITH CHECK (true);
