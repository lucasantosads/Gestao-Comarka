-- ============================================
-- MIGRATION: Backfill employees a partir de closers/sdrs
-- ============================================
-- Cria uma row em employees para cada closer/sdr que ainda não tem
-- conta de login. Senha padrão: comarka2026 (admin troca depois pelo
-- modal de edição em /equipe).
-- ============================================

-- Garante pgcrypto pra calcular SHA-256 igual ao login
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Garante que as colunas usadas abaixo existam (idempotente com
-- migration-employees-senha-visivel.sql e migration-employees-cargo.sql)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS senha_visivel TEXT,
  ADD COLUMN IF NOT EXISTS cargo TEXT;

-- Função utilitária: slug a partir do nome (lowercase, sem acentos, espaços→ponto)
CREATE OR REPLACE FUNCTION slugify_usuario(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s TEXT;
BEGIN
  s := lower(coalesce(input, ''));
  s := translate(s,
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn');
  s := regexp_replace(s, '[^a-z0-9\s]', '', 'g');
  s := regexp_replace(s, '\s+', '.', 'g');
  RETURN trim(both '.' from s);
END;
$$;

-- 1. Closers ativos sem employees
INSERT INTO employees (nome, usuario, senha_hash, senha_visivel, role, cargo, entity_id, ativo, created_at)
SELECT
  c.nome,
  -- Se já existe usuario na própria closers, usa ele; senão, slug do nome
  COALESCE(c.usuario, slugify_usuario(c.nome)),
  -- Hash SHA-256 da senha padrão (compatível com /api/auth/login)
  encode(digest('comarka2026', 'sha256'), 'hex'),
  'comarka2026',
  'closer',
  'Closer',
  c.id,
  COALESCE(c.ativo, true),
  now()
FROM closers c
WHERE NOT EXISTS (
  SELECT 1 FROM employees e WHERE e.entity_id = c.id AND e.role = 'closer'
)
ON CONFLICT (usuario) DO NOTHING;

-- 2. SDRs ativos sem employees
INSERT INTO employees (nome, usuario, senha_hash, senha_visivel, role, cargo, entity_id, ativo, created_at)
SELECT
  s.nome,
  slugify_usuario(s.nome),
  encode(digest('comarka2026', 'sha256'), 'hex'),
  'comarka2026',
  'sdr',
  'SDR',
  s.id,
  COALESCE(s.ativo, true),
  now()
FROM sdrs s
WHERE NOT EXISTS (
  SELECT 1 FROM employees e WHERE e.entity_id = s.id AND e.role = 'sdr'
)
ON CONFLICT (usuario) DO NOTHING;

-- 2.5 Todo mundo de team_notion_mirror (operacional + administrativo + qualquer cargo)
-- que ainda não tem conta em employees. Deriva role:
--   closer → closer
--   sdr → sdr
--   resto (Tráfego, Head, Pleno, Junior, Diretor, Desenvolvimento, Admin,
--          Financeiro, RH, etc) → admin
INSERT INTO employees (nome, usuario, senha_hash, senha_visivel, role, cargo, email, telefone, ativo, created_at)
SELECT
  t.nome,
  slugify_usuario(t.nome),
  encode(digest('comarka2026', 'sha256'), 'hex'),
  'comarka2026',
  CASE
    WHEN lower(coalesce(t.cargo, '')) = 'closer' THEN 'closer'
    WHEN lower(coalesce(t.cargo, '')) = 'sdr' THEN 'sdr'
    ELSE 'admin'
  END,
  COALESCE(t.cargo, 'Admin'),
  t.email,
  t.telefone,
  COALESCE(lower(t.status) = 'ativo', true),
  now()
FROM team_notion_mirror t
WHERE t.nome IS NOT NULL
  AND t.nome <> ''
  AND NOT EXISTS (
    -- Não recria se já tem employees com mesmo nome normalizado
    SELECT 1 FROM employees e
    WHERE slugify_usuario(e.nome) = slugify_usuario(t.nome)
  )
ON CONFLICT (usuario) DO NOTHING;

-- 3. Backfill cargo para registros antigos onde está null
UPDATE employees
SET cargo = CASE
  WHEN role = 'closer' THEN 'Closer'
  WHEN role = 'sdr' THEN 'SDR'
  WHEN role = 'admin' THEN 'Admin'
  ELSE role
END
WHERE cargo IS NULL;

-- 4. Quem foi backfillado e tem senha_visivel='comarka2026' aparece pro admin no modal pra trocar
-- (nada a fazer aqui — só comentário)
