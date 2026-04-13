-- ============================================
-- MIGRATION: Alertas Config + Placement Breakdown
-- Executar no SQL Editor do Supabase
-- ============================================

-- 1. Tabela de configuração de alertas
CREATE TABLE IF NOT EXISTS public.alertas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL, -- cpl_max, ctr_min, frequencia_max, zero_leads
  threshold numeric(10,2) NOT NULL,
  campaign_id text, -- null = global
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE public.alertas_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on alertas_config" ON public.alertas_config FOR ALL USING (true) WITH CHECK (true);

-- 2. Tabela de snooze de alertas
CREATE TABLE IF NOT EXISTS public.alertas_snooze (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text NOT NULL,
  tipo text NOT NULL,
  snooze_ate timestamptz NOT NULL,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE public.alertas_snooze ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on alertas_snooze" ON public.alertas_snooze FOR ALL USING (true) WITH CHECK (true);

-- 3. Coluna de placement breakdown na ads_performance
ALTER TABLE public.ads_performance ADD COLUMN IF NOT EXISTS placement_breakdown jsonb;
