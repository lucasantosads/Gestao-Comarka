-- ============================================
-- MIGRATION: Popular dados de custos fixos
-- Executar no SQL Editor do Supabase
-- ============================================

-- Criar tabelas auxiliares se não existirem
CREATE TABLE IF NOT EXISTS custos_fixos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao text NOT NULL,
  valor numeric(10,2) NOT NULL,
  dia_vencimento int,
  meio_pagamento text,
  categoria text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE custos_fixos ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow_all_custos_fixos_tab" ON custos_fixos FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS parcelamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao text NOT NULL,
  valor_parcela numeric(10,2) NOT NULL,
  dia_vencimento int,
  meio_pagamento text,
  parcela_atual int NOT NULL,
  parcelas_total int NOT NULL,
  categoria text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE parcelamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow_all_parcelamentos" ON parcelamentos FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TAREFA 1: Popular folha_pagamento
-- ============================================
TRUNCATE folha_pagamento;

INSERT INTO folha_pagamento (nome, cargo, valor_mensal, dia_vencimento, meio_pagamento) VALUES
('Lucas', 'Diretor', 20000.00, 20, '75992642038'),
('Mariana Leal', 'Closer', 2000.00, 5, '75991755748'),
('Rogerio Valentim', 'Closer', 2000.00, 5, 'rogerio889jr@gmail.com'),
('Davi Brandao', 'SDR', 2000.00, 5, '07756344502'),
('Clara Santos', 'Adm/Comercial', 2500.00, 5, '75991515549'),
('Flavio Goes', 'Head', 4000.00, 5, '75981085152'),
('Yago', 'G. Pleno', 2000.00, 5, '60.344.434/0001-30'),
('Emerson Klebler', 'G. Pleno', 2500.00, 5, 'emersonkss@hotmail.com'),
('Bruno', 'G. Pleno', 2500.00, 5, '54.350.019/0001-97'),
('Fernando Martins', 'G. Pleno', 2500.00, 5, '75991042109'),
('Heber', 'G. Junior', 2000.00, 5, '95410554515'),
('Dudu', 'G. Junior', 2000.00, 5, '83980008568'),
('Maicon', 'SM', 1000.00, 5, '08918641567'),
('Gabriel', 'Edicao', 2500.00, 5, '06432936551'),
('Deivid', 'DESENVOLV', 2000.00, 5, '08121653304');

-- Verificar: SELECT SUM(valor_mensal) FROM folha_pagamento;
-- Esperado: 51500.00

-- ============================================
-- TAREFA 2: Popular custos_fixos
-- ============================================
TRUNCATE custos_fixos;

INSERT INTO custos_fixos (descricao, valor, dia_vencimento, meio_pagamento, categoria) VALUES
('Aluguel 1407', 2500.00, 20, '75992993555', 'Aluguel'),
('Aluguel 1406', 2800.00, 5, '35289361000184', 'Aluguel'),
('Aluguel 1405', 3000.00, 5, NULL, 'Aluguel'),
('Internet', 100.00, 15, 'Pedir a Lucas', 'Internet'),
('Faxina', 170.00, 23, '09445341716', 'Limpeza'),
('Comunidade Lendaria', 98.00, 8, 'BB', 'Ferramentas/Softwares'),
('Escala AI', 150.00, 3, 'Nu PJ', 'Ferramentas/Softwares'),
('ZapSign', 89.90, 5, 'Nu LU', 'Ferramentas/Softwares'),
('TLDV', 330.00, 5, 'BB', 'Ferramentas/Softwares'),
('ChatGPT', 260.00, 5, 'Nu LU', 'Ferramentas/Softwares'),
('WorkSpace', 315.00, 5, NULL, 'Ferramentas/Softwares'),
('Google Drive', 49.90, 5, 'Nu LU', 'Ferramentas/Softwares'),
('Contador', 500.00, 20, '62602367000132', 'Contador'),
('Lovable', 140.00, 8, 'BB', 'Ferramentas/Softwares'),
('Adveronix', 230.00, 8, 'BB', 'Ferramentas/Softwares');

-- Verificar: SELECT SUM(valor) FROM custos_fixos;
-- Esperado: 10732.80

-- ============================================
-- TAREFA 3: Popular parcelamentos
-- ============================================
TRUNCATE parcelamentos;

INSERT INTO parcelamentos (descricao, valor_parcela, dia_vencimento, meio_pagamento, parcela_atual, parcelas_total, categoria) VALUES
('Iluminacao', 174.60, 1, 'American', 7, 10, 'Equipamento'),
('Planejado', 1550.00, 1, 'American', 7, 10, 'Obra'),
('Webcam', 166.58, 1, 'American', 4, 10, 'Equipamento'),
('Notebook', 224.99, 1, 'American', 4, 12, 'Equipamento'),
('Canva', 24.24, 5, 'Nu PJ', 10, 12, 'Ferramentas/Softwares'),
('Compra %', 5000.00, 5, '75981302343', 8, 12, 'Investimentos'),
('VPS', 47.00, 8, 'BB', 7, 12, 'Ferramentas/Softwares'),
('Curso Luana Carolina', 72.15, 8, 'BB', 3, 12, 'Cursos e Treinamentos'),
('Vinilico', 798.00, 15, '97277924568', 7, 10, 'Obra'),
('iPad', 275.00, 15, '97277924568', 9, 12, 'Equipamento'),
('Costume', 1000.00, 20, 'Mercado Pago', 5, 5, 'Outros'),
('Hotel Radisson', 434.29, 20, 'Mercado Pago', 5, 6, 'Eventos/Viagens'),
('Passagem', 698.42, 20, 'Mercado Pago', 4, 4, 'Eventos/Viagens'),
('Notebook 2', 240.58, 20, 'Mercado Pago', 4, 12, 'Equipamento'),
('Monitor', 276.40, 20, 'Mercado Pago', 7, 14, 'Equipamento'),
('Webcam e Cases', 130.00, 20, 'Mercado Pago', 2, 3, 'Equipamento'),
('Materiais', 302.60, 20, 'Mercado Pago', 2, 3, 'Obra'),
('Equipamento', 130.00, 20, 'Mercado Pago', 2, 3, 'Equipamento'),
('Notebook 3', 224.99, 20, 'Mercado Pago', 4, 12, 'Equipamento');

-- Verificar: SELECT SUM(valor_parcela) FROM parcelamentos;
-- Esperado: 11769.84

-- ============================================
-- TAREFA 4: Espelhar em custos_fixos_recorrentes (tabela usada pela UI)
-- ============================================
DELETE FROM custos_fixos_recorrentes;

-- Folha
INSERT INTO custos_fixos_recorrentes (nome, tipo, cargo, valor, dia_vencimento, ativo)
SELECT nome, 'folha', cargo, valor_mensal, dia_vencimento, true
FROM folha_pagamento WHERE ativo = true;

-- Fixos
INSERT INTO custos_fixos_recorrentes (nome, tipo, valor, dia_vencimento, ativo)
SELECT descricao, 'fixo', valor, dia_vencimento, true
FROM custos_fixos WHERE ativo = true;

-- Parcelamentos
INSERT INTO custos_fixos_recorrentes (nome, tipo, valor, dia_vencimento, ativo, parcelas_total, parcelas_pagas)
SELECT descricao, 'parcelamento', valor_parcela, dia_vencimento, true, parcelas_total, parcela_atual
FROM parcelamentos WHERE ativo = true;

-- ============================================
-- VERIFICACAO FINAL
-- ============================================
-- SELECT 'Folha' as bloco, SUM(valor_mensal) as total FROM folha_pagamento
-- UNION ALL
-- SELECT 'Custos Fixos', SUM(valor) FROM custos_fixos
-- UNION ALL
-- SELECT 'Parcelamentos', SUM(valor_parcela) FROM parcelamentos;
--
-- Folha          | 51500.00
-- Custos Fixos   | 10732.80
-- Parcelamentos  | 11769.84
-- Total          | 74002.64
