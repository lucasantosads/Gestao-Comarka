-- ============================================
-- MIGRATION: Adicionar nicho_id, tese_id e atribuicao_manual em leads_crm
-- ============================================

ALTER TABLE leads_crm
  ADD COLUMN IF NOT EXISTS nicho_id UUID REFERENCES nichos(id),
  ADD COLUMN IF NOT EXISTS tese_id UUID REFERENCES teses(id),
  ADD COLUMN IF NOT EXISTS atribuicao_manual BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_crm_nicho ON leads_crm(nicho_id);
CREATE INDEX IF NOT EXISTS idx_leads_crm_tese ON leads_crm(tese_id);
