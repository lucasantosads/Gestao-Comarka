-- ============================================
-- MIGRATION: Senha visível (admin-only) em employees
-- ============================================
-- Como o login usa SHA-256 (one-way), o admin não conseguia recuperar
-- a senha de um colaborador. Esta coluna guarda o texto plano para
-- o admin poder visualizar/compartilhar quando o colaborador esquece.
-- O hash continua sendo o usado no login.
-- ============================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS senha_visivel TEXT;
