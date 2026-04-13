-- ============================================
-- MIGRATION: Checklist por cliente em onboarding
-- ============================================
-- Cada linha = estado de um item de template para um onboarding (notion_id).
-- Gerada automaticamente na primeira vez que o cliente abre o checklist,
-- copiando todos os items atuais do template.
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id TEXT NOT NULL,
  template_item_id UUID REFERENCES onboarding_template_items(id) ON DELETE SET NULL,
  secao TEXT NOT NULL,
  texto TEXT NOT NULL,
  ordem INT DEFAULT 0,
  checked BOOLEAN DEFAULT false,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (notion_id, template_item_id)
);

ALTER TABLE onboarding_checklist_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "onb_checklist_all" ON onboarding_checklist_items FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_onb_checklist_notion ON onboarding_checklist_items(notion_id);
CREATE INDEX IF NOT EXISTS idx_onb_checklist_secao ON onboarding_checklist_items(notion_id, secao);
