-- Adicionar coluna de etapa do pipeline de churn
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS etapa_churn text DEFAULT 'aviso_recebido'
  CHECK (etapa_churn IN ('aviso_recebido', 'juridico', 'no_prazo_aviso', 'procedimentos_finais', 'finalizado'));

-- Atualizar etapas baseado no status do Notion (já importado)
-- Os que vieram como "Finalizado" do Notion
UPDATE clientes SET etapa_churn = 'finalizado' WHERE motivo_cancelamento IS NOT NULL AND data_cancelamento < '2026-03-01';

-- Atualizar com base nos nomes que já sabemos do Notion
-- Safety, Mylena = aviso recebido (mais recentes)
-- Lucas Bol, Joao bol, Mylena etc = finalizado (mais antigos com status Finalizado)
