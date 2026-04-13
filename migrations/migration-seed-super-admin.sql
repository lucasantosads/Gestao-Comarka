-- ============================================
-- MIGRATION: Seed super-admin 'lucas'
-- ============================================
-- Garante que existe uma conta 'lucas' com role=admin, cargo=Admin,
-- senha padrão comarka2026. Se já existir, NÃO sobrescreve nada.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Garante as colunas que usamos (idempotente)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS senha_visivel TEXT,
  ADD COLUMN IF NOT EXISTS cargo TEXT;

INSERT INTO employees (nome, usuario, senha_hash, senha_visivel, role, cargo, ativo, created_at)
VALUES (
  'Lucas',
  'lucas',
  encode(digest('comarka2026', 'sha256'), 'hex'),
  'comarka2026',
  'admin',
  'Admin',
  true,
  now()
)
ON CONFLICT (usuario) DO NOTHING;
