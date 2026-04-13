-- Migration: atualiza CHECK constraint de leads_crm.etapa para incluir os
-- novos estágios dos pipelines SDR e Closer do GHL (descobertos via auditoria
-- em 2026-04-08): qualificado, desqualificado, no_show, remarketing,
-- reuniao_feita, ligacao.
--
-- Sem esta migration, o sync GHL rejeita silenciosamente qualquer lead cuja
-- etapa seja mapeada para um dos novos valores, e os dashboards ficam com
-- dados stale.

ALTER TABLE leads_crm DROP CONSTRAINT IF EXISTS leads_crm_etapa_check;

ALTER TABLE leads_crm ADD CONSTRAINT leads_crm_etapa_check CHECK (
  etapa IN (
    'oportunidade',
    'lead_qualificado',
    'qualificado',
    'reuniao_agendada',
    'reuniao_feita',
    'proposta_enviada',
    'negociacao',
    'follow_up',
    'ligacao',
    'no_show',
    'remarketing',
    'desqualificado',
    'assinatura_contrato',
    'comprou',
    'desistiu'
  )
);
