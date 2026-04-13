-- ============================================
-- DASHBOARD COMERCIAL - Schema SQL Completo
-- Executar no SQL Editor do Supabase
-- ============================================

-- Tabela de closers
create table if not exists closers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean default true,
  created_at timestamptz default now()
);

-- Lançamentos diários
create table if not exists lancamentos_diarios (
  id uuid primary key default gen_random_uuid(),
  closer_id uuid references closers(id) on delete cascade,
  data date not null,
  reunioes_marcadas int default 0,
  reunioes_feitas int default 0,
  no_show int generated always as (reunioes_marcadas - reunioes_feitas) stored,
  ganhos int default 0,
  mrr_dia numeric(10,2) default 0,
  ltv numeric(10,2) default 0,
  comissao_dia numeric(10,2) generated always as (mrr_dia * 0.10) stored,
  obs text,
  mes_referencia text generated always as (to_char(data, 'YYYY-MM')) stored,
  created_at timestamptz default now(),
  unique(closer_id, data)
);

-- Configuração mensal (leads, investimento, custo por reunião, meses de contrato)
create table if not exists config_mensal (
  id uuid primary key default gen_random_uuid(),
  mes_referencia text not null unique, -- formato: "2025-03"
  leads_totais int default 0,
  investimento numeric(10,2) default 0,
  custo_por_reuniao numeric(10,2) default 0,
  meses_contrato int default 12,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Inserir closers iniciais
insert into closers (nome, ativo) values
  ('Mariana', true),
  ('Rogerio', true),
  ('Lucas', true),
  ('Closer 04', false),
  ('Closer 05', false),
  ('Closer 06', false),
  ('Closer 07', false),
  ('Closer 08', false),
  ('Closer 09', false);

-- Inserir config do mês atual
insert into config_mensal (mes_referencia, leads_totais, investimento, custo_por_reuniao, meses_contrato)
values (to_char(now(), 'YYYY-MM'), 0, 0, 50, 12);

-- RLS Policies (permitir acesso público para simplificar - sem auth por enquanto)
alter table closers enable row level security;
alter table lancamentos_diarios enable row level security;
alter table config_mensal enable row level security;

create policy "Allow all on closers" on closers for all using (true) with check (true);
create policy "Allow all on lancamentos_diarios" on lancamentos_diarios for all using (true) with check (true);
create policy "Allow all on config_mensal" on config_mensal for all using (true) with check (true);
