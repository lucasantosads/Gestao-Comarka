-- ============================================
-- MIGRATION: Portal do Colaborador
-- ============================================
-- Cria a tabela `team_members_profile` (perfil estendido do colaborador,
-- usado pelo Portal em /dashboard/team/[id]) e adiciona `orcamento_inicial`
-- na mirror de clientes para análise de upsell.
--
-- A página /dashboard/team/[id] usa o `notion_id` do membro como chave de
-- URL (vem de Notion). Por isso a profile table tem `notion_id text PK`.
-- Quando o colaborador também está em `employees`, o link opcional via
-- `employee_id` permite policies mais ricas no futuro.
-- ============================================

CREATE TABLE IF NOT EXISTS team_members_profile (
  notion_id     text PRIMARY KEY,                       -- chave usada pela página /dashboard/team/[id]
  employee_id   uuid REFERENCES employees(id) ON DELETE SET NULL,
  foto_url      text,
  data_entrada  date,
  chave_pix     text,
  contrato_url  text,                                   -- arquivo no bucket "contratos-colaboradores"
  cargo         text,
  salario_base  numeric,
  handbook_url  text,                                   -- link para handbook (Notion / Drive / Storage)
  bio           text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_members_profile_employee
  ON team_members_profile(employee_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_team_members_profile_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_team_members_profile_updated_at ON team_members_profile;
CREATE TRIGGER trg_team_members_profile_updated_at
  BEFORE UPDATE ON team_members_profile
  FOR EACH ROW EXECUTE FUNCTION set_team_members_profile_updated_at();

ALTER TABLE team_members_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON team_members_profile;
CREATE POLICY "service_role_all" ON team_members_profile FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Storage buckets (privados)
-- ============================================
-- Rodar manualmente no Supabase Storage UI ou via SQL admin:
--
-- INSERT INTO storage.buckets (id, name, public) VALUES ('contratos-colaboradores', 'contratos-colaboradores', false)
--   ON CONFLICT (id) DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('fotos-colaboradores', 'fotos-colaboradores', false)
--   ON CONFLICT (id) DO NOTHING;
--
-- Policies: a UI faz upload via API server-side (service role), portanto
-- não precisa de policies públicas. Acesso pelo cliente acontece via
-- signed URLs gerados pelo backend.

-- ============================================
-- Análise de upsell por cliente
-- ============================================
-- A "tabela de clientes" canônica neste projeto é `clientes_notion_mirror`
-- (ver /api/dashboard/clientes). Adicionamos `orcamento_inicial` lá para
-- comparar contra `orcamento` (atual). É preenchido uma única vez no
-- onboarding e não deve ser editável depois.
ALTER TABLE clientes_notion_mirror
  ADD COLUMN IF NOT EXISTS orcamento_inicial numeric;

-- Para clientes que já existem, considera o orçamento atual como o inicial
-- (snapshot do momento da migration). Sem esse backfill, "Upsell" mostraria
-- 100% para todos os clientes legados.
UPDATE clientes_notion_mirror
   SET orcamento_inicial = orcamento
 WHERE orcamento_inicial IS NULL
   AND orcamento IS NOT NULL;
