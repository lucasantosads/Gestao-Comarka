-- Adicionar justificativa para pagamentos perdoados e mes_pagamento para rastrear quando foi pago
ALTER TABLE pagamentos_mensais ADD COLUMN IF NOT EXISTS justificativa text;
ALTER TABLE pagamentos_mensais ADD COLUMN IF NOT EXISTS mes_pagamento varchar(7);
