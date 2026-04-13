-- ============================================================
-- FIX 1: TRIGGER DE DECREMENTO DE LEADS
-- Quando um lead é deletado de leads_crm, decrementa
-- config_mensal.leads_totais do mês correspondente.
-- ============================================================

-- Primeiro, dropar trigger antigo de decremento se existir
DROP TRIGGER IF EXISTS trg_decrement_leads ON leads_crm;
DROP FUNCTION IF EXISTS fn_decrement_leads();

CREATE OR REPLACE FUNCTION fn_decrement_leads()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrementar leads_totais do mês de referência do lead deletado
  UPDATE config_mensal
  SET leads_totais = GREATEST(0, COALESCE(leads_totais, 0) - 1)
  WHERE mes_referencia = OLD.mes_referencia;

  -- Também limpar a atribuição de ads se existir
  DELETE FROM leads_ads_attribution
  WHERE lead_id = OLD.ghl_contact_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_decrement_leads
  AFTER DELETE ON leads_crm
  FOR EACH ROW
  EXECUTE FUNCTION fn_decrement_leads();


-- ============================================================
-- FIX 2: PROTEGER mes_referencia CONTRA SOBRESCRITA
-- Quando um lead é atualizado (ex: muda de etapa), o n8n
-- faz upsert que sobrescreve mes_referencia com o mês atual.
-- Este trigger preserva o mes_referencia original.
-- ============================================================

DROP TRIGGER IF EXISTS trg_preserve_mes_referencia ON leads_crm;
DROP FUNCTION IF EXISTS fn_preserve_mes_referencia();

CREATE OR REPLACE FUNCTION fn_preserve_mes_referencia()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o registro já existia (UPDATE via upsert), preservar o mes_referencia original
  -- Só permite mudar mes_referencia se o antigo era NULL
  IF OLD.mes_referencia IS NOT NULL AND NEW.mes_referencia IS DISTINCT FROM OLD.mes_referencia THEN
    NEW.mes_referencia := OLD.mes_referencia;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_preserve_mes_referencia
  BEFORE UPDATE ON leads_crm
  FOR EACH ROW
  EXECUTE FUNCTION fn_preserve_mes_referencia();


-- ============================================================
-- FIX 3: RECALCULAR leads_totais PARA CORRIGIR DRIFT HISTÓRICO
-- Se o contador já divergiu, isso reconcilia com a contagem real.
-- ============================================================

-- Corrigir leads_totais para todos os meses baseado na contagem real
UPDATE config_mensal cm
SET leads_totais = sub.real_count
FROM (
  SELECT mes_referencia, COUNT(*) as real_count
  FROM leads_crm
  GROUP BY mes_referencia
) sub
WHERE cm.mes_referencia = sub.mes_referencia
  AND cm.leads_totais != sub.real_count;


-- ============================================================
-- VERIFICAÇÃO: Listar meses onde o contador diverge
-- Execute SELECT separado para verificar se está tudo ok
-- ============================================================

-- SELECT
--   cm.mes_referencia,
--   cm.leads_totais as contador,
--   COUNT(lc.id) as real_count,
--   cm.leads_totais - COUNT(lc.id) as drift
-- FROM config_mensal cm
-- LEFT JOIN leads_crm lc ON lc.mes_referencia = cm.mes_referencia
-- GROUP BY cm.mes_referencia, cm.leads_totais
-- HAVING cm.leads_totais != COUNT(lc.id)
-- ORDER BY cm.mes_referencia;
