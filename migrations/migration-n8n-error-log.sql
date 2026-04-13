CREATE TABLE IF NOT EXISTS n8n_error_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text DEFAULT 'n8n_error',
  workflow_name text NOT NULL,
  workflow_id text,
  error_message text NOT NULL,
  node_name text,
  execution_id text,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
