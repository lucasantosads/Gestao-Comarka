-- ============================================
-- MIGRATION: Comarka Pro — vínculo gestor em clientes e reunioes_cliente
-- ============================================
-- Desbloqueia as regras 3b (aumento de orçamento) e 3c (reuniões da semana)
-- do job automático /api/comarka-pro/calcular-automatico.
-- ============================================

DO $$ BEGIN
  ALTER TABLE clientes ADD COLUMN IF NOT EXISTS gestor_id UUID REFERENCES employees(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_clientes_gestor ON clientes(gestor_id);

DO $$ BEGIN
  ALTER TABLE reunioes_cliente ADD COLUMN IF NOT EXISTS gestor_id UUID REFERENCES employees(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_reunioes_cliente_gestor ON reunioes_cliente(gestor_id);
