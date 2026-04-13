-- Fidelidade: meses de contrato a partir de uma data de início
ALTER TABLE clientes_receita ADD COLUMN IF NOT EXISTS fidelidade_meses integer;
ALTER TABLE clientes_receita ADD COLUMN IF NOT EXISTS fidelidade_inicio date;
ALTER TABLE clientes_receita ADD COLUMN IF NOT EXISTS fidelidade_fim date;
