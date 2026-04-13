-- ============================================
-- MIGRATION: Link custos_fixos_recorrentes (folha) ↔ employees
-- ============================================
-- Adiciona employee_id em custos_fixos_recorrentes para ligar
-- diretamente entradas de folha ao colaborador em /equipe.
-- Permite sincronização bidirecional: criar colaborador em /equipe
-- cria entrada na folha, e criar entrada folha via backfill cria
-- conta em employees.
-- ============================================

ALTER TABLE custos_fixos_recorrentes
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_custos_fixos_employee ON custos_fixos_recorrentes(employee_id);

-- Backfill: linka entradas de folha existentes a employees por nome normalizado
UPDATE custos_fixos_recorrentes cf
SET employee_id = e.id
FROM employees e
WHERE cf.employee_id IS NULL
  AND cf.tipo = 'folha'
  AND lower(trim(cf.nome)) = lower(trim(e.nome));
