-- Migration: adiciona flag entrada_e_primeiro_mes em contratos
--
-- Quando true (padrão): a entrada cobrada É o primeiro mês do contrato.
--   valor_total_projeto = valor_entrada + mrr × (meses_contrato - 1)
--
-- Quando false: a entrada é um valor separado, somado a todos os meses.
--   valor_total_projeto = valor_entrada + mrr × meses_contrato
--
-- DEFAULT true preserva compatibilidade com contratos existentes.

ALTER TABLE contratos
ADD COLUMN IF NOT EXISTS entrada_e_primeiro_mes BOOLEAN NOT NULL DEFAULT true;
