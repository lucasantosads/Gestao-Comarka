-- ============================================
-- MIGRATION: Fluxo único Entrada → Clientes
-- ============================================
-- Objetivo: a aba /dashboard/clientes passa a ser dirigida 100% por
-- clientes_receita (formulário "Entrada" do financeiro). O mirror do
-- Notion (clientes_notion_mirror) deixa de ser fonte; vira apenas
-- armazenamento local dos campos editáveis (status, situacao, etc).
--
-- Como funciona:
--  - Toda nova linha em clientes_receita cria/linka uma row em
--    clientes_notion_mirror com status='Não iniciado'.
--  - Quando uma entrada volta ao status_financeiro='ativo' vinda de
--    qualquer outro estado, a row da mirror é resetada para
--    status='Não iniciado' (churn revertido / contrato reativado).
--  - Mirror rows existentes são linkadas por nome normalizado.
--  - Quando o sync do Notion for desligado, NADA quebra: a mirror
--    continua sendo populada por este trigger.
-- ============================================

-- 1. Coluna de vínculo: entrada_id (FK para clientes_receita.id)
ALTER TABLE clientes_notion_mirror
  ADD COLUMN IF NOT EXISTS entrada_id UUID REFERENCES clientes_receita(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_mirror_entrada ON clientes_notion_mirror(entrada_id);

-- 2. Função de normalização de nome (espelha o normalize() do JS em /api/dashboard/clientes)
CREATE OR REPLACE FUNCTION normalize_cliente_nome(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s TEXT;
BEGIN
  IF input IS NULL THEN RETURN ''; END IF;
  s := lower(input);
  -- remover acentos
  s := translate(s,
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn');
  -- remover sufixos/prefixos comuns
  s := regexp_replace(s, '\b(ltda|me|eireli|dr|dra|advocacia|advogado|advogados|clinica|consultorio|empresa|negocios)\b', ' ', 'g');
  -- remover não-alfanuméricos
  s := regexp_replace(s, '[^a-z0-9\s]', ' ', 'g');
  -- colapsar espaços
  s := regexp_replace(s, '\s+', ' ', 'g');
  RETURN trim(s);
END;
$$;

-- 3. Função do trigger: garante mirror row para cada entrada
CREATE OR REPLACE FUNCTION entrada_to_clientes_mirror()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_mirror_id TEXT;
  v_norm_name TEXT;
BEGIN
  v_norm_name := normalize_cliente_nome(NEW.nome);

  IF TG_OP = 'INSERT' THEN
    -- Tenta linkar a mirror row existente por nome normalizado
    SELECT notion_id INTO v_mirror_id
    FROM clientes_notion_mirror
    WHERE entrada_id IS NULL
      AND normalize_cliente_nome(cliente) = v_norm_name
    LIMIT 1;

    IF v_mirror_id IS NOT NULL THEN
      UPDATE clientes_notion_mirror
      SET entrada_id = NEW.id,
          editado_em = now()
      WHERE notion_id = v_mirror_id;
    ELSE
      -- Cria nova mirror row com notion_id local
      INSERT INTO clientes_notion_mirror
        (notion_id, cliente, status, entrada_id, editado_em, ultimo_sync_em)
      VALUES
        ('local_' || gen_random_uuid()::text, NEW.nome, 'Não iniciado', NEW.id, now(), now());
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Reativação: status_financeiro voltou a 'ativo' vindo de qualquer outro estado
    IF NEW.status_financeiro = 'ativo'
       AND COALESCE(OLD.status_financeiro, '') <> 'ativo' THEN
      UPDATE clientes_notion_mirror
      SET status = 'Não iniciado',
          editado_em = now()
      WHERE entrada_id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Triggers
DROP TRIGGER IF EXISTS trg_entrada_to_clientes_mirror_ins ON clientes_receita;
CREATE TRIGGER trg_entrada_to_clientes_mirror_ins
AFTER INSERT ON clientes_receita
FOR EACH ROW
EXECUTE FUNCTION entrada_to_clientes_mirror();

DROP TRIGGER IF EXISTS trg_entrada_to_clientes_mirror_upd ON clientes_receita;
CREATE TRIGGER trg_entrada_to_clientes_mirror_upd
AFTER UPDATE OF status_financeiro ON clientes_receita
FOR EACH ROW
EXECUTE FUNCTION entrada_to_clientes_mirror();

-- 5. Backfill: linka mirror existente às entradas por nome normalizado
WITH matches AS (
  SELECT
    m.notion_id,
    e.id AS entrada_id,
    ROW_NUMBER() OVER (PARTITION BY e.id ORDER BY m.editado_em DESC) AS rn
  FROM clientes_notion_mirror m
  JOIN clientes_receita e
    ON normalize_cliente_nome(m.cliente) = normalize_cliente_nome(e.nome)
  WHERE m.entrada_id IS NULL
)
UPDATE clientes_notion_mirror m
SET entrada_id = matches.entrada_id,
    editado_em = now()
FROM matches
WHERE m.notion_id = matches.notion_id
  AND matches.rn = 1;

-- 6. Backfill: cria mirror rows para entradas órfãs (sem match no Notion)
INSERT INTO clientes_notion_mirror
  (notion_id, cliente, status, entrada_id, editado_em, ultimo_sync_em)
SELECT
  'local_' || gen_random_uuid()::text,
  e.nome,
  'Não iniciado',
  e.id,
  now(),
  now()
FROM clientes_receita e
WHERE NOT EXISTS (
  SELECT 1 FROM clientes_notion_mirror m WHERE m.entrada_id = e.id
);
