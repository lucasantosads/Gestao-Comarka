-- Migration: adiciona valor_esperado em pagamentos_mensais
--
-- Permite ao cadastrar um novo cliente especificar valores DIFERENTES para
-- cada mês (ex: 1° mês R$ 500, 2° mês R$ 600, 3° em diante R$ 700).
--
-- Quando valor_esperado existir, o dashboard de recebimentos exibe esse valor
-- como referência no lugar de clientes_receita.valor_mensal. Quando null,
-- cai no valor_mensal padrão do cliente.

ALTER TABLE pagamentos_mensais
  ADD COLUMN IF NOT EXISTS valor_esperado NUMERIC;
