-- ============================================
-- MIGRATION: Tráfego Pago — Tabelas e Índices
-- Executar no SQL Editor do Supabase (projeto ogfnojbbvumujzfklkhh)
-- ============================================

-- 1. ads_metadata — mapeamento ad_id → campanha/conjunto/anúncio
CREATE TABLE IF NOT EXISTS public.ads_metadata (
  ad_id text PRIMARY KEY,
  ad_name text,
  adset_id text,
  adset_name text,
  campaign_id text,
  campaign_name text,
  objetivo text,
  status text DEFAULT 'ACTIVE',
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_metadata_campaign ON public.ads_metadata(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ads_metadata_adset ON public.ads_metadata(adset_id);

ALTER TABLE public.ads_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on ads_metadata" ON public.ads_metadata FOR ALL USING (true) WITH CHECK (true);

-- 2. ads_performance — snapshot diário de métricas por anúncio
CREATE TABLE IF NOT EXISTS public.ads_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text REFERENCES public.ads_metadata(ad_id) ON DELETE CASCADE,
  data_ref date NOT NULL,
  impressoes int DEFAULT 0,
  cliques int DEFAULT 0,
  spend numeric(12,2) DEFAULT 0,
  leads int DEFAULT 0,
  cpl numeric(10,2) DEFAULT 0,
  ctr numeric(6,4) DEFAULT 0,
  cpc numeric(10,2) DEFAULT 0,
  frequencia numeric(6,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(ad_id, data_ref)
);

CREATE INDEX IF NOT EXISTS idx_ads_perf_ad ON public.ads_performance(ad_id);
CREATE INDEX IF NOT EXISTS idx_ads_perf_data ON public.ads_performance(data_ref);

ALTER TABLE public.ads_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on ads_performance" ON public.ads_performance FOR ALL USING (true) WITH CHECK (true);

-- 3. leads_ads_attribution — liga cada lead ao seu anúncio
CREATE TABLE IF NOT EXISTS public.leads_ads_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL,
  ad_id text REFERENCES public.ads_metadata(ad_id) ON DELETE SET NULL,
  adset_id text,
  campaign_id text,
  nome_lead text,
  telefone text,
  email text,
  created_at timestamptz DEFAULT now(),
  hora_chegada int GENERATED ALWAYS AS (EXTRACT(HOUR FROM created_at)::int) STORED,
  dia_semana int GENERATED ALWAYS AS (EXTRACT(DOW FROM created_at)::int) STORED,
  estagio_crm text DEFAULT 'novo',
  estagio_atualizado_em timestamptz DEFAULT now(),
  receita_gerada numeric(12,2) DEFAULT 0,
  gestor_id uuid,
  UNIQUE(lead_id)
);

CREATE INDEX IF NOT EXISTS idx_leads_attr_ad ON public.leads_ads_attribution(ad_id);
CREATE INDEX IF NOT EXISTS idx_leads_attr_campaign ON public.leads_ads_attribution(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_attr_adset ON public.leads_ads_attribution(adset_id);
CREATE INDEX IF NOT EXISTS idx_leads_attr_created ON public.leads_ads_attribution(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_attr_estagio ON public.leads_ads_attribution(estagio_crm);

ALTER TABLE public.leads_ads_attribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on leads_ads_attribution" ON public.leads_ads_attribution FOR ALL USING (true) WITH CHECK (true);

-- 4. leads_stages_history — histórico de evolução de estágio
CREATE TABLE IF NOT EXISTS public.leads_stages_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL,
  estagio_anterior text,
  estagio_novo text NOT NULL,
  alterado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stages_hist_lead ON public.leads_stages_history(lead_id);

ALTER TABLE public.leads_stages_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on leads_stages_history" ON public.leads_stages_history FOR ALL USING (true) WITH CHECK (true);
