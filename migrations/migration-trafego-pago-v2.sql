-- ============================================
-- MIGRATION: Tráfego Pago — Tabelas e Índices (v2)
-- Executar no SQL Editor do Supabase
-- ============================================

-- 1. ads_metadata
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

-- 2. ads_performance
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

-- 3. leads_ads_attribution (sem colunas geradas - preenchidas via trigger)
CREATE TABLE IF NOT EXISTS public.leads_ads_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL UNIQUE,
  ad_id text REFERENCES public.ads_metadata(ad_id) ON DELETE SET NULL,
  adset_id text,
  campaign_id text,
  nome_lead text,
  telefone text,
  email text,
  created_at timestamptz DEFAULT now(),
  hora_chegada int DEFAULT 0,
  dia_semana int DEFAULT 0,
  estagio_crm text DEFAULT 'novo',
  estagio_atualizado_em timestamptz DEFAULT now(),
  receita_gerada numeric(12,2) DEFAULT 0,
  gestor_id uuid
);

CREATE INDEX IF NOT EXISTS idx_leads_attr_ad ON public.leads_ads_attribution(ad_id);
CREATE INDEX IF NOT EXISTS idx_leads_attr_campaign ON public.leads_ads_attribution(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_attr_adset ON public.leads_ads_attribution(adset_id);
CREATE INDEX IF NOT EXISTS idx_leads_attr_created ON public.leads_ads_attribution(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_attr_estagio ON public.leads_ads_attribution(estagio_crm);

ALTER TABLE public.leads_ads_attribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on leads_ads_attribution" ON public.leads_ads_attribution FOR ALL USING (true) WITH CHECK (true);

-- Trigger para preencher hora_chegada e dia_semana automaticamente
CREATE OR REPLACE FUNCTION public.fill_lead_time_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hora_chegada := EXTRACT(HOUR FROM NEW.created_at AT TIME ZONE 'America/Sao_Paulo')::int;
  NEW.dia_semana := EXTRACT(DOW FROM NEW.created_at AT TIME ZONE 'America/Sao_Paulo')::int;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fill_lead_time ON public.leads_ads_attribution;
CREATE TRIGGER trg_fill_lead_time
  BEFORE INSERT ON public.leads_ads_attribution
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_lead_time_fields();

-- 4. leads_stages_history
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
