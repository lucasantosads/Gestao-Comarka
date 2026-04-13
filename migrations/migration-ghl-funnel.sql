-- Tabela para armazenar snapshot do funil GHL
-- Atualizada periodicamente via n8n

CREATE TABLE IF NOT EXISTS ghl_funnel_snapshot (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_name text NOT NULL,
  pipeline_id text NOT NULL,
  stage_name text NOT NULL,
  stage_position int NOT NULL,
  opp_count int DEFAULT 0,
  won_count int DEFAULT 0,
  lost_count int DEFAULT 0,
  open_count int DEFAULT 0,
  monetary_value numeric(12,2) DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(pipeline_id, stage_name)
);

-- Tabela para alertas do SDR
CREATE TABLE IF NOT EXISTS ghl_sdr_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL,
  msg text NOT NULL,
  count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
