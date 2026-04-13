-- Tabela unificada de colaboradores para autenticação e controle de acesso
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text UNIQUE,
  usuario text NOT NULL UNIQUE,
  senha_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'closer', 'sdr')),
  entity_id uuid, -- referencia closers.id ou sdrs.id dependendo do role
  ativo boolean DEFAULT true,
  foto_url text,
  telefone text,
  data_admissao date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON employees FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_employees_usuario ON employees(usuario);
CREATE INDEX IF NOT EXISTS idx_employees_entity ON employees(entity_id, role);

-- Migrar closers existentes que tem usuario/senha_hash
INSERT INTO employees (nome, usuario, senha_hash, role, entity_id)
SELECT nome, usuario, senha_hash, 'closer', id
FROM closers
WHERE usuario IS NOT NULL AND senha_hash IS NOT NULL AND ativo = true
ON CONFLICT (usuario) DO NOTHING;
