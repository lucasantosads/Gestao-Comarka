-- Migration: remove UNIQUE constraint em leads_crm.ghl_contact_id
--
-- O GHL permite um contato ter múltiplas oportunidades em pipelines diferentes
-- (ex: lead passa do pipeline SDR para Closer — vira uma nova opportunity, mesmo
-- contact). A regra de negócio é 1 row por ghl_opportunity_id, NÃO por ghl_contact_id.
--
-- Com o UNIQUE atual, o sync rejeita ~200 leads porque o contato já existe em
-- outra row (pipeline diferente).

ALTER TABLE leads_crm DROP CONSTRAINT IF EXISTS leads_crm_ghl_contact_id_key;
