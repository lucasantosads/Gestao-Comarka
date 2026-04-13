-- ============================================
-- TRIGGER: Auto-popular leads_ads_attribution
-- quando um lead com ad_id é inserido em leads_crm
-- Executar no SQL Editor do Supabase
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_lead_to_ads_attribution()
RETURNS TRIGGER AS $$
BEGIN
  -- Só insere se o lead tem ad_id preenchido
  IF NEW.ad_id IS NOT NULL AND NEW.ad_id != '' THEN
    INSERT INTO public.leads_ads_attribution (
      lead_id, ad_id, adset_id, campaign_id,
      nome_lead, telefone, email,
      created_at, estagio_crm, estagio_atualizado_em,
      receita_gerada
    )
    VALUES (
      NEW.ghl_contact_id, NEW.ad_id, NEW.adset_id, NEW.campaign_id,
      NEW.nome, NEW.telefone, NEW.email,
      NEW.created_at, NEW.etapa, now(),
      CASE WHEN NEW.etapa IN ('comprou', 'assinatura_contrato') THEN COALESCE(NEW.valor_total_projeto, 0) ELSE 0 END
    )
    ON CONFLICT (lead_id) DO UPDATE SET
      estagio_crm = EXCLUDED.estagio_crm,
      estagio_atualizado_em = now(),
      receita_gerada = CASE WHEN EXCLUDED.estagio_crm IN ('comprou', 'assinatura_contrato') THEN COALESCE(NEW.valor_total_projeto, 0) ELSE leads_ads_attribution.receita_gerada END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_lead_ads ON public.leads_crm;
CREATE TRIGGER trg_sync_lead_ads
  AFTER INSERT OR UPDATE ON public.leads_crm
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lead_to_ads_attribution();

-- ============================================
-- TRIGGER: Registrar mudança de estágio em leads_stages_history
-- quando leads_ads_attribution.estagio_crm muda
-- ============================================

CREATE OR REPLACE FUNCTION public.log_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estagio_crm IS DISTINCT FROM NEW.estagio_crm THEN
    INSERT INTO public.leads_stages_history (lead_id, estagio_anterior, estagio_novo)
    VALUES (NEW.lead_id, OLD.estagio_crm, NEW.estagio_crm);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_stage ON public.leads_ads_attribution;
CREATE TRIGGER trg_log_stage
  AFTER UPDATE ON public.leads_ads_attribution
  FOR EACH ROW
  EXECUTE FUNCTION public.log_stage_change();
