-- ============================================
-- TRIGGER: Auto-incrementar leads_totais
-- Executar no SQL Editor do Supabase
-- ============================================

-- Primeiro, verificar em qual schema a tabela está
DO $$
BEGIN
  RAISE NOTICE 'Verificando tabelas...';
END $$;

-- Tentar criar a function e o trigger no schema public
CREATE OR REPLACE FUNCTION public.increment_leads_totais()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.config_mensal (mes_referencia, leads_totais, investimento)
  VALUES (NEW.mes_referencia, 1, 0)
  ON CONFLICT (mes_referencia)
  DO UPDATE SET leads_totais = public.config_mensal.leads_totais + 1,
                updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_leads ON public.leads_crm;
CREATE TRIGGER trg_increment_leads
  AFTER INSERT ON public.leads_crm
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_leads_totais();
