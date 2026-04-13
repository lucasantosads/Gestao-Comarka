-- ============================================================
-- AD INTELLIGENCE MODULE — Schema
-- ============================================================

-- 1. Eventos do funil por lead (rastreia cada etapa)
CREATE TABLE IF NOT EXISTS lead_funnel_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id text NOT NULL,
  ad_id text,
  event_type text NOT NULL CHECK (event_type IN (
    'entrada', 'qualificado', 'desqualificado',
    'reuniao_agendada', 'reuniao_realizada', 'no_show',
    'proposta_enviada', 'contrato_fechado', 'churn'
  )),
  event_at timestamptz DEFAULT now(),
  closer_id uuid,
  mrr_value numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lfe_lead_id ON lead_funnel_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lfe_ad_id ON lead_funnel_events(ad_id);
CREATE INDEX IF NOT EXISTS idx_lfe_event_type ON lead_funnel_events(event_type);

-- 2. Scores de criativos (calculado a partir dos eventos)
CREATE TABLE IF NOT EXISTS creative_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id text UNIQUE NOT NULL,
  ad_name text,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  total_leads int DEFAULT 0,
  qualified_leads int DEFAULT 0,
  disqualified_leads int DEFAULT 0,
  meetings_scheduled int DEFAULT 0,
  meetings_held int DEFAULT 0,
  no_shows int DEFAULT 0,
  proposals_sent int DEFAULT 0,
  contracts_closed int DEFAULT 0,
  total_mrr numeric DEFAULT 0,
  spend numeric DEFAULT 0,
  qualification_rate numeric GENERATED ALWAYS AS (
    CASE WHEN total_leads > 0 THEN qualified_leads::numeric / total_leads ELSE 0 END
  ) STORED,
  meeting_rate numeric GENERATED ALWAYS AS (
    CASE WHEN qualified_leads > 0 THEN meetings_scheduled::numeric / qualified_leads ELSE 0 END
  ) STORED,
  close_rate numeric GENERATED ALWAYS AS (
    CASE WHEN meetings_held > 0 THEN contracts_closed::numeric / meetings_held ELSE 0 END
  ) STORED,
  no_show_rate numeric GENERATED ALWAYS AS (
    CASE WHEN meetings_scheduled > 0 THEN no_shows::numeric / meetings_scheduled ELSE 0 END
  ) STORED,
  cac numeric GENERATED ALWAYS AS (
    CASE WHEN contracts_closed > 0 THEN spend / contracts_closed ELSE 0 END
  ) STORED,
  composite_score numeric DEFAULT 0,
  alert_status text DEFAULT 'ok' CHECK (alert_status IN ('ok', 'warning', 'critical', 'high_performer')),
  alert_message text,
  last_updated timestamptz DEFAULT now()
);

-- 3. Performance por audiência/conjunto
CREATE TABLE IF NOT EXISTS audience_performance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  adset_id text UNIQUE NOT NULL,
  adset_name text,
  campaign_id text,
  campaign_name text,
  total_leads int DEFAULT 0,
  qualified_leads int DEFAULT 0,
  meetings int DEFAULT 0,
  contracts int DEFAULT 0,
  total_mrr numeric DEFAULT 0,
  spend numeric DEFAULT 0,
  composite_score numeric DEFAULT 0,
  alert_status text DEFAULT 'ok',
  last_updated timestamptz DEFAULT now()
);

-- 4. Views
CREATE OR REPLACE VIEW v_creative_ranking AS
SELECT cs.*,
  COALESCE(ap.spend, 0) as total_spend_meta
FROM creative_scores cs
LEFT JOIN (
  SELECT ad_id, SUM(spend) as spend
  FROM ads_performance
  GROUP BY ad_id
) ap ON ap.ad_id = cs.ad_id
ORDER BY cs.composite_score DESC;

CREATE OR REPLACE VIEW v_audience_ranking AS
SELECT * FROM audience_performance
ORDER BY composite_score DESC;

CREATE OR REPLACE VIEW v_creative_alerts AS
SELECT * FROM creative_scores
WHERE alert_status != 'ok'
ORDER BY
  CASE alert_status
    WHEN 'critical' THEN 1
    WHEN 'warning' THEN 2
    WHEN 'high_performer' THEN 3
  END;

CREATE OR REPLACE VIEW v_funnel_by_ad AS
SELECT
  ad_id,
  COUNT(*) FILTER (WHERE event_type = 'entrada') as entradas,
  COUNT(*) FILTER (WHERE event_type = 'qualificado') as qualificados,
  COUNT(*) FILTER (WHERE event_type = 'desqualificado') as desqualificados,
  COUNT(*) FILTER (WHERE event_type = 'reuniao_agendada') as reunioes_agendadas,
  COUNT(*) FILTER (WHERE event_type = 'reuniao_realizada') as reunioes_realizadas,
  COUNT(*) FILTER (WHERE event_type = 'no_show') as no_shows,
  COUNT(*) FILTER (WHERE event_type = 'proposta_enviada') as propostas,
  COUNT(*) FILTER (WHERE event_type = 'contrato_fechado') as contratos,
  COALESCE(SUM(mrr_value) FILTER (WHERE event_type = 'contrato_fechado'), 0) as mrr_total
FROM lead_funnel_events
WHERE ad_id IS NOT NULL
GROUP BY ad_id;

-- RLS
ALTER TABLE lead_funnel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_lfe" ON lead_funnel_events FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE creative_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_cs" ON creative_scores FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE audience_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_ap" ON audience_performance FOR ALL USING (true) WITH CHECK (true);
