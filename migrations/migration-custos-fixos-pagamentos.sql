-- ============================================
-- MIGRATION: Custos Fixos - Histórico de Pagamentos por Mês
-- ============================================

CREATE TABLE IF NOT EXISTS custos_fixos_pagamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  custo_fixo_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('folha', 'fixo', 'parcelamento')),
  mes_referencia TEXT NOT NULL, -- 'YYYY-MM'
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'vencido')),
  pago_em TIMESTAMPTZ,
  valor_pago NUMERIC(10,2),
  observacao TEXT,
  criado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(custo_fixo_id, tipo, mes_referencia)
);

ALTER TABLE custos_fixos_pagamentos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "cfp_all" ON custos_fixos_pagamentos FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_cfp_mes ON custos_fixos_pagamentos(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_cfp_custo ON custos_fixos_pagamentos(custo_fixo_id, tipo);
