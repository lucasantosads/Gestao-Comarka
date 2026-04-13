-- ============================================================
-- FINANCEIRO — Custos Operacionais + Custos Fixos Recorrentes
-- ============================================================

-- 1. Custos operacionais mensais
CREATE TABLE IF NOT EXISTS custos_operacionais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_referencia date NOT NULL,
  categoria text NOT NULL CHECK (categoria IN (
    'Aluguel', 'Energia', 'Internet', 'Telefone', 'Limpeza',
    'Contador', 'Ferramentas', 'Ads Próprio', 'Equipamento',
    'Audiovisual', 'Comissões', 'Folha Operacional',
    'Folha Comercial', 'Folha MKT', 'Prolabore',
    'Impostos', 'Mentoria', 'Terceirizado', 'Outros'
  )),
  valor numeric NOT NULL,
  descricao text,
  recorrente boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE custos_operacionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_custos_op" ON custos_operacionais FOR ALL USING (true) WITH CHECK (true);

-- 2. Custos fixos recorrentes (base mensal)
CREATE TABLE IF NOT EXISTS custos_fixos_recorrentes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('folha', 'fixo', 'parcelamento')),
  cargo text,
  valor numeric NOT NULL,
  dia_vencimento integer,
  ativo boolean DEFAULT true,
  parcelas_total integer,
  parcelas_pagas integer,
  data_inicio date,
  data_fim date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE custos_fixos_recorrentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_custos_fixos" ON custos_fixos_recorrentes FOR ALL USING (true) WITH CHECK (true);
