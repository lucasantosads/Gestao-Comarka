-- ============================================
-- MIGRATION: Tarefas Kanban com cronômetro
-- Executar no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS tarefas_kanban (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  responsavel text NOT NULL,
  solicitante text,
  cliente text,
  setor text,
  urgencia text DEFAULT 'Média' CHECK (urgencia IN ('Baixa', 'Média', 'Alta', 'Crítica')),
  status text DEFAULT 'a_fazer' CHECK (status IN ('a_fazer', 'fazendo', 'concluido')),
  data_vencimento date,
  -- Cronômetro
  total_segundos int DEFAULT 0,
  em_andamento boolean DEFAULT false,
  ultimo_inicio timestamptz,
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tarefas_kanban ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "allow_all_tarefas_kanban" ON tarefas_kanban FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_tarefas_kanban_responsavel ON tarefas_kanban(responsavel);
CREATE INDEX IF NOT EXISTS idx_tarefas_kanban_status ON tarefas_kanban(status);
