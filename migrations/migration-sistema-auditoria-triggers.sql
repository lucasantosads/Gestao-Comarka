-- ============================================
-- MIGRATION: Triggers globais de auditoria
-- Dependência: migration-sistema-infraestrutura.sql
-- Executar no SQL Editor do Supabase
-- ============================================

-- ============================================
-- Função genérica de auditoria para INSERT/UPDATE/DELETE
-- Captura OLD e NEW como jsonb em sistema_auditoria.
-- O backend deve setar SET LOCAL app.current_user_id = '{uuid}'
-- antes de queries críticas para identificar o usuário.
-- ============================================

CREATE OR REPLACE FUNCTION public.registrar_auditoria()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_modulo text;
BEGIN
  -- Tentar obter user_id do contexto da sessão
  BEGIN
    v_user_id := current_setting('app.current_user_id', true)::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  -- Determinar módulo baseado na tabela
  v_modulo := CASE TG_TABLE_NAME
    WHEN 'config_mensal' THEN 'config'
    WHEN 'metas_mensais' THEN 'projecoes'
    WHEN 'metas_closers' THEN 'closers'
    WHEN 'metas_sdr' THEN 'crm'
    WHEN 'trafego_regras_otimizacao' THEN 'trafego'
    WHEN 'comarka_pro_config' THEN 'comarka_pro'
    WHEN 'colaboradores_rh' THEN 'closers'
    WHEN 'asaas_pagamentos' THEN 'financeiro'
    WHEN 'clientes' THEN 'clientes'
    WHEN 'contratos' THEN 'crm'
    ELSE 'config'
  END;

  -- Capturar valores
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
  ELSE -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  END IF;

  INSERT INTO public.sistema_auditoria (
    user_id, acao, modulo, objeto_tipo, objeto_id,
    valor_anterior, valor_novo
  ) VALUES (
    v_user_id,
    TG_OP,
    v_modulo,
    TG_TABLE_NAME,
    COALESCE(
      CASE TG_OP WHEN 'DELETE' THEN (OLD).id::text ELSE (NEW).id::text END,
      'unknown'
    ),
    v_old,
    v_new
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Criar triggers nas tabelas críticas
-- ============================================

-- config_mensal
DROP TRIGGER IF EXISTS trg_auditoria_config_mensal ON public.config_mensal;
CREATE TRIGGER trg_auditoria_config_mensal
  AFTER INSERT OR UPDATE OR DELETE ON public.config_mensal
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

-- metas_mensais (se existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'metas_mensais' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_auditoria_metas_mensais ON public.metas_mensais;
    CREATE TRIGGER trg_auditoria_metas_mensais
      AFTER INSERT OR UPDATE OR DELETE ON public.metas_mensais
      FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
  END IF;
END $$;

-- metas_closers (se existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'metas_closers' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_auditoria_metas_closers ON public.metas_closers;
    CREATE TRIGGER trg_auditoria_metas_closers
      AFTER INSERT OR UPDATE OR DELETE ON public.metas_closers
      FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
  END IF;
END $$;

-- metas_sdr (se existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'metas_sdr' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_auditoria_metas_sdr ON public.metas_sdr;
    CREATE TRIGGER trg_auditoria_metas_sdr
      AFTER INSERT OR UPDATE OR DELETE ON public.metas_sdr
      FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
  END IF;
END $$;

-- trafego_regras_otimizacao (se existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trafego_regras_otimizacao' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_auditoria_trafego_regras ON public.trafego_regras_otimizacao;
    CREATE TRIGGER trg_auditoria_trafego_regras
      AFTER INSERT OR UPDATE OR DELETE ON public.trafego_regras_otimizacao
      FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
  END IF;
END $$;

-- comarka_pro_config (se existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comarka_pro_config' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_auditoria_comarka_pro_config ON public.comarka_pro_config;
    CREATE TRIGGER trg_auditoria_comarka_pro_config
      AFTER INSERT OR UPDATE OR DELETE ON public.comarka_pro_config
      FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
  END IF;
END $$;

-- colaboradores_rh (se existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'colaboradores_rh' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_auditoria_colaboradores_rh ON public.colaboradores_rh;
    CREATE TRIGGER trg_auditoria_colaboradores_rh
      AFTER INSERT OR UPDATE OR DELETE ON public.colaboradores_rh
      FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
  END IF;
END $$;

-- asaas_pagamentos (se existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'asaas_pagamentos' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_auditoria_asaas_pagamentos ON public.asaas_pagamentos;
    CREATE TRIGGER trg_auditoria_asaas_pagamentos
      AFTER INSERT OR UPDATE OR DELETE ON public.asaas_pagamentos
      FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
  END IF;
END $$;

-- clientes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clientes' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_auditoria_clientes ON public.clientes;
    CREATE TRIGGER trg_auditoria_clientes
      AFTER INSERT OR UPDATE OR DELETE ON public.clientes
      FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
  END IF;
END $$;

-- contratos
DROP TRIGGER IF EXISTS trg_auditoria_contratos ON public.contratos;
CREATE TRIGGER trg_auditoria_contratos
  AFTER INSERT OR UPDATE OR DELETE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

-- ============================================
-- Função específica para histórico de config
-- Dispara apenas em UPDATE de campos sem flag _manual
-- ============================================

CREATE OR REPLACE FUNCTION public.registrar_config_historico()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
  v_key text;
  v_old_val jsonb;
  v_new_val jsonb;
BEGIN
  BEGIN
    v_user_id := current_setting('app.current_user_id', true)::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  -- Iterar sobre as colunas alteradas
  FOR v_key IN SELECT key FROM jsonb_each(to_jsonb(NEW))
  LOOP
    -- Pular colunas de controle e colunas _manual
    IF v_key IN ('id', 'created_at', 'updated_at', 'criado_em', 'atualizado_em') THEN
      CONTINUE;
    END IF;
    IF v_key LIKE '%_manual' THEN
      CONTINUE;
    END IF;

    v_old_val := to_jsonb(OLD) -> v_key;
    v_new_val := to_jsonb(NEW) -> v_key;

    -- Só registrar se o valor realmente mudou
    IF v_old_val IS DISTINCT FROM v_new_val THEN
      INSERT INTO public.sistema_config_historico (
        tabela, campo, objeto_id, valor_anterior, valor_novo, alterado_por
      ) VALUES (
        TG_TABLE_NAME,
        v_key,
        (NEW).id::text,
        v_old_val,
        v_new_val,
        v_user_id
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger de histórico de config em config_mensal
DROP TRIGGER IF EXISTS trg_config_historico_config_mensal ON public.config_mensal;
CREATE TRIGGER trg_config_historico_config_mensal
  AFTER UPDATE ON public.config_mensal
  FOR EACH ROW EXECUTE FUNCTION public.registrar_config_historico();

-- Trigger de histórico de config em comarka_pro_config (se existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comarka_pro_config' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trg_config_historico_comarka_pro ON public.comarka_pro_config;
    CREATE TRIGGER trg_config_historico_comarka_pro
      AFTER UPDATE ON public.comarka_pro_config
      FOR EACH ROW EXECUTE FUNCTION public.registrar_config_historico();
  END IF;
END $$;
