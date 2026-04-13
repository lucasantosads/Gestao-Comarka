-- =============================================
-- Migration: Módulo de Tráfego Expandido
-- Data: 2026-04-09
-- Tabelas: trafego_regras_otimizacao, trafego_regras_historico,
--          trafego_criativos, trafego_criativo_metricas,
--          trafego_anomalias, trafego_performance_temporal
-- =============================================

-- 1a. Regras de otimização
CREATE TABLE IF NOT EXISTS trafego_regras_otimizacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  metrica text NOT NULL CHECK (metrica IN ('cpl','ctr','frequencia','cpc','roas','leads_dia','spend_dia')),
  operador text NOT NULL CHECK (operador IN ('>=','<=','>','<','=')),
  threshold numeric NOT NULL,
  acao_sugerida text NOT NULL CHECK (acao_sugerida IN ('pausar_anuncio','pausar_conjunto','pausar_campanha','reduzir_orcamento','trocar_criativo','revisar_copy','revisar_publico')),
  acao_automatica boolean DEFAULT false,
  prioridade integer DEFAULT 1 CHECK (prioridade IN (1,2,3)),
  ativo boolean DEFAULT true,
  criado_por uuid REFERENCES auth.users(id),
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE trafego_regras_otimizacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trafego_regras_otimizacao_all" ON trafego_regras_otimizacao FOR ALL USING (true);

-- 1b. Histórico de disparo de regras
CREATE TABLE IF NOT EXISTS trafego_regras_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id uuid REFERENCES trafego_regras_otimizacao(id),
  ad_id text,
  adset_id text,
  campaign_id text,
  cliente_id uuid REFERENCES clientes_notion_mirror(notion_id),
  acao text CHECK (acao IN ('disparada','aplicada','ignorada','falsa_positiva')),
  valor_metrica_no_momento numeric,
  aplicada_por uuid REFERENCES auth.users(id),
  observacao text,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE trafego_regras_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trafego_regras_historico_all" ON trafego_regras_historico FOR ALL USING (true);

-- 1c. Criativos
CREATE TABLE IF NOT EXISTS trafego_criativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text,
  cliente_id uuid REFERENCES clientes_notion_mirror(notion_id),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('video','imagem','roteiro')),
  arquivo_url text,
  copy_texto text,
  roteiro_texto text,
  transcricao_status text DEFAULT 'pendente' CHECK (transcricao_status IN ('pendente','processando','concluido','erro','manual')),
  transcricao_texto text,
  analise_status text DEFAULT 'pendente' CHECK (analise_status IN ('pendente','processando','concluido','erro')),
  analise_resultado jsonb,
  score_final numeric,
  status_veiculacao text DEFAULT 'ativo' CHECK (status_veiculacao IN ('ativo','pausado','fadigado','arquivado')),
  data_inicio_veiculacao date,
  data_fim_veiculacao date,
  nicho text,
  deleted_at timestamptz,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE trafego_criativos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trafego_criativos_all" ON trafego_criativos FOR ALL USING (true);

-- 1d. Métricas mensais de criativos
CREATE TABLE IF NOT EXISTS trafego_criativo_metricas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criativo_id uuid REFERENCES trafego_criativos(id),
  mes_referencia date NOT NULL,
  cpl numeric,
  ctr numeric,
  spend numeric,
  leads integer,
  impressoes integer,
  frequencia numeric,
  score_periodo numeric,
  fase_ciclo_vida text CHECK (fase_ciclo_vida IN ('aquecimento','pico','estavel','fadiga','encerrado')),
  UNIQUE (criativo_id, mes_referencia)
);

ALTER TABLE trafego_criativo_metricas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trafego_criativo_metricas_all" ON trafego_criativo_metricas FOR ALL USING (true);

-- 1e. Anomalias
CREATE TABLE IF NOT EXISTS trafego_anomalias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text,
  adset_id text,
  campaign_id text,
  cliente_id uuid REFERENCES clientes_notion_mirror(notion_id),
  tipo text NOT NULL CHECK (tipo IN ('gasto_zerado','cpl_dobrou','leads_zerados','spend_esgotando','spend_sobrando','performance_queda_brusca')),
  valor_anterior numeric,
  valor_atual numeric,
  causa_provavel text,
  resolvida boolean DEFAULT false,
  resolvida_em timestamptz,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE trafego_anomalias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trafego_anomalias_all" ON trafego_anomalias FOR ALL USING (true);

-- 1f. Performance temporal
CREATE TABLE IF NOT EXISTS trafego_performance_temporal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES clientes_notion_mirror(notion_id),
  dia_semana integer CHECK (dia_semana BETWEEN 0 AND 6),
  hora integer CHECK (hora BETWEEN 0 AND 23),
  mes_referencia date,
  total_leads integer DEFAULT 0,
  cpl_medio numeric,
  taxa_qualificacao numeric,
  total_spend numeric,
  calculado_em timestamptz DEFAULT now(),
  UNIQUE (cliente_id, dia_semana, hora, mes_referencia)
);

ALTER TABLE trafego_performance_temporal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trafego_performance_temporal_all" ON trafego_performance_temporal FOR ALL USING (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_trafego_criativos_ad_id ON trafego_criativos(ad_id);
CREATE INDEX IF NOT EXISTS idx_trafego_criativos_cliente_id ON trafego_criativos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_trafego_regras_historico_regra_id ON trafego_regras_historico(regra_id);
CREATE INDEX IF NOT EXISTS idx_trafego_anomalias_cliente_id ON trafego_anomalias(cliente_id);
CREATE INDEX IF NOT EXISTS idx_trafego_performance_temporal_cliente_id ON trafego_performance_temporal(cliente_id);

-- Seed inicial de regras (somente se tabela vazia)
INSERT INTO trafego_regras_otimizacao (nome, metrica, operador, threshold, acao_sugerida, prioridade, ativo)
SELECT * FROM (VALUES
  ('CPL acima de R$150', 'cpl', '>=', 150, 'pausar_conjunto', 3, true),
  ('CTR abaixo de 1%', 'ctr', '<', 1, 'revisar_copy', 2, true),
  ('Frequência acima de 3.5', 'frequencia', '>=', 3.5, 'trocar_criativo', 2, true),
  ('Zero leads com spend > R$50/dia', 'leads_dia', '=', 0, 'pausar_anuncio', 3, true),
  ('ROAS abaixo de 3', 'roas', '<', 3, 'revisar_publico', 2, true)
) AS seed(nome, metrica, operador, threshold, acao_sugerida, prioridade, ativo)
WHERE NOT EXISTS (SELECT 1 FROM trafego_regras_otimizacao LIMIT 1);
