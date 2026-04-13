-- ============================================
-- MIGRATION: Módulo de Clientes Expandido
-- Novos campos em clientes, tabelas clientes_status_historico,
-- churn_consistencia_log + triggers de histórico e validação
-- ============================================

-- ========== 1a. Novos campos em clientes ==========

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS status_anterior TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS risco_churn TEXT
  CHECK (risco_churn IN ('baixo', 'medio', 'alto'));
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS risco_churn_motivo TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS obs_contrato TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS obs_contrato_atualizada_em TIMESTAMPTZ;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS obs_contrato_atualizada_por UUID;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS churn_validado BOOLEAN DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS churn_validado_em TIMESTAMPTZ;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS churn_validado_por UUID;

CREATE INDEX IF NOT EXISTS idx_clientes_risco_churn ON clientes(risco_churn);

-- ========== 1b. Tabela clientes_status_historico ==========

CREATE TABLE IF NOT EXISTS clientes_status_historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  alterado_por UUID,
  motivo TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_hist_cliente ON clientes_status_historico(cliente_id);

ALTER TABLE clientes_status_historico ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "clientes_hist_all" ON clientes_status_historico FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========== 1c. Tabela churn_consistencia_log ==========

CREATE TABLE IF NOT EXISTS churn_consistencia_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_referencia DATE NOT NULL,
  total_ativos_entrada INTEGER,
  total_ativos_churn INTEGER,
  divergencia INTEGER,
  clientes_divergentes JSONB,
  status TEXT NOT NULL CHECK (status IN ('ok', 'divergencia_detectada')),
  resolvido BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_churn_consist_mes ON churn_consistencia_log(mes_referencia);

ALTER TABLE churn_consistencia_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "churn_consist_all" ON churn_consistencia_log FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========== 2a. Trigger: registrar histórico de status ==========

CREATE OR REPLACE FUNCTION registrar_historico_status() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Salvar status anterior no próprio registro
    NEW.status_anterior := OLD.status;

    -- Inserir no histórico
    INSERT INTO clientes_status_historico (
      cliente_id, status_anterior, status_novo, alterado_por
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NULLIF(current_setting('app.current_user_id', true), '')::UUID
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_registrar_historico_status ON clientes;
CREATE TRIGGER trg_registrar_historico_status
  BEFORE UPDATE OF status ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION registrar_historico_status();

-- ========== 2b. Trigger: validar churn ==========
-- Churn só pode ser registrado para clientes que estão ativos.
-- Seta churn_validado e churn_validado_em.

CREATE OR REPLACE FUNCTION validar_churn() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelado' AND OLD.status != 'ativo' AND OLD.status != 'pausado' THEN
    RAISE EXCEPTION 'Churn só pode ser registrado para clientes ativos ou pausados. Status atual: %', OLD.status;
  END IF;

  IF NEW.status = 'cancelado' AND (OLD.status = 'ativo' OR OLD.status = 'pausado') THEN
    NEW.churn_validado := true;
    NEW.churn_validado_em := now();
    NEW.churn_validado_por := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validar_churn ON clientes;
CREATE TRIGGER trg_validar_churn
  BEFORE UPDATE OF status ON clientes
  FOR EACH ROW
  WHEN (NEW.status = 'cancelado')
  EXECUTE FUNCTION validar_churn();

-- ========== 2c. Trigger: reverter para não_iniciado (reativação) ==========
-- Se status muda de cancelado/pausado para ativo, deve ir para
-- um fluxo de revisão (não volta direto como ativo).
-- NOTA: o CHECK constraint atual da tabela é ('ativo','cancelado','pausado').
-- Vamos adicionar 'nao_iniciado' ao CHECK.

-- Expandir CHECK constraint para incluir 'nao_iniciado'
DO $$ BEGIN
  ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_status_check;
  ALTER TABLE clientes ADD CONSTRAINT clientes_status_check
    CHECK (status IN ('ativo', 'cancelado', 'pausado', 'nao_iniciado'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION reverter_para_nao_iniciado() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ativo' AND OLD.status IN ('cancelado') THEN
    NEW.status := 'nao_iniciado';

    INSERT INTO clientes_status_historico (
      cliente_id, status_anterior, status_novo, alterado_por, motivo
    ) VALUES (
      NEW.id,
      OLD.status,
      'nao_iniciado',
      NULLIF(current_setting('app.current_user_id', true), '')::UUID,
      'Reversão automática: reativação passa por nao_iniciado'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reverter_nao_iniciado ON clientes;
CREATE TRIGGER trg_reverter_nao_iniciado
  BEFORE UPDATE OF status ON clientes
  FOR EACH ROW
  WHEN (NEW.status = 'ativo' AND OLD.status = 'cancelado')
  EXECUTE FUNCTION reverter_para_nao_iniciado();

-- ========== 2d. Trigger: sincronizar churn → tabela clientes ==========
-- Quando status muda para 'cancelado', garantir data_cancelamento preenchida.

CREATE OR REPLACE FUNCTION sincronizar_churn_campos() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelado' THEN
    IF NEW.data_cancelamento IS NULL THEN
      NEW.data_cancelamento := CURRENT_DATE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sincronizar_churn ON clientes;
CREATE TRIGGER trg_sincronizar_churn
  BEFORE UPDATE OF status ON clientes
  FOR EACH ROW
  WHEN (NEW.status = 'cancelado')
  EXECUTE FUNCTION sincronizar_churn_campos();
