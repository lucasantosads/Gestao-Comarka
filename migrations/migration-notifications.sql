CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN (
    'lead_atribuido', 'contrato_fechado', 'meta_atingida',
    'mensagem_admin', 'pagamento_aprovado', 'lembrete', 'sistema'
  )),
  titulo text NOT NULL,
  mensagem text,
  lida boolean DEFAULT false,
  link text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_notifications_employee ON notifications(employee_id, lida, created_at DESC);

-- Trigger: notificar closer quando lead é atribuído
CREATE OR REPLACE FUNCTION notify_lead_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.closer_id IS NOT NULL AND (OLD IS NULL OR OLD.closer_id IS DISTINCT FROM NEW.closer_id) THEN
    INSERT INTO notifications (employee_id, tipo, titulo, mensagem, metadata)
    SELECT e.id, 'lead_atribuido',
           'Novo lead atribuido',
           'O lead ' || COALESCE(NEW.nome, 'sem nome') || ' foi atribuido a voce.',
           jsonb_build_object('lead_id', NEW.id)
    FROM employees e
    WHERE e.entity_id = NEW.closer_id AND e.role = 'closer';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_lead_assignment ON leads_crm;
CREATE TRIGGER trg_notify_lead_assignment
  AFTER INSERT OR UPDATE ON leads_crm
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_assignment();

-- Trigger: notificar closer quando contrato é fechado
CREATE OR REPLACE FUNCTION notify_contract_closed()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (employee_id, tipo, titulo, mensagem, metadata)
  SELECT e.id, 'contrato_fechado',
         'Contrato fechado!',
         'Contrato com ' || COALESCE(NEW.cliente_nome, '') || ' registrado. MRR: R$ ' || COALESCE(NEW.mrr::text, '0'),
         jsonb_build_object('contrato_id', NEW.id)
  FROM employees e
  WHERE e.entity_id = NEW.closer_id AND e.role = 'closer';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_contract ON contratos;
CREATE TRIGGER trg_notify_contract
  AFTER INSERT ON contratos
  FOR EACH ROW
  EXECUTE FUNCTION notify_contract_closed();
