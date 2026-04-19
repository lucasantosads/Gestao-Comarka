# FAQ — Dashboard Comercial Comarka Ads

Guia completo do sistema. Atualizado a cada mudança no projeto.

---

## 0. ÚLTIMAS MUDANÇAS

### 2026-04-19 — Módulo de produtividade replicado no comarka-operacional

Banco compartilhado (mesmo Supabase `ogfnojbbvumujzfklkhh`) — nenhuma migration necessária.

**Tarefa 1 — Timer com time_sessions:**
- Timer start (`/api/tarefas/[id]/timer/start`): cria registro em `time_sessions`
- Timer stop (`/api/tarefas/[id]/timer/stop`): fecha sessão com `pausado_em` e `duracao_segundos`
- Concluir (`/api/tarefas/[id]/concluir`): fecha sessão se timer ativo antes de concluir

**Tarefa 2 — Meu Tempo:**
- Página: `/portal/meu-tempo` — timer em tempo real, barra de meta, chart 7 dias, donut 30 dias, tarefas recentes
- API: `/api/meu-tempo?colaborador_id=...` — adapta queries para tabela `tarefas` (campo `timer_ativo`/`timer_iniciado_em` ao invés de `em_andamento`/`ultimo_inicio`)
- Link "Meu Tempo" adicionado no header do `/meu-portal`

**Tarefa 3 — Painel de produtividade gerencial:**
- Página: `/produtividade` — Geral + Individual com tabs, polling 30s
- API: `/api/produtividade` (substituiu a versão básica) — status em tempo real, KPIs, ranking, alertas inatividade, visão individual com comparativo semanal + gráfico 30 dias
- Configurações: `/config` + `/api/produtividade/config` — meta horas, threshold inatividade, metas individuais, CRUD tipos de tarefa

**Sidebar:**
- Item "Produtividade" (admin-only) adicionado
- Link "Configurações" adicionado no footer (admin-only)

**Arquivos do comarka-operacional modificados/criados:**
- `src/app/api/tarefas/[id]/timer/start/route.ts` — + time_sessions insert
- `src/app/api/tarefas/[id]/timer/stop/route.ts` — + time_sessions close
- `src/app/api/tarefas/[id]/concluir/route.ts` — + time_sessions close
- `src/app/api/meu-tempo/route.ts` — novo
- `src/app/portal/meu-tempo/page.tsx` — novo
- `src/app/api/produtividade/route.ts` — reescrito
- `src/app/api/produtividade/config/route.ts` — novo
- `src/app/produtividade/page.tsx` — novo
- `src/app/config/page.tsx` — novo
- `src/app/meu-portal/page.tsx` — link Meu Tempo
- `src/components/sidebar.tsx` — Produtividade + Configurações

### 2026-04-18 — Unificação de fontes Equipe + Desempenho do Closer + Kanban melhorado

**Equipe Geral — Migração de Notion para Supabase**:
- Página `/equipe-geral` agora usa `/api/employees` (Supabase) como fonte única
- Anteriormente usava Notion com 11 pessoas hardcoded em `notion.ts`
- Ambas as páginas (Equipe Geral e Gestão) agora compartilham a mesma fonte `employees`
- Adicionar/desativar colaborador em qualquer uma reflete na outra
- Cards linkam para `/equipe/{id}` (detalhe do colaborador no Supabase)
- Classificação por cargo/setor/nível mantida com mesma lógica visual

**Gestão de Pessoal — Limpeza de métricas de vendas**:
- Removido: card "Vendas (Pipeline)" (contagem de closers)
- Removido: card "SDRs" (contagem de SDRs)
- Removido: link "Ver Folhas / DRE / Financeiro"
- Adicionado: card "Inativos" e "Departamentos" (contagem de cargos únicos)
- Modais de criação/edição mantidos intactos

**Portal do Closer — Seção Desempenho expandida**:
- Nova seção "Desempenho" com seletor de mês/ano no topo
- Grupo "Reuniões": Marcadas, Feitas, No-Show, Taxa No-Show (cores: verde <10%, laranja 10-20%, vermelho >20%)
- Grupo "Financeiro": Entrada (`contratos.valor_entrada`), MRR Fechado (`contratos.mrr`), LTV Fechado (`contratos.valor_total_projeto`), Ticket Médio (LTV/contratos), Ganhos (`lancamentos_diarios.ganhos`), Comissão (`lancamentos_diarios.comissao_dia`)
- Todos os dados filtrados por `closer_id` do usuário logado e `mes_referencia` selecionado
- LTV sempre de `contratos.valor_total_projeto` (nunca de `lancamentos_diarios.ltv`)

**Kanban de Tarefas — Badge de atrasada + Modal centralizado**:
- Tarefas com `data_vencimento` passada e `status != concluido` exibem badge vermelho "Atrasada"
- Borda do card fica vermelha
- Click no card abre modal centralizado (80vw × 85vh) com:
  - Coluna esquerda (60%): título e descrição editáveis inline com autosave (debounce 1s)
  - Coluna direita (40%): status, responsável, solicitante, cliente (busca), data vencimento, data criação
- Drag & drop do kanban não é afetado pelo click

### 2026-04-18 — Novo Lead via GHL ou Avulso no CRM

**Migration:** `migrations/migration-leads-avulso.sql` — adiciona `lead_avulso` (boolean, default false) e `fonte_avulso` (text) em `leads_crm`. `ghl_contact_id` já existia.

**API:** `src/app/api/ghl/contacts/route.ts`
- `GET ?query=...` — busca contatos no GHL via API `GET /contacts/?locationId=DlN4Ua95aZZCaR8qA5Nh&query=...`. Retorna id, name, phone, email. Mínimo 2 caracteres, limit 15.

**Tipo:** `src/types/database.ts` — `LeadCrm` agora inclui `lead_avulso?: boolean` e `fonte_avulso?: string | null`.

**Hook:** `src/hooks/use-crm-data.ts` — `addNovoLead` aceita parâmetro `extra` opcional com `nome`, `telefone`, `email`, `ghl_contact_id`, `lead_avulso`, `fonte_avulso`.

**Componente:** `src/components/novo-lead-dialog.tsx` — Dialog shadcn/ui com 2 tabs:
- **Vincular GHL:** campo de busca com debounce 500ms, lista de resultados com nome/telefone/badge GHL. Ao selecionar, cria lead com `ghl_contact_id` preenchido e `lead_avulso = false`.
- **Lead avulso:** campos nome (obrigatório), telefone, email, fonte (obrigatório — select com Indicação/Orgânico/Evento/Parceria/Outro). Cria lead com `lead_avulso = true`, `fonte_avulso` preenchida, sem webhook GHL.

**CRM Page:** `src/app/crm/page.tsx` — botão "+ Novo Lead" agora abre o `NovoLeadDialog` em vez de criar lead vazio direto.

**CRM Table:** `src/app/crm/components/crm-table.tsx` — leads com `lead_avulso = true` mostram badge "Avulso" (amarelo) ao lado do nome, com tooltip mostrando a fonte ao passar o mouse.

> **✅ Executado** — colunas `lead_avulso` e `fonte_avulso` criadas em `leads_crm`.

### 2026-04-18 — Módulo Produtividade (/time/produtividade)

Nova página com navegação "Geral" | "Individual" e seção de configuração.

**Visão Geral:**
- Cards de status em tempo real por colaborador (verde=ativo, cinza=inativo, badge alerta inatividade)
- KPIs filtráveis (hoje/semana/mês): horas do time, média/colab, tarefas concluídas
- Donut chart de distribuição por tipo de tarefa (Recharts)
- Ranking de produtividade: horas, tarefas, % meta (cap visual 100%, tooltip valor real)
- Alertas de inatividade (seg-sex) baseados em `alerta_inatividade_horas` de cada employee

**Visão Individual:**
- Select de colaborador → reutiliza estrutura do "Meu Tempo"
- Comparativo semana atual vs anterior com variação %
- Gráfico de linha 30 dias (Recharts) com referência meta diária
- Donut por tipo + tarefas recentes com timer em tempo real

**Configurações (/config → seção Produtividade):**
- Meta horas padrão + "Aplicar a todos"
- Threshold inatividade padrão + "Aplicar a todos"
- Lista de metas individuais editáveis inline
- CRUD completo de tipos de tarefa (nome, cor, soft delete)

**Arquivos criados:**
- `src/app/time/produtividade/page.tsx` — página principal
- `src/app/api/produtividade/route.ts` — API geral + individual (polling 30s)
- `src/app/api/produtividade/config/route.ts` — API config CRUD
- `src/components/produtividade/ProdutividadeConfig.tsx` — componente config

**Arquivos modificados:**
- `src/components/sidebar.tsx` — item "Produtividade" no menu Comarka Pro
- `src/app/config/page.tsx` — seção Produtividade adicionada

### 2026-04-18 — Seção "Meu Tempo" no portal do colaborador

**API:** `src/app/api/meu-tempo/route.ts`
- `GET ?colaborador_id=...` — retorna dados de tempo do colaborador logado: sessões hoje (soma `time_sessions.duracao_segundos` do dia), timer ativo (se `em_andamento = true` em alguma `tarefas_kanban`), meta diária (`meta_horas_semanais / 5`), horas por dia nos últimos 7 dias, distribuição por `tipo_tarefa` nos últimos 30 dias (join com `tarefas_kanban`), 5 tarefas recentes com tempo.

**Página:** `src/app/portal/meu-tempo/page.tsx`
- **Bloco Hoje:** horas trabalhadas em tempo real, cronômetro acumulando se timer ativo (Play verde pulsante + nome da tarefa), barra de progresso da meta diária com % (cap visual em 100%, valor real no tooltip).
- **Últimos 7 dias:** gráfico de barras Recharts com horas por dia + linha de referência na meta diária.
- **Por tipo de tarefa (30 dias):** donut chart Recharts com cores do catálogo `tipo_tarefa_opcoes` + tabela tipo/horas/%.
- **Tarefas recentes:** lista das 5 últimas com título, badge tipo (cor dinâmica), tempo total formatado, status.
- Polling a cada 30s para atualizar dados. Timer com `setInterval` de 1s para cronômetro em tempo real.

**Portal Shell:** `src/components/portal-shell.tsx` — tab "Tempo" (ícone Timer) adicionada tanto em `CLOSER_TABS` quanto em `SDR_TABS`, entre "Tarefas" e "Salario".

### 2026-04-18 — Timer por tarefa com time_sessions + tipo de tarefa no Kanban

**Timer por tarefa (Tarefas 1 e 2):**
- Ao mover para "Fazendo": inicia timer (`em_andamento=true`, `ultimo_inicio=now`) e cria registro em `time_sessions` com `colaborador_id` = responsável da tarefa.
- Botão de pausa: calcula `duracao_segundos`, fecha sessão em `time_sessions`, acumula em `total_segundos`.
- Retomar: cria nova `time_session`, reinicia timer.
- Ao mover para "Concluído": pausa automaticamente se rodando, trava timer (`cronometro_encerrado=true`).
- No cartão: timer rodando mostra HH:MM:SS em verde; parado mostra "Xh Ym" em cinza; zero não mostra nada.
- `setInterval` no frontend atualiza a cada segundo — sem polling ao banco.

**Tipo de tarefa (Tarefa 3):**
- Campo `tipo_tarefa` em `tarefas_kanban`, opções dinâmicas de `tipo_tarefa_opcoes` (nome + cor).
- Select no formulário de criação e no modal de detalhe.
- Badge colorido no cartão do kanban (cor vem de `tipo_tarefa_opcoes.cor`).
- Nova API: `GET /api/tarefas-kanban/tipo-tarefa-opcoes` — lista opções ativas.

**Arquivos modificados:**
- `src/app/api/tarefas-kanban/route.ts` — lógica de `time_sessions` nos handlers de status e toggle_timer + `tipo_tarefa` no POST
- `src/app/api/tarefas-kanban/tipo-tarefa-opcoes/route.ts` — novo endpoint GET
- `src/components/tarefas/tarefas-kanban.tsx` — timer refinado, badge tipo, campo tipo no form/modal

### 2026-04-18 — Kanban: badge de atrasada + modal centralizado de detalhe

**Componente**: `src/components/tarefas/tarefas-kanban.tsx`

**Badge de tarefa atrasada**:
- Tarefas com `data_vencimento` passada e `status != concluido` exibem badge vermelho "Atrasada" no canto superior direito do card
- Borda do card fica vermelha (`border-red-500/50`)
- Cálculo feito no frontend no render (sem campo adicional no banco)
- Função `isAtrasada(t)`: compara `data_vencimento + T23:59:59` vs `Date.now()`

**Modal centralizado de detalhe (`TarefaDetalheModal`)**:
- Abre ao clicar em qualquer card do kanban
- Modal centralizado 80vw × 85vh (não Sheet lateral)
- Layout em duas colunas:
  - Esquerda (60%): título editável inline, descrição editável (textarea)
  - Direita (40%): status (select), responsável (select), solicitante (read-only), cliente (busca com `ClienteSearchDropdown`), data de vencimento, data de criação
- Autosave com debounce de 1s nos campos título e descrição
- Campos de select salvam imediatamente ao alterar
- Fecha ao clicar fora, no X, ou ao salvar
- Drag & drop do kanban não é afetado

**Portal do Closer (`/portal/painel`)**:
- Seção "Histórico do Mês" agora inicia minimizada por padrão
- Header clicável com chevron para expandir/colapsar

**Meu Portal (`/meu-portal`)**:
- Seção "Portfólio de Clientes Vivos" removida da página (dados intactos no banco)

### 2026-04-18 — Schema do módulo de tempo/produtividade

**Migration:** `migrations/migration-tempo-produtividade.sql`

Alterações em tabelas existentes:
- **`tarefas`** — novas colunas: `tempo_total_segundos` (int, default 0), `timer_iniciado_em`, `timer_pausado_em` (timestamptz), `timer_rodando` (bool), `tipo_tarefa` (text). A coluna `tipo` já existente (CHECK constraint com valores fixos) foi mantida intacta — `tipo_tarefa` é um campo flexível separado que referencia `tipo_tarefa_opcoes`.
- **`tarefas_kanban`** — nova coluna: `tipo_tarefa` (text). Timer já existia (`total_segundos`, `em_andamento`, `ultimo_inicio`).
- **`employees`** — novas colunas: `meta_horas_semanais` (int, default 40), `alerta_inatividade_horas` (int, default 2).

Novas tabelas:
- **`time_sessions`** — sessões de tempo individuais. Campos: `colaborador_id` (FK→employees), `tarefa_id` (FK→tarefas_kanban ON DELETE CASCADE), `iniciado_em`, `pausado_em`, `duracao_segundos`, `data_referencia` (date). Indexes em colaborador, tarefa e data.
- **`tipo_tarefa_opcoes`** — catálogo de tipos de tarefa. Campos: `nome` (unique), `cor` (hex), `deleted_at`. Seed automático com 5 tipos: Atendimento (#3b82f6), Criativo (#ec4899), Operacional (#f59e0b), Reunião (#10b981), Estratégia (#8b5cf6).

> **Pendente:** rodar `migrations/migration-tempo-produtividade.sql` no Supabase.

### 2026-04-18 — Página Performance por Nicho & Tese

**Migration:** `migrations/migration-performance-manual.sql` — tabela `performance_manual` (nicho_id, tese_id, cliente_id, mes_referencia, contratos_fechados, faturamento_total) com UNIQUE composto e RLS.

**API:** `src/app/api/performance-nichos/route.ts`
- `GET ?mes=...&since=...&until=...` — dados agregados de performance por nicho e tese. Investimento da Meta API direta (por campanha), filtrado pelos vínculos confirmados em `campanhas_nichos`. Leads de `leads_crm`. Reuniões de `lancamentos_diarios`. LTV de `contratos`. Dados manuais de `performance_manual`.
- `PATCH` — upsert de dados manuais em `performance_manual`.

**Página:** `src/app/performance-nichos/page.tsx` — 4 tabs:
1. **Global** — KPIs (investimento, leads, CPL, reuniões, conversão, ROAS), gráfico barras por nicho, ranking teses por conversão.
2. **Por Nicho** — select nicho, KPIs filtrados, tabela teses com dados manuais editáveis.
3. **Por Tese** — select tese, KPIs filtrados, ROAS via faturamento/investimento, dados manuais editáveis.
4. **Comparar Teses** — multi-select 2–5 teses, tabela comparativa com highlight verde (melhor) e vermelho (pior).

**Alerta não atribuídos:** banner em todas as visões com lista expansível para atribuição manual inline.

**Sidebar:** item "Nichos & Teses" no grupo Dashboard.

> **Pendente:** rodar `migrations/migration-performance-manual.sql` no Supabase.

### 2026-04-18 — Auto-criação de Entrada + Onboarding ao marcar "Comprou" no CRM

Quando um lead é movido para a etapa "Comprou" no CRM, agora **toda a cadeia é criada automaticamente**:

1. **Contrato** — já existia
2. **Entrada** (`clientes_receita`) — insere com dados do lead (nome, mensalidade, closer, fidelidade). O trigger SQL `trg_entrada_to_clientes_mirror_ins` cria automaticamente o registro em `clientes_notion_mirror` com status "Não iniciado", fazendo o cliente aparecer em `/dashboard/clientes`.
3. **Onboarding** — cria registro em `onboarding_notion_mirror` (com `notion_id` prefixado `local_`) + `onboarding_tracking` na etapa "Passagem de bastão". Cliente aparece no kanban de `/dashboard/onboarding`.

**Arquivos modificados:**
- `src/hooks/use-crm-data.ts` — lógica de auto-criação dentro de `mudarEtapa`
- `src/app/api/notion/onboarding/route.ts` — GET agora mescla itens do Notion com itens locais (`local_*`) do `onboarding_notion_mirror`

**Também atualizado em:** `comarka-operacional` (mesmos 2 arquivos)

### 2026-04-18 — Alertas da página Clientes colapsados por padrão

Os 3 alertas da página de Clientes (feedback vencido, situação piorando, divergência entrada/churn) agora iniciam minimizados por padrão. Cada alerta mostra apenas o header (ícone + título + contagem) e pode ser expandido individualmente com um clique. Estado controlado localmente via `alertasExpandidos` (não persiste no banco).

### 2026-04-18 — Match automático de campanhas Meta + atribuição nicho/tese nos leads

**Migration:** `migrations/migration-leads-nicho-tese.sql` — adiciona `nicho_id` (FK→nichos), `tese_id` (FK→teses) e `atribuicao_manual` (boolean) na tabela `leads_crm`.

**API — Match de campanhas:** `src/app/api/campanhas/match-nichos/route.ts`
- `GET` — busca campanhas ativas/pausadas da conta `act_2851365261838044` via Meta Marketing API v21.0, verifica vínculos existentes em `campanhas_nichos`, e tenta match automático pelo nome (normaliza lowercase sem acentos, procura nome de nicho E tese dentro do nome da campanha). Retorna listas separadas: `matched` (auto-detectados), `unmatched` (preencher manual), `confirmed` (já confirmados).
- `PATCH` — confirma ou corrige vínculo (`confirmado = true`).

**API — Atribuição de leads:** `src/app/api/leads/atribuir-nicho/route.ts`
- `GET` — atribui automaticamente nicho/tese a leads que têm `ad_id` preenchido. Cadeia: `lead.ad_id` → `ads_metadata.campaign_id` → `campanhas_nichos.nicho_id/tese_id` (somente vínculos confirmados). Não sobrescreve atribuições manuais.
- `PATCH` — atribuição manual de um lead específico (seta `atribuicao_manual = true`).

**UI — Vínculos de Campanhas:** `src/components/campanhas-vinculos.tsx`
- Adicionado na página de Configurações (`src/app/config/page.tsx`).
- Botão "Sincronizar Meta" busca campanhas e faz match.
- Resumo em cards: auto-detectados (amarelo), preencher (vermelho), confirmados (verde).
- Para auto-detectados: mostra sugestão com botão "Confirmar" e "Corrigir".
- Para preencher: selects de nicho + tese com botão "Salvar".

**UI — Coluna Nicho/Tese no CRM:** `src/app/crm/components/crm-table.tsx`
- Nova coluna "_nicho" (Nicho/Tese) na tabela de leads.
- Leads com nicho atribuído: mostra "Nicho → Tese" em violet.
- Leads sem nicho: badge "Não atribuído" (vermelho) clicável, abre popover inline com selects de nicho e tese, salva via `atribuicao_manual = true`.

> **Pendente:** rodar `migrations/migration-leads-nicho-tese.sql` no Supabase.

### 2026-04-18 — Catálogo global de Nichos & Teses

**Migration:** `migrations/migration-nichos-teses.sql` — 4 tabelas novas:
- `nichos` (id, nome unique, deleted_at, created_at)
- `teses` (id, nicho_id FK→nichos, nome, deleted_at, created_at, unique nicho_id+nome)
- `clientes_nichos_teses` (id, cliente_id text, nicho_id FK, tese_id FK, deleted_at, unique cliente_id+nicho_id+tese_id)
- `campanhas_nichos` (id, campaign_id unique, campaign_name, cliente_id, nicho_id FK, tese_id FK, vinculo_automatico, confirmado, deleted_at)

Todas com RLS aberto, soft delete via `deleted_at`, e indexes nos FKs.

**API:** `src/app/api/nichos-teses/route.ts`
- `GET` — lista catálogo (nichos + teses) ou vínculos de um cliente (`?cliente_id=`)
- `POST` — action: `criar_nicho`, `criar_tese`, `vincular_cliente`
- `DELETE` — action: `nicho`, `tese`, `vinculo` (soft delete). Deletar nicho cascata soft-deleta teses e vínculos.

**UI — Página do cliente** (`src/app/dashboard/clientes/[id]/page.tsx`):
- Novo componente `NichoTesesSection` (`src/components/nicho-teses-section.tsx`) na aba "geral", antes das Teses operacionais.
- Select de nicho dinâmico + multi-select de teses filtradas por nicho.
- Botão inline para criar novo nicho e nova tese.
- Teses já vinculadas aparecem como badges com botão de remover.
- Mínimo 1 tese obrigatória ao salvar.

**UI — Configurações** (`src/app/config/page.tsx`):
- Novo componente `NichosTesesConfig` (`src/components/nichos-teses-config.tsx`).
- Lista todos os nichos cadastrados com expansão para ver teses.
- Input para adicionar nicho e tese em cada nicho.
- Botão de remover (soft delete) em nicho e tese.

> **Pendente:** rodar `migrations/migration-nichos-teses.sql` no Supabase.

### 2026-04-18 — Paginação cursor-based no CRM de Leads
- **`src/hooks/use-crm-data.ts`**: carga inicial agora traz apenas 50 leads (era 2000). Total de leads é obtido via `count: "exact"`. Cursor usa `ghl_created_at` + `id` como desempate para evitar duplicatas.
- Nova função `loadMore()` busca próximos 50 leads a partir do último cursor carregado. Deduplicação por `id` antes de concatenar ao estado.
- Mutações otimistas (`updateLead`, `mudarEtapa`, `addNovoLead`, `deleteLead`) agora operam sobre `setAllLeads` (estado local) em vez de `mutate` do SWR (que antes guardava os leads).
- Real-time via Supabase Realtime reseta cursor e recarrega do início ao detectar mudanças.
- Hook exporta novos campos: `loadMore`, `hasMore`, `totalCount`, `loadingMore`.
- **`src/app/crm/page.tsx`**: removida paginação fixa por quantidade (botões 15/30/50/100). Substituída por botão "Carregar mais 50 de X restantes" abaixo da tabela. Mostra "Mostrando N de Total leads". Botão some automaticamente quando todos os leads estão carregados. Filtros, ordenação e busca continuam funcionando nos leads já carregados.

### 2026-04-18 — Fallback Supabase mirror na página de detalhe do cliente
- **`src/app/api/notion/clientes/[id]/route.ts`**: quando o `notion_id` é `pending_*` ou `local_*` (IDs criados localmente no Supabase, sem correspondência no Notion), busca direto do `clientes_notion_mirror`. Para IDs normais, tenta Notion primeiro e faz fallback para o mirror se falhar. Resolve o bug "Cliente não encontrado" ao clicar no nome do cliente na lista.

### 2026-04-18 — Ajustes no Portal do Closer e Meu Portal

**Portal do Closer (`/portal/painel`)**:
- Seção "Histórico do Mês" agora inicia **minimizada** por padrão
- Header clicável com ícone chevron para expandir/colapsar
- Estado controlado por `useState` (não persiste entre recarregamentos)

**Meu Portal (`/meu-portal`)**:
- Seção "Portfólio de Clientes Vivos" (tabela de clientes ativos) **removida** da página
- KPIs de clientes (Meus Clientes Ativos, Orçamento Total, % Bons, Atenção Imediata) **removidos**
- Alertas de clientes em declínio e feedbacks vencidos **removidos**
- Dados de clientes permanecem intactos no banco — apenas o componente visual foi removido
- Kanban de tarefas continua exibido normalmente

### 2026-04-18 — Alertas da página Clientes colapsados por padrão

Os 3 alertas da página de Clientes (feedback vencido, situação piorando, divergência entrada/churn) agora iniciam minimizados por padrão. Cada alerta mostra apenas o header (ícone + título + contagem) e pode ser expandido individualmente com um clique. Estado controlado localmente via `alertasExpandidos` (não persiste no banco).

### 2026-04-09 — Módulo de Clientes Expandido (Entrada + Churn)

Correção e expansão do módulo de clientes com validação bidirecional entre Entrada e Churn, histórico de status, e verificação automática de consistência.

**Migration**: `migrations/migration-clientes-modulo-expandido.sql`
- `clientes` ganha 9 campos: `status_anterior`, `risco_churn` ('baixo'|'medio'|'alto'), `risco_churn_motivo`, `obs_contrato` + `obs_contrato_atualizada_em`/`_por`, `churn_validado` + `churn_validado_em`/`_por`.
- CHECK constraint expandido: `status IN ('ativo','cancelado','pausado','nao_iniciado')`.
- **Novas tabelas**: `clientes_status_historico` (timeline de mudanças de status com `alterado_por` e `motivo`), `churn_consistencia_log` (divergências Entrada vs Churn com `clientes_divergentes jsonb`).

**Triggers** (4 triggers em `clientes`):
- `trg_registrar_historico_status` — BEFORE UPDATE: registra em `clientes_status_historico`, seta `status_anterior = OLD.status`. Usa `current_setting('app.current_user_id')` para rastrear autor.
- `trg_validar_churn` — BEFORE UPDATE: se `NEW.status = 'cancelado'` e OLD não era `ativo`/`pausado`, RAISE EXCEPTION. Seta `churn_validado = true`.
- `trg_reverter_nao_iniciado` — BEFORE UPDATE: reativação de cancelado→ativo redireciona para `nao_iniciado`.
- `trg_sincronizar_churn` — BEFORE UPDATE: garante `data_cancelamento` preenchida ao cancelar.

**Validação de churn nas APIs**:
- `POST /api/financeiro/churnar-cliente` — verifica `status_financeiro` em `statusAtivos` antes de permitir churn. Retorna erro 400 se não ativo. Inclui warning se nenhum contrato encontrado.
- Frontend: status "Finalizado" desabilitado no select se cliente não é Ativo/Pausado (tanto na listagem quanto no detalhe), com toast de erro explicativo.

**Novas APIs** (`/api/clientes/*`):
- `PATCH obs-contrato` — atualiza `obs_contrato` + timestamp na tabela `clientes`.
- `GET status-historico?cliente_id=xxx` — retorna timeline de `clientes_status_historico`.
- `GET/PATCH consistencia-log` — lista últimos registros de consistência, marca como resolvido.

**Cron Job** (novo em `vercel.json`):
- `POST /api/clientes/verificar-consistencia` — diário 06h (seg-sex). Compara `clientes_receita` ativos vs `churn_log` vs `clientes` cancelados. Se divergência: insere em `churn_consistencia_log`, envia WhatsApp via Evolution API.

**Página `/dashboard/clientes` (Entrada)** expandida:
- Badge de risco churn na listagem (verde/amarelo/vermelho ou cinza "Sem análise")
- Alerta de divergência no topo da página com botão "Ver detalhes" (modal com IDs) e "Marcar resolvido"
- Validação visual: opção "Finalizado" desabilitada para clientes não-ativos
- No detalhe do cliente (`/dashboard/clientes/[id]`):
  - Card "Observações do Closer" com edição inline + timestamp de última atualização
  - Card "Histórico de Status" com timeline vertical (status anterior → novo, data, motivo)

**Página `/churn`** expandida:
- Badge de divergência no header com link para `/dashboard/clientes`
- Botão "Histórico" (ícone) em cada cliente churned → modal com timeline de status
- Indicador de consistência no rodapé (verde "Sincronizado" / vermelho "Divergência pendente" + data)

**Regras**:
- Churn NUNCA registrado para cliente não-ativo (trigger + API + UI)
- Reativação de cancelado → redireciona para `nao_iniciado` (trigger)
- Toda mudança de status registrada em `clientes_status_historico`
- Job de consistência não executa sáb/dom
- Soft delete em tudo

### 2026-04-09 — Módulo de Infraestrutura e Sistema

**Novas tabelas** (migration `migration-sistema-infraestrutura-v2.sql`):
- `sistema_integracao_status` — status de cada integração (ghl, meta_ads, n8n, asaas, evolution_api, supabase, tldv, fathom, notion, google_drive)
- `sistema_fila_erros` — fila de erros com reprocessamento automático (max 3 tentativas)
- `sistema_auditoria` — log de INSERT/UPDATE/DELETE em tabelas críticas (trigger automático)
- `sistema_config_historico` — histórico campo-a-campo de alterações de configuração
- `sistema_backups` — registro de backups diários com status e link do arquivo
- `sistema_rate_limit_log` — log de chamadas por hora/dia por serviço (Meta Ads, GHL, Asaas, Evolution)

**Triggers SQL** (migration `migration-sistema-auditoria-triggers.sql`):
- `registrar_auditoria()` — trigger em config_mensal, metas_mensais, metas_closers, metas_sdr, trafego_regras_otimizacao, comarka_pro_config, colaboradores_rh, asaas_pagamentos, clientes, contratos
- `registrar_config_historico()` — trigger em config_mensal, comarka_pro_config (ignora campos `_manual`)
- Backend deve setar `SET LOCAL app.current_user_id = '{uuid}'` antes de queries críticas

**Cache Meta Ads API** (`src/lib/meta-cache.ts`):
- Cache em memória (Map) com TTL configurável: 5min (spend), 30min (estrutura), 2h (metadata)
- Se Meta retorna 429 (rate limit): retorna último valor em cache com flag `rate_limited: true`
- `meta-fetch.ts` integrado automaticamente — todas as rotas que usam `metaFetchPaginated` ganham cache
- Registra cada chamada em `sistema_rate_limit_log`

**Novos Cron Jobs** (`vercel.json`, protegidos por `CRON_SECRET`):
- `POST /api/sistema/health-check` — a cada 5 minutos: pinga todas as integrações, atualiza status, alerta WhatsApp se offline
- `POST /api/sistema/backup` — diariamente às 03h: exporta 18 tabelas críticas como JSON, upload para storage
- `POST /api/sistema/rate-limits` — a cada hora: monitora chamadas Meta Ads, alerta se > 80% do limite
- `POST /api/sistema/reprocessar-fila` — diariamente às 07h (seg-sex): reprocessa erros pendentes

**Novos Webhooks**:
- `POST /api/webhooks/ghl` — recebe stage changes do GHL, upsert em leads_crm (valida WEBHOOK_SECRET)
- `POST /api/webhooks/transcricao` — recebe transcrições tl;dv/Fathom, salva em reunioes_clientes
- `POST /api/webhooks/asaas` — recebe eventos PAYMENT_RECEIVED/CONFIRMED/OVERDUE, upsert + conciliação

**Nova página** `/config/sistema`:
- Tab "Integrações": grid de cards com status, latência, botão "Testar agora" por integração
- Tab "Rate Limits": barra de progresso, gráfico Recharts de chamadas/hora nas últimas 24h
- Tab "Fila de Erros": tabela com filtros por origem/status, reprocessar individual ou em lote
- Tab "Backups": lista com status, tamanho, link, botão "Fazer backup agora"
- Tab "Auditoria": log de ações com diff expandível (valor anterior/novo), exportar CSV

**Componente global** `SistemaAlertas` no sidebar:
- Badge vermelho se: integração offline, erros pendentes com 2+ tentativas, backup atrasado/falhou, rate limit > 90%
- Dropdown com resumo dos alertas e link para /config/sistema

---

### 2026-04-09 — Módulo Financeiro Expandido

**Novas tabelas** (migration `migration-financeiro-modulo.sql`):
- `asaas_pagamentos` — cobranças do Asaas com dupla verificação (aprovação de criação + recebimento)
- `asaas_auditoria` — trilha de auditoria de todas as ações sobre pagamentos
- `financeiro_fluxo_caixa` — projeção de fluxo de caixa (3 cenários × 3 meses)
- `financeiro_margem_cliente` — margem por cliente (receita - custo mídia - custo gestor)
- `financeiro_exportacoes` — registro de exportações CSV/PDF para contador

**Novas APIs**:
- `GET/POST /api/asaas/pagamentos` — listar/criar cobranças (criação aguarda aprovação)
- `PATCH /api/asaas/pagamentos/[id]/aprovar-criacao` — aprovar/reprovar criação no Asaas (admin)
- `PATCH /api/asaas/pagamentos/[id]/aprovar-recebimento` — confirmar recebimento (admin)
- `GET /api/asaas/pagamentos/pendentes-aprovacao` — badge de notificação
- `POST /api/asaas/sync` — sync últimos 30 dias do Asaas (cron diário)
- `GET /api/financeiro/resumo` — endpoint unificado (KPIs, fluxo caixa, margens, comissões, Asaas)
- `POST /api/financeiro/exportar` — exportar CSV/PDF para contador (admin)

**Novos Cron Jobs** (`vercel.json`, protegidos por `CRON_SECRET`):
- `POST /api/financeiro/alertas-cobranca` — dia 1 às 10h: alerta clientes sem cobrança + WhatsApp
- `POST /api/financeiro/calcular-margem` — segunda às 09h: calcula margem por cliente (receita - custo mídia Meta API - custo gestor)
- `POST /api/financeiro/projecao-fluxo` — dia 1 às 08h: projeção 3 meses (otimista/realista/pessimista)
- `POST /api/asaas/sync` — dias úteis às 07h: sincroniza pagamentos Asaas

**Nova lib**:
- `src/lib/asaas-conciliacao.ts` — conciliação automática Asaas → cliente por descrição normalizada (3 tentativas → sem_match)

**Nova página** `/financeiro`:
- KPI cards: MRR, crescimento MoM, crescimento anual, lucro líquido, crescimento lucro
- Fluxo de caixa projetado: toggle otimista/realista/pessimista + gráfico barras + card impacto churn
- Margem por cliente: tabela ordenada por margem % (badges vermelho <30%, amarelo <50%)
- Comissões: cards por closer com OTE, barra progresso, projeção
- Cobranças Asaas: tabela com filtros, aprovação criação/recebimento, fila sem match, auditoria
- Exportar para contador: modal CSV/PDF por mês (admin)

**Regras de negócio**:
- Dupla verificação: nenhuma cobrança criada no Asaas sem aprovação admin
- Nenhum recebimento confirmado sem aprovação admin
- Toda aprovação registrada em asaas_auditoria com ip_sessao
- custo_midia SEMPRE via Meta API direta (nunca n8n sync)
- Conciliação automática por nome normalizado, sem_match após 3 tentativas
- Jobs não executam sábado/domingo
- Soft delete em todas as tabelas novas

**Variáveis de ambiente necessárias**:
- `ASAAS_API_KEY` — chave de acesso à API Asaas

### 2026-04-09 — Módulo de Tráfego Pago Expandido

**Novas tabelas** (migration `migration-trafego-modulo-expandido.sql`):
- `trafego_regras_otimizacao` — regras configuráveis (CPL, CTR, frequência, etc.) com ações automáticas
- `trafego_regras_historico` — log de disparos, aplicações, ignorados e falsos positivos
- `trafego_criativos` — biblioteca de criativos (vídeo/imagem/roteiro) com análise IA, score, ciclo de vida
- `trafego_criativo_metricas` — métricas mensais por criativo (CPL, CTR, fase ciclo vida)
- `trafego_anomalias` — detecção automática (gasto zerado, CPL dobrou, leads zerados, spend esgotando/sobrando)
- `trafego_performance_temporal` — heatmap CPL por dia_semana × hora

**Novas APIs**:
- `POST /api/ia/analisar-criativo` — Claude Haiku analisa criativo (copy jurídico, sugestões A/B/C, compliance OAB)
- `POST /api/ia/avaliar-alerta-trafego` — Gemini Flash avalia alerta contra regras + histórico
- `POST /api/meta/pausar` — pausa ad/adset/campaign via Meta API (somente admin, com confirmação WhatsApp)
- `GET/POST/PATCH /api/trafego/regras` — CRUD regras de otimização
- `GET/PATCH /api/trafego/anomalias` — lista e resolve anomalias
- `GET/POST /api/trafego/criativos` — CRUD criativos com auto-análise

**Novos Cron Jobs** (`vercel.json`, protegidos por `CRON_SECRET`):
- `POST /api/trafego/verificar-regras` — cada 2h (dias úteis): verifica regras + detecta anomalias + pausa automática se crítico
- `POST /api/trafego/ciclo-vida-criativos` — diário 06h: calcula fase (aquecimento/pico/estável/fadiga/encerrado)
- `POST /api/trafego/performance-temporal` — diário 05h: agrega leads por dia_semana × hora

**Páginas expandidas**:
- `/trafego/estrutura` — drill-down agora abre modal com tabs: Leads (vinculados via ad_id), Criativo (score, fase, análise IA), Anomalias
- `/trafego/alertas` — 3 tabs: Alertas (existente expandido com análise IA + pausar via API), Regras (CRUD admin), Anomalias (feed ativo)

**Novas páginas**:
- `/trafego/criativos` — biblioteca: KPI cards, filtros, grid de cards, modal com 4 tabs (Métricas com gráfico CPL, Copy/Roteiro, Análise IA com sugestões, Histórico timeline)
- `/trafego/performance-temporal` — heatmap CPL dia×hora, bar chart leads por dia, cards de insight automático

**Regras**:
- Pausar via Meta API somente admin, com confirmação
- Ação automática só se `acao_automatica = true` E severidade = 'critica'
- Jobs não executam sábados e domingos
- Ciclo de vida só para criativos com `ad_id` vinculado
- Análise de vídeo requer `transcricao_status != 'pendente'`
- Seed inicial: 5 regras padrão (CPL>150, CTR<1%, Freq>3.5, Zero leads, ROAS<3)

### 2026-04-09 — Módulo de Projeções Expandido

Expansão completa do módulo `/projecoes` com funil reverso avançado, simulador de cenários, break-even, LTV da carteira, acurácia de projeções, meta por closer com IA, e alertas automáticos.

**Migration**: `migrations/migration-projecoes-modulo.sql`
- `config_mensal` ganha 14 campos: taxas de funil (`funil_lead_para_qualificado`, `funil_qualificado_para_reuniao`, `funil_reuniao_para_proposta`, `funil_proposta_para_fechamento`) + `meta_mrr`, `meta_contratos`, `noshow_rate` — cada um com flag `_manual` (boolean) para proteger valores inseridos manualmente.
- **Novas tabelas**: `projecoes_cenarios` (cenários base/otimista/pessimista/simulação com todas as métricas projetadas), `projecoes_historico_acuracia` (comparativo projetado vs realizado por mês, unique em `mes_referencia`), `projecoes_alertas` (tipos: `meta_inalcancavel`, `gargalo_funil`, `ritmo_insuficiente`, com `acoes_sugeridas jsonb`).
- `metas_closers` ganha `meta_sugerida_ia` (numeric) e `meta_sugerida_justificativa` (text).

**REGRA CRÍTICA**: campos com flag `_manual = true` NUNCA são sobrescritos por jobs automáticos.

**APIs** (`/api/projecoes/*`):
- `GET taxas-historicas` — calcula taxas reais do funil (lead→qualificado→reunião→proposta→fechamento + noshow) com base em `leads_crm` e `lancamentos_diarios`. Aceita param `meses` (1|3|6|12). Retorna taxas históricas + taxas manuais + flag indicando qual está ativa.
- `POST funil-reverso` — cálculo reverso: meta → propostas → reuniões → qualificados → leads. Aceita `taxas_override` para modo simulação. Retorna gargalo identificado, ações sugeridas, impacto de redução de noshow (5%, 10%, 15%, 20%).
- `GET break-even` — MRR mínimo de equilíbrio = `(custos_fixos + folha + parcelamentos + comissões) / margem_media`. Retorna histórico 6 meses de break-even vs MRR real.
- `GET ltv-carteira` — LTV individual por cliente = `mrr × tempo_medio_permanencia × (1 - prob_churn)`. Breakdown por nicho, impacto se clientes de risco alto churnem.
- `GET/POST alertas` — lista alertas não visualizados, marca como visto.
- `GET acuracia` — retorna histórico de acurácia das projeções (até 12 meses), acurácia média dos últimos 6M e tendência do modelo (otimista/pessimista/neutro).
- `POST salvar-taxa-manual` — salva taxa manual em `config_mensal` com flag `_manual = true`. Campos válidos: `funil_lead_para_qualificado`, `funil_qualificado_para_reuniao`, `funil_reuniao_para_proposta`, `funil_proposta_para_fechamento`, `noshow_rate`. NUNCA sobrescreve `meta_mrr` ou `meta_contratos`.

**Cron Jobs** (novos em `vercel.json`):
- `POST verificar-alertas` — diário 08h (seg-sex). Verifica meta inalcançável (ritmo × dias restantes < meta) e gargalo do funil (perda >20% vs média 3M). Gera ações via Gemini Flash. Envia WhatsApp via Evolution API.
- `POST registrar-acuracia` — mensal dia 1 às 04h. Compara projeção base do mês anterior com realizados. Upsert em `projecoes_historico_acuracia`.
- `POST meta-closers` — mensal dia 1 às 05h. Para cada closer ativo, analisa desempenho 3M via Gemini Flash. Salva sugestão em `meta_sugerida_ia` + `meta_sugerida_justificativa`. NUNCA aplica automaticamente.

**Página `/projecoes`** expandida com:
- Banner de alertas de projeção no topo (vermelho/amarelo/laranja)
- Botão "Gerar análise completa" (Claude Sonnet) com diagnóstico narrativo + salvar no Notion
- Simulador de cenários: sliders de noshow/qualificação/fechamento/closers, cálculo via API, resultado lado a lado com cenário atual. Badge "Simulação — não salvo".
- Comparativo de meta: gráfico de barras (Recharts) Atual vs Necessário por métrica
- Break-even: 4 cards (MRR equilíbrio, contratos, distância, faltantes) + gráfico de linha 6 meses
- LTV da carteira: 4 cards + gráfico de pizza por nicho + tabela top 15 clientes + impacto churn alto
- Meta por closer: tabela com sugestão IA + justificativa + botão para gerar via Gemini Flash
- Acurácia das projeções: gráfico de linha (acurácia média + acurácia MRR mês a mês), tabela completa (MRR proj./real, contratos proj./real, acurácia %), card acurácia média 6M, badge modelo otimista/pessimista/neutro. Populada automaticamente pelo cron `registrar-acuracia` no dia 1 de cada mês.
- Seções existentes preservadas: metas financeiras, métricas do funil, funil reverso, resultado projetado, sugestões de ação, histórico, alertas, diagnóstico IA

### 2026-04-08 — Comarka Pro (pontuação, ranking e gamificação)

Novo módulo completo para gestores de tráfego. Spec original referenciava tabelas que **não existem** no repo (`colaboradores_rh`, `auth.users`, `kanban_cronometro_log`, `otimizacoes_cliente`, role "gestor de tráfego", `is_head_operacional`). **Decisão**: reusar `employees` + adicionar flags, criar `kanban_cronometro_log` do zero, usar `otimizacoes_historico` (nome real), respeitar o padrão de auth JWT cookie.

**Migrations** (rodar manualmente no Supabase, nesta ordem):
1. `migrations/migration-comarka-pro.sql`
   - `employees` ganha `cargo_nivel` ('jr'|'pleno'|'sr'), `is_head_operacional bool`, `is_gestor_trafego bool`.
   - **Novas tabelas**: `kanban_cronometro_log` (fonte do cron de cronômetro), `comarka_pro_config` (singleton com prêmios + multiplicador), `comarka_pro_temporadas`, `comarka_pro_pontos` (unique colaborador+mes), `comarka_pro_lancamentos` (enum 15 categorias, origem automatico/manual, soft delete via `deleted_at`), `comarka_pro_roteiros` (match com ads_metadata, `metricas_snapshot jsonb`, aprovação), `comarka_pro_feedbacks` (aprovação). Todas com RLS + policy `*_all` + índices.
2. `migrations/migration-comarka-pro-gestor-vinculo.sql`
   - `clientes.gestor_id uuid REFERENCES employees(id) ON DELETE SET NULL` + índice.
   - `reunioes_cliente.gestor_id uuid REFERENCES employees(id) ON DELETE SET NULL` + índice.
   - Desbloqueia as regras 3b e 3c do cron automático.

**Libs**:
- `src/lib/comarka-pro-config.ts` — `PONTOS_CATEGORIA` tipado (15 categorias com `pts`, `tipo` automatico/manual, `descricao`).
- `src/lib/comarka-pro.ts` — `recalcularPontosMes` (soma lançamentos ativos → aplica multiplicador baseado em `meses_sequencia` → upsert em `comarka_pro_pontos`), helpers de data (`primeiroDiaMes`, `mesRefISO`, `mesAnteriorISO`, `ultimosNMesesISO`, `inicioSemanaISO`, `ehFimDeSemana`, `diasUteisNoMes`), `jaExisteLancamento` (dedupe), `isAdminOrHead` (= `isSuperAdmin` OR `cargo='head'` OR `employees.is_head_operacional`), `validarCronSecret` via header `Authorization: Bearer`.

**APIs** (`/api/comarka-pro/*`, todas com `dynamic = "force-dynamic"`):
- `POST calcular-automatico` — Cron segunda 09h UTC. **Não roda fim de semana**. Para cada `employees` ativo com `is_gestor_trafego=true`:
  - **3a Cronômetro** — conta dias distintos em `kanban_cronometro_log WHERE colaborador_id = X AND data >= mes_inicio`; se `dias / dias_uteis_do_mes ≥ 0.95`, insere `+5`. Máximo 1 por colaborador/mês.
  - **3b Aumento de orçamento** — path: `clientes WHERE gestor_id = X` → `clientes_meta_historico` → `ads_metadata` (via `campaign_id`) → `ads_performance.spend`. Compara spend da semana atual (≥ `inicioSemanaISO`) vs. semana anterior (`[semanaAnt, semanaAtual)`). Se `spendAtual ≥ spendAnt * 1.1`, insere `+10` com descrição contendo o `notion_id` pra dedupe por cliente/semana.
  - **3c Reuniões da semana** — `reunioes_cliente WHERE gestor_id = X AND data_reuniao ≥ inicioSemanaISO`. Deduplica por `cliente_notion_id` dentro da semana via `ilike` na descrição. Insere `+5`.
  - **3d Organização** — `otimizacoes_historico` do mês todas com `status='confirmada' AND data_confirmacao IS NOT NULL` → insere `+10`. Máximo 1 por colaborador/mês.
  - Após qualquer insert, chama `recalcularPontosMes(colaborador, hoje)`.
- `POST encerrar-mes` — Cron dia 1 08h UTC. Para cada gestor: compara `pontos_finais` do mês encerrado vs. média dos 3 meses anteriores. Se bateu, incrementa `meses_sequencia`; senão zera. Faz upsert no mês novo e chama `recalcularPontosMes`. Insere notificação em `notifications` com `employee_id` (schema real).
- `GET ranking?periodo=mensal|trimestral|semestral|anual&mes=YYYY-MM&nivel=todos|jr|pleno|sr&publico=boolean` — soma `pontos_finais` dos últimos N meses (1/3/6/12), monta top categorias por agregação de lançamentos, calcula `variacao_posicao` vs. período anterior. Com `publico=true` pula auth (usado pela TV).
- `GET meus-pontos` — pontos do mês atual, histórico 12m, lançamentos ativos do mês, 4 posições (mensal/trimestral/semestral/anual) via recomputação inline, metas automáticas (% cronômetro com `cronometro_dias` / `cronometro_dias_uteis`).
- `GET lancamentos?mes&colaborador_id&categoria&origem` — admin/head vê todos, colaborador só os próprios.
- `POST lancamentos` — admin/head. Pontos padrão vêm de `PONTOS_CATEGORIA` com override opcional. `origem='manual'`, salva `aprovado_por`. Chama `recalcularPontosMes`.
- `DELETE lancamentos/[id]` — admin/head. Soft delete via `deleted_at`. Recalcula.
- `GET roteiros?pendentes=1&colaborador_id` — idem padrão de autorização. `pendentes=1` filtra `status='pendente'`.
- `POST roteiros` — colaborador. Match **case-insensitive** em `ads_metadata.ad_name` (ILIKE exato, sem wildcards). Se encontra, puxa `ads_performance` 30 dias e salva `metricas_snapshot` (`{cpl, leads, spend, impressoes, data_snapshot}`). Retorna `_aviso` humano se não encontrar.
- `PATCH roteiros/[id]/aprovar` — admin/head. Se `status='aprovado'`, insere lançamento `roteiro` (+10) com `referencia_id=roteiro.id` e recalcula.
- `GET feedbacks?pendentes=1&colaborador_id` — idem.
- `POST feedbacks` — colaborador. **Limite 1 por cliente por semana** — valida via count em `criado_em >= inicioSemana`. Retorna 409 se exceder.
- `PATCH feedbacks/[id]/aprovar` — admin/head. Se aprovado, insere lançamento `feedback_cliente` (+5) e recalcula.
- `GET/PUT config` — admin/head. Singleton de `comarka_pro_config` (prêmios mensal/trimestral/semestral/anual top 3, `multiplicador_sequencia`, `meses_sequencia_necessarios`).

**Cron** (`vercel.json`): 2 crons novos (`0 9 * * 1` e `0 8 1 * *`) com `CRON_SECRET` obrigatório via `Authorization: Bearer`.

**Middleware**: `/tv/*` totalmente público (antes só `/tv` exato).

**Sidebar**: grupo "Comarka Pro" com Meus Pontos / Ranking / Admin (ícones Target/Eye/BarChart3/Shield).

**Páginas**:
- `/time/comarka-pro` (colaborador) — 4 cards de topo (pontos do mês, ranking mensal, sequência + multiplicador, ranking trimestral), progresso do cronômetro (verde se ≥95%), gráfico Recharts 12m de `pontos_finais`, feed cronológico de lançamentos com badge verde/vermelho e origem, botões e modais "Cadastrar roteiro" (exibe status do match em tempo real) e "Registrar feedback".
- `/time/comarka-pro/ranking` — toggles Período (mensal/trimestral/semestral/anual) e Nível (todos/jr/pleno/sr), top 3 com medalhas + avatares + prêmios do config, tabela do restante com `pontos_finais`, `multiplicador_ativo` e `variacao_posicao` (↑/↓/=). Botão "Abrir modo TV ↗" linka para `/tv/ranking`.
- `/time/comarka-pro/admin` (só admin/head) — 5 tabs:
  - **Lançar**: form com select de colaborador/categoria, pontos (default da categoria), descrição, mês, cliente → POST lancamentos.
  - **Roteiros**: lista `roteiros?pendentes=1` com aprovar/reprovar.
  - **Feedbacks**: lista `feedbacks?pendentes=1` com aprovar/reprovar.
  - **Config**: 14 inputs numéricos (prêmios + multiplicador + meses necessários) → PUT config.
  - **Histórico**: lista `lancamentos?origem=manual&mes` do mês selecionado com botão remover (soft delete via DELETE).
- `/tv/ranking` (público, fullscreen) — fundo escuro gradient, top 5, avatar grande, barra de pontos proporcional ao 1º, badge de multiplicador e sequência, auto-refresh a cada 60s, rodapé "Atualizado às HH:MM", animação CSS `fadeIn` sequencial por card.

**Integração com `/equipe/[id]`**: aba nova "Comarka Pro" permite configurar `cargo_nivel` (select jr/pleno/sr), `is_gestor_trafego` e `is_head_operacional` (checkboxes), salva via PATCH `/api/employees/[id]` (whitelist atualizada). Se gestor, botão "Carregar pontos do mês" consulta ranking e mostra `pontos_finais` + `meses_sequencia`, com link pra `/time/comarka-pro/admin`.

**Regras de negócio ativas**:
- Lançamentos automáticos únicos por colaborador/mês (cronômetro, organização); 3b e 3c são únicos por cliente/semana.
- Feedbacks: máximo 1 por cliente por semana.
- Soft delete em todos os lançamentos, roteiros e feedbacks (via `deleted_at`).
- Jobs não executam aos sábados e domingos (via `ehFimDeSemana()`).
- Autorização: `session.usuario='lucas'` OR `session.cargo='head'` OR `employees.is_head_operacional=true`.
- `recalcularPontosMes` é chamado após qualquer insert/update/soft-delete em `comarka_pro_lancamentos` para manter `pontos_finais` consistente.
- Match de roteiro com anúncio: ILIKE case-insensitive com título exato — sem wildcards/parcial.

**Ativação em produção**:
1. Rodar `migration-comarka-pro.sql` e `migration-comarka-pro-gestor-vinculo.sql` no Supabase.
2. `UPDATE employees SET is_gestor_trafego=true WHERE id IN (...)` para marcar gestores.
3. `UPDATE employees SET is_head_operacional=true WHERE id=...` para head(s). Super-admin (`usuario='lucas'`) já é reconhecido automaticamente.
4. Popular `clientes.gestor_id` e `reunioes_cliente.gestor_id` (UPDATE ou via UI futura) — sem isso, regras 3b e 3c do cron ficam sem efeito, mas não quebram.
5. `vercel env add CRON_SECRET` e redeploy.
6. Configurar prêmios e multiplicador em `/time/comarka-pro/admin` → Config.
7. Logar com gestor e abrir `/time/comarka-pro`; abrir `/tv/ranking` em tela cheia sem login.

**Limitações conhecidas**:
- Regra 3b atravessa 4 tabelas por cliente por execução — ok pra dezenas de clientes por gestor; se escalar pra centenas, criar view materializada `ads_performance_por_cliente`.
- Rota `GET roteiros/feedbacks` usa campo `descricao` com `ilike` pra dedupe por cliente/semana na regra 3c — não é dedupe perfeito se descrições forem alteradas manualmente; aceitável pois descrições automáticas seguem template `"Reunião com cliente <notion_id>"`.

### 2026-04-08 — Performance de Clientes: auditoria rodada 3 (bugfixes)

Auditoria completa do módulo encontrou 6 bugs — todos corrigidos nesta rodada:

1. **`api/clientes/[id]/performance/route.ts`** — query de `otimizacoes_historico` referenciava colunas que **não existem** no schema real (`descricao`, `observacoes`). Schema real tem `comentarios`, `feito`, `proxima_vez`, `solicitado` (ver `migration-clientes-extra.sql`). Herdado de sessão anterior — silenciosamente quebrava a tab Timeline do T8. **Fix**: troca dos selects e mapeamento da timeline para `titulo = comentarios`, `detalhe = proxima_vez + solicitado`, `confirmado = data_confirmacao || (feito && feito !== "Não")`.

2. **Filtro de status frágil** em 3 crons (`calcular-score`, `analise-risco`, `alertas-campanha`) — usavam `.not("status", "in", '("Cancelado","Pausado","Não iniciado")')`, sintaxe arriscada em PostgREST quando o tuple contém espaço + acento. **Fix**: substituído por `.neq()` encadeado (3x por query) em todos os três.

3. **`vercel.json`** — cron de `alertas-campanha` estava `0 12 * * *` (todo dia). Spec exige "dias úteis apenas". **Fix**: `0 12 * * 1-5`. Os outros 2 crons já estavam corretos (`calcular-score` é Mon-only por schedule; `analise-risco` spec diz "diário", runtime check pula fds).

4. **`/api/team/employees` ausente** — `dashboard/clientes/performance/page.tsx` fazia fetch para popular o dropdown de gestor, mas o endpoint **não existia**. Try/catch silenciava o 404, resultado: filtro de gestor ficava vazio. **Fix**: criado `src/app/api/team/employees/route.ts` retornando `{ employees: [{id, nome, role}] }` só de ativos, ordenado por nome.

5. **Schema `otimizacoes_historico.descricao/observacoes`** — após o fix 1, verifiquei que outros routes (ex: `diagnostico/route.ts`) já não usam mais essas colunas — sessão anterior já tinha migrado. Só a T3 ainda carregava o padrão antigo. OK sem fix adicional.

6. **Schema `clientes_receita.status_financeiro` / `categoria`** — não há `ALTER TABLE` nas migrations adicionando essas colunas, mas são referenciadas por triggers (`migration-fluxo-entrada-clientes.sql`) e todo o resto do `/dashboard/clientes` existente depende delas. Conclusão: estão na prod por SQL manual. Não intervim.

**Cruzamentos de dados verificados ok**:
```
clientes_receita.id (entrada_id)
  └── clientes_notion_mirror.entrada_id
        ├── .notion_id ──► clientes_teses.notion_id
        ├── .notion_id ──► otimizacoes_historico.notion_id
        ├── .notion_id ──► reunioes_cliente.cliente_notion_id
        ├── .notion_id ──► alertas_cliente.cliente_notion_id
        ├── .notion_id ──► clientes_meta_historico.cliente_notion_id
        ├── .meta_campaign_id ──► leads_crm.campaign_id
        ├── .meta_campaign_id ──► Meta API /{campaign_id}/insights
        └── .analista (texto) ──► employees.nome → employees.telefone (Evolution)
```

Todas as métricas (CPL/ROAS/spend/taxa_qualif/%meta/alerta_sem_leads) cruzam esses caminhos corretamente. Confirmado via leitura de todas as migrations relevantes: `clientes-teses-v2`, `otimizacoes-snapshot`, `clientes-extra`, `clientes-portal`, `leads-ad-attribution`, `employees`, `fluxo-entrada-clientes`, `notion-mirror`, `clientes-receita`, `alertas-config`.

**Gaps intencionais deixados (menores, documentados)**:
- T5 não envia "variação de CPL 4 semanas" bruto pra IA — usa `score_saude` que já é função dessa variação. Se quiser o número bruto no prompt, exige +1 call Meta por cliente/dia.
- T6 usa tabela nova `alertas_cliente` em vez de `alertas_snooze` — este último tem schema incompatível (`ad_id NOT NULL`, voltado pra snooze).
- T8 timeline não inclui marcos "melhor/pior CPL, primeiro lead convertido" — só otimizações + reuniões. Implementável cruzando `historico_mensal` já calculado + `leads_crm` mais antigo.
- Gestor filter usa `session.nome` → `clientes_notion_mirror.analista` (texto). Colisão possível se dois employees tiverem nome idêntico. Melhoria futura: coluna `gestor_employee_id` uuid + índice.
- `calcular-score` faz 2 chamadas Meta por cliente (semanas atual + anterior). Pra 50 clientes = 100 calls; Meta rate limit é generoso mas monitorar.
- `/api/team/employees` retorna todos employees ativos (não só gestores de tráfego). Filtragem por cargo exige coluna `is_gestor`/`cargo` não existente hoje.

### 2026-04-08 — Módulo Performance de Clientes (jobs + alertas)

Módulo `/dashboard/clientes/performance` (páginas + APIs base já existiam de sessão anterior). Esta rodada completou: migration consolidada, jobs Vercel Cron, alertas de campanha sem leads e extensão do endpoint Meta.

**Migration** (`migrations/migration-clientes-performance.sql` — rodar manualmente no Supabase):
- `clientes_notion_mirror`: `+ meta_campaign_id`, `+ meta_adset_id`, `+ meta_leads_mes` (novo), `+ meta_leads_semana` (legado), `+ meta_roas_minimo`, `+ score_saude` (0–100), `+ score_calculado_em`, `+ risco_churn` ('baixo'|'medio'|'alto'), `+ risco_churn_motivo`, `+ risco_churn_acao`, `+ risco_calculado_em`. Decisão: usar `clientes_notion_mirror` porque é onde vivem nicho, status, analista (gestor), fb_url. `clientes_extra.saude_score` existente não foi reaproveitado pra não ter dois scores.
- **Nova** `clientes_meta_historico` (cliente_notion_id, meta_campaign_id, meta_adset_id, vigencia_inicio/fim) + trigger `fn_clientes_meta_historico_sync` (INSERT/UPDATE em `meta_campaign_id` fecha vínculo anterior e abre novo automaticamente) + backfill inicial.
- `otimizacoes_historico` + `reunioes_cliente`: `+ snapshot_metricas jsonb` (pra guardar CPL/ROAS do momento do evento).
- **Nova** `alertas_cliente` (cliente_notion_id, tipo, mensagem, criado_em, resolvido_em, notificado_whatsapp, metadata) com RLS + índices. **Não** reaproveitei `alertas_snooze` — o schema exigia `ad_id NOT NULL` e é outro conceito (snooze, não alerta ativo).

**Cron jobs novos** (`vercel.json`, todos protegidos por `CRON_SECRET` via header `Authorization: Bearer`):
- `POST /api/clientes/calcular-score` — segunda 11h UTC (08h BRT). Fórmula 0–100: 30pts variação CPL semana vs semana anterior (via Meta campaign-level), 25pts leads vs `meta_leads_mes` (fallback: média 3m se meta nula), 25pts taxa de qualificação (`etapa IN ('reuniao_agendada','follow_up','proposta_enviada','assinatura_contrato','comprou')`), 20pts regularidade de otimização (≤7d=20, ≤14d=10, 15+=0). Pula sábado/domingo. Soft failure por cliente.
- `POST /api/clientes/analise-risco` — diário 10h UTC (07h BRT). Chama `callAI({provider:"gemini"})` (Gemini 2.0 Flash) por cliente com contexto (score, dias desde otim/reunião, tendência de leads 3m, pct meta). Parser aceita JSON embutido em texto. Salva `risco_churn`, `risco_churn_motivo` (≤100), `risco_churn_acao` (≤150). Pula fim de semana.
- `POST /api/clientes/alertas-campanha` — diário 12h UTC (09h BRT). Pra cada cliente ativo com `meta_campaign_id`: busca spend 3 dias via Meta (campaign-level) + conta leads em `leads_crm.ghl_created_at` no mesmo período. Se `spend > 0 && leads == 0`, abre registro em `alertas_cliente` (não duplica enquanto não resolvido) e envia WhatsApp via Evolution para o telefone do `analista` em `employees` (match por nome minúsculo). Pula fim de semana.

**Lib nova** `src/lib/evolution.ts` — cliente mínimo para Evolution API. `sendWhatsAppText(phone, message)`. Normaliza telefone adicionando `55` se ausente. Envs: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` (já estavam em `/config/integracoes`).

**Extensão** `GET /api/meta-spend` agora aceita `?campaign_id=` opcional: muda endpoint para `/{campaign_id}/insights` e `level=campaign`. Defaults `since`/`until` = últimos 30 dias. Mantém retrocompat com o modo account-level.

**Sidebar** — entrada "Performance" em `src/components/sidebar.tsx:35` já existia (`/dashboard/clientes/performance`), nada a fazer.

**Regras seguidas**:
- Spend sempre via Meta API direta (nunca `ads_performance` do n8n sync) em todos os 3 jobs.
- CPL = spend / leads (ponderado).
- ROAS = LTV (valor_mensal × 12) / spend.
- Filtro de "cliente ativo" = `status NOT IN ('Cancelado','Pausado','Não iniciado')`.
- Jobs nunca rodam aos fins de semana.
- Soft delete preservado (nenhum DELETE físico).
- `mes_referencia` de `leads_crm` nunca sobrescrito.

**Refinamento rodada 2 (mesma data) — APIs e páginas reescritas para consumir a spec completa**:

- `GET /api/clientes/performance` agora aceita `?periodo=mes_atual|3m|6m|12m&nicho&tese_id&risco&gestor_id`. Calcula `spend_periodo`, `total_leads`, `cpl`, `roas`, `taxa_qualificacao`, `pct_meta_leads`, `dias_sem_otimizacao`, `alerta_sem_leads` **tudo no servidor**. Spend vem da Meta API campaign-level em batches de 8. Filtro de gestor: se `session.role !== 'admin'`, força filtro por `analista = session.nome` (não há tabela `gestores` — `analista` em `clientes_notion_mirror` é nome do employee). Retorna `filtrado_por_gestor` no payload.
- `GET /api/clientes/[id]/performance` aceita `?periodo&comparativo=periodo_anterior|mesmo_periodo_ano_anterior`. Retorna bloco completo: `metricas_periodo` + `metricas_comparativo`, `historico_mensal` (12m) + `historico_mensal_ano_anterior` via `time_increment=monthly` da Meta, `leads_individuais` (leads_crm do período com nome/etapa/telefone/data), `alerta_sem_leads` (spend 3d > 0 e 0 leads), benchmark do nicho com CPL/ROAS médio e comparativo anonimizado (Cliente A/B/C exceto o próprio), histórico de vínculos Meta, timeline unificada com `snapshot_metricas`.
- Página `/dashboard/clientes/performance`: 5 KPIs incluindo "Sem Meta", filtros Período/Nicho/Tese/Risco/Gestor (carrega lista de employees de `/api/team/employees`), colunas de Leads com barra de progresso `% meta`, badge de ROAS abaixo de `meta_roas_minimo`, ícone de alerta sem leads, seção "Benchmark por nicho" com cards (CPL médio, ROAS médio, melhor e pior performer), seção "Benchmark por tese" com tabela (CPL/ROAS médio, nº de clientes).
- Página `/dashboard/clientes/[id]/performance`: selects de período e comparativo, botão **Exportar PDF** via `window.print()` + CSS `@media print` (zero dep nova; classes `.no-print` escondem sidebar/botões). Tabs: **Visão Geral** (6 KPIs Spend/CPL/ROAS/Leads/Qualif/%Meta com deltas vs comparativo — seta verde/vermelha respeitando métricas inversas como CPL; gráfico Recharts linha dupla spend+leads 12m com linhas tracejadas do ano anterior quando aplicável; breakdown visual dos 4 componentes do score; teses). **Leads** (tabela de leads individuais filtrada por etapa). **Linha do Tempo** (timeline + card separado de histórico de vínculos Meta). **Benchmark** (comparativo anonimizado com score, CPL, ROAS). **IA — Diagnóstico** (Claude Haiku + Notion + exibição da `risco_churn_acao` salva pelo cron de risco).

Bibliotecas: só `recharts` (já no package.json) e `lucide-react` (já). Nenhuma dependência nova adicionada.

**Blindagem da camada de leitura (rodada posterior)**:
- APIs `/api/clientes/performance` e `/api/clientes/[id]/performance` reescritas com helpers `safeSelect()` / `safe()` que envolvem cada query. Se uma coluna/tabela nova da migration ainda não existir (migration não rodada ou coluna removida), a query específica loga `warn` e retorna `[]`/`null` em vez de derrubar a rota inteira. Payload inclui `migration_aplicada: boolean` pro frontend saber.
- Colunas da mirror da migration (`meta_campaign_id`, `score_saude`, `risco_churn`, `meta_leads_mes`, `meta_roas_minimo`, `risco_churn_acao`, etc) são buscadas em **query separada** da base da mirror — assim a base continua carregando mesmo se as colunas novas sumirem.
- `alertas_cliente`, `clientes_meta_historico`, `otimizacoes_historico.snapshot_metricas`, `reunioes_cliente.snapshot_metricas` isolados em queries próprias com `safe()`.
- **Correção de nomes de coluna inventados** em rodadas anteriores: `otimizacoes_historico` não tem `descricao`/`observacoes` — colunas reais são `comentarios`, `solicitado`, `proxima_vez`, `feito` (verificado em `src/app/api/clientes-extra/otimizacoes/route.ts`). `reunioes_cliente` não tem `resumo` — usar `notas`; `confirmado` deriva de `status !== 'agendada'` (verificado em `src/app/api/clientes/reunioes/route.ts`). Afetou `/api/clientes/[id]/performance/route.ts` e `/api/clientes/[id]/diagnostico/route.ts` — ambos corrigidos.
- Consequência: a página `/dashboard/clientes/performance` e a `[id]/performance` funcionam **mesmo antes** de rodar a migration — cadastro base, teses, timeline (otimizações/reuniões) aparecem. Score/risco/alertas/campanha "acendem" sozinhos conforme a migration roda e os crons populam.

### 2026-04-08 — Portal do Colaborador: extensões mínimas

Spec original pedia recriar tudo em `/time/portal` com tabelas `colaboradores_rh`, `kanban_colunas/tarefas` etc. **Decisão**: manter o `/portal` existente intacto e só estender — o schema atual (`employees` + `team_members_profile` + `tarefas_kanban`) já cobria ~80% do pedido. Tabelas paralelas iriam duplicar auth, storage, cronômetro e kanban que já funcionam.

**Migration** (`migrations/migration-portal-extensao.sql` — rodar manualmente no Supabase):
- `team_members_profile`: `+ ote numeric`, `+ cargo_nivel integer`, `+ data_renovacao_contrato date`
- `tarefas_kanban`: `+ cronometro_encerrado boolean default false` (lock irreversível ao concluir)
- **Novas**: `trilha_cargos` (nivel unique, kpis jsonb), `portal_conteudo` (PK tipo ∈ cultura/regras, seed inicial), `colaboradores_beneficios` (FK employees), `colaboradores_punicoes` (FK employees, soft delete via `deleted_at`). Todas com RLS + policy `service_role_all`.

**APIs novas** (`/api/portal/*`, auth via `getSession()` + `requireAdmin()` em `src/lib/portal-admin.ts`):
- `GET/PUT /api/portal/conteudo/[tipo]` — cultura/regras, PUT só admin, upsert `atualizado_por/atualizado_em`
- `GET/POST /api/portal/trilha` + `PUT/DELETE /api/portal/trilha/[id]` — CRUD de cargos, escrita só admin
- `GET/POST /api/portal/rh/[employee_id]/beneficios` + `DELETE ?id=` — hard delete
- `GET/POST /api/portal/rh/[employee_id]/punicoes` + `DELETE ?id=` — soft delete via `deleted_at`

**Edit em `/api/tarefas-kanban` PATCH**: transição `fazendo → concluido` seta `cronometro_encerrado=true` junto com `finalizado_em`. `action: "toggle_timer"` retorna `409` se `cronometro_encerrado=true` — impossível dar play em tarefa concluída.

**Páginas novas**: `/portal/cultura` e `/portal/regras` — layout idêntico (leitura formatada; admin vê botão Editar → textarea inline → PUT; footer com "Última atualização").

**Deferido** (backend pronto, UI pode ser adicionada depois):
- Página `/portal/trilha` consumindo `/api/portal/trilha`
- Tabs Benefícios/Punições em `/portal/equipe` consumindo `/api/portal/rh/[id]/*`
- Tab Trilha/Desempenho em `/portal/meu-perfil`

**DESCARTADO do spec original** (com motivo):
- `colaboradores_rh` nova tabela → duplicaria `employees`+`team_members_profile`. Extensão via ALTER.
- `kanban_colunas/kanban_tarefas` novas → quebraria `/portal/tarefas` e `/api/tarefas-kanban` atuais. Colunas seguem hardcoded (`a_fazer/fazendo/concluido`).
- `kanban_cronometro_log` por sessão → `total_segundos` cumulativo já atende a UI.
- `/time/portal` como root novo → duplicaria 5 páginas existentes.
- `@hello-pangea/dnd` → página atual usa botão "Avançar", lib nova é retrabalho sem ganho.

### 2026-04-08 — Módulo Performance de Clientes (MVP)

Criada a tela `/dashboard/clientes/performance` consolidando CPL, ROAS, saúde, risco de churn e regularidade operacional por cliente operacional.

**Modelo de dados real descoberto** (briefing original estava errado):
- `clientes_receita` = fonte ("Entrada" financeira): `id`, `nome`, `status_financeiro`, `valor_mensal`, `categoria`. **Não carrega metadata operacional.**
- `clientes_notion_mirror` ← linkada por `entrada_id` → `clientes_receita.id`. É onde vivem `nicho`, `status`, `situacao`, `analista`, `fb_url`, `gads_url`, `otimizacao`. `notion_id` é a chave pras tabelas satélite.
- `clientes_teses` ← `notion_id` (não `teses_cliente`)
- `otimizacoes_historico` ← `notion_id` (não `otimizacoes_cliente`), tem `data`, `data_confirmacao`, `feito`
- `reunioes_cliente` ← `cliente_notion_id`, tem `data_reuniao`

**Arquivos criados**:
- `migrations/migration-clientes-performance.sql` — idempotente, adiciona à **`clientes_notion_mirror`**: `meta_campaign_id`, `meta_adset_id`, `meta_leads_semana`, `score_saude`, `score_calculado_em`, `risco_churn`, `risco_churn_motivo`, `risco_calculado_em` + índices + checks (score 0-100, risco em baixo/medio/alto). `nicho` **não** foi adicionado (já existe na mirror). **Rodar no Supabase manualmente.**
- `src/app/api/clientes/performance/route.ts` — GET seguindo o padrão de `/api/dashboard/clientes`: join `clientes_receita` ← entrada_id → `clientes_notion_mirror` ← notion_id → teses/otimizações/reuniões. Retorna tese ativa, orçamento somado de teses, dias desde última otimização, dias desde última reunião, score, risco. Filtra operacionais (status_financeiro ∈ ativo/pausado/pagou_integral/parceria).
- `src/app/dashboard/clientes/performance/page.tsx` — 4 KPIs (CPL médio ponderado, ROAS médio, clientes em risco, score médio), filtros por nicho/tese/risco, tabela com barra de saúde 0-100, badge de risco, coluna "dias desde última otimização" (verde ≤7d, amarelo ≤14d, vermelho >14d). Spend Meta buscado client-side via `/api/meta-spend?campaign_id=`.
- `src/components/sidebar.tsx` — item "Performance" no grupo Dashboard.

**Regras aplicadas**: CPL ponderado (spend/leads), ROAS = LTV (valor_mensal × 12) / spend, clientes sem `meta_campaign_id` mostram "Sem campanha", soft delete em `clientes_teses` e `otimizacoes_historico`.

**Segunda rodada — página de detalhe + IA**:
- `src/app/api/clientes/[id]/performance/route.ts` — GET detalhe: cadastro, teses, timeline unificada (otimizações + reuniões ordenadas desc), benchmark do nicho (outros clientes anonimizados "Cliente A/B/C", só o próprio mantém nome real).
- `src/app/api/clientes/[id]/diagnostico/route.ts` — POST, `callAI` com `anthropic-haiku`, contexto = teses ativas + últimas 20 otimizações + últimas 10 reuniões + score + risco. Prompt em pt-BR estruturado (Diagnóstico / Pontos de atenção / Ações prioritárias). `salvar_notion: true` chama `saveToNotion` (tipo Analise, tag = nicho, relevância Alta se risco=alto).
- `src/app/dashboard/clientes/[id]/performance/page.tsx` — header com score grande + badge de risco, aviso se `meta_campaign_id` null, 4 tabs:
  - **Visão Geral**: KPIs (ticket mensal, LTV 12m, teses ativas, situação) + lista completa de teses
  - **Linha do Tempo**: timeline vertical unificada com ícone (otimização=chave azul, reunião=pessoas roxo), flag "não confirmada"
  - **Benchmark**: score médio do nicho + gráfico de barras horizontal comparando com outros do mesmo nicho anonimizados
  - **IA — Diagnóstico**: botão "Gerar análise" (Claude Haiku) + "Salvar no Notion"
- Link "Ver detalhes" da lista agora aponta pra `[id]/performance`.

**Ainda deferido** (infra, não-bloqueante):
- Crons `calcular-score` (segunda 08h) e `analise-risco` diário 07h (Gemini Flash) — precisa `vercel.json` + `CRON_SECRET`. Hoje `score_saude` e `risco_churn` são colunas manuais na mirror; quando o cron rodar, populam automaticamente e a UI já exibe.
- Tab "Leads" na página de detalhe — deferida **de propósito**: auditoria 2026-04-08 mostrou 95% dos leads sem `ad_id`, atribuição GHL→Meta quebrada. Incluir tab com dados ruins seria enganoso.

---

### 2026-04-08 — Auditoria de dados + correção de atribuição GHL + Data Health

Investigação completa da saúde dos dados e fix na causa raiz da perda de atribuição.

**Problemas encontrados**:
- `leads_crm`: 862 de 903 leads (95.5%) sem `ad_id`, `utm_*`, `ctwa_clid` — todos os campos de atribuição nulos.
- Gap Meta↔CRM: Meta reporta 347 leads em 7 dias; CRM atribui só 42 (88% de perda).
- `ads_metadata`: 242 ads marcados como `ACTIVE` mas só 14 têm performance nos últimos 7 dias (228 fantasmas — sync não reconciliava status).
- `team_commission_config`: vazio (0 colaboradores com metas configuradas).
- `team_notion_mirror`: 1 row com cargo `"Closer "` (whitespace sujo).

**Causa raiz da atribuição**:
O GHL tem os campos nativamente em `contact.attributionSource` (`adId`, `adName`, `ctwaClid`, `medium`, `sessionSource`, `url`) + 4 custom fields (`Ad ID`, `utm_campaign`, `utm_content`, `Click_ID`) — mas `syncGHL()` em `src/app/api/sync/route.ts` **nunca lia esses campos**. Só gravava `ghl_contact_id`, `nome`, `telefone`, `email`, `etapa`, `closer_id`, `mes_referencia`, `canal_aquisicao` no `leads_crm`. Todos os outros ficavam nulos.

**Correções aplicadas (código)**:
- `src/app/api/sync/route.ts`
  - `syncGHL()` agora: para cada opportunity, faz `GET /contacts/{id}` no GHL (com cache em memória por execução), extrai `contact.attributionSource` e `contact.customFields`, e grava em `leads_crm`: `ad_id`, `ad_name`, `ctwa_clid`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `session_source`, `origem_utm` (landing URL).
  - Constante `GHL_CUSTOM_FIELDS` centraliza os IDs dos custom fields do GHL (`Ad ID=IOPAIb5b5D2V39G4GC7S`, `utm_campaign=NRAY4NXlrj7sBdaV3Uji`, `utm_content=yFzqxS2ttcjfXd3V76rz`, `Click_ID=kj0UISs5M4uAFFLgEtdW`). Atualizar se forem recriados no GHL.
  - `syncMeta()` agora reconcilia `ads_metadata.status`: ads que não vieram no fetch do Meta são marcados como `ARCHIVED` (preservando histórico de `ads_performance`).
- Nenhum endpoint público novo consumindo esses dados — `visao-geral`, `campanhas`, `anuncios`, `inteligencia` já liam `leads_crm.ad_id` e `leads_ads_attribution`; vão começar a retornar números reais assim que o sync rodar pela primeira vez após esta correção.

**Novo endpoint / página de monitoramento**:
- `GET /api/data-health` — retorna 9 checagens: atribuição de leads, volume mês, staleness do ads_metadata, ads fantasma, cobertura de performance, gap Meta↔CRM, commission_config, whitespace em cargos, cobertura de creative_scores. Cada checagem tem `status` (ok/warn/error) e `fix` sugerido.
- `/config/data-health` — página visual do relatório com botões de "Sync Meta" e "Sync GHL" para rodar o sync direto dali. Rerun manual via botão Recarregar.

**Fix SQL aplicado direto no Supabase**:
- `team_notion_mirror`: `UPDATE SET cargo = TRIM(cargo)` na row com `cargo="Closer "`. Confirmado via `/api/data-health` → 0 linhas sujas.

**Configuração EXTERNA ainda pendente (usuário precisa fazer)**:
- **GHL → Settings → Integrations → Facebook**: habilitar "Pull Ad Data" / "Attribution tracking". Sem isso, o `contact.attributionSource.adId` do GHL continua `null` e o novo código do sync não tem o que ler. O Meta precisa estar integrado ao GHL para popular automaticamente esses campos em cada lead novo (especialmente para Click-to-WhatsApp ads).
- **Alternativa temporária**: cada campanha nova pode ter URL params configurados (`?utm_campaign=...&ad_id={{ad.id}}`) na landing page do GHL form para preencher os custom fields manualmente. Mas Click-to-WhatsApp não passa pela landing → depende obrigatoriamente da integração Meta→GHL.
- **Ação sugerida depois da integração ficar pronta**: rodar `POST /api/sync?source=ghl` para fazer backfill dos 862 leads órfãos com os dados que o GHL agora tiver.

**Parâmetros UTM — resposta à pergunta do usuário**:
Não é necessário adicionar novos parâmetros. O GHL já oferece nativamente `adId`, `adName`, `ctwaClid`, `medium`, `sessionSource`, `url` via `attributionSource`, e tem 4 custom fields adicionais. Os 6 + 4 = 10 campos cobrem 100% da atribuição publicitária (feed, stories, reels, click-to-whatsapp, landing page com UTM). O problema é (a) configurar a integração Meta→GHL para POPULAR esses campos e (b) o sync lê-los — (b) agora está feito.

**Ordem recomendada de próximos passos**:
1. Configurar integração Meta→GHL para habilitar attribution automática.
2. Rodar `POST /api/sync?source=meta` uma vez → arquiva os 228 ads fantasma (problema #2 resolvido automaticamente).
3. Rodar `POST /api/sync?source=ghl` uma vez após (1) → popula ad_id/UTMs nos leads órfãos.
4. Abrir `/config/data-health` → todas as métricas devem passar a ok / warn.
5. Admin cadastra metas em `/equipe` para resolver `team_commission_config` vazio.

---

### 2026-04-08 — Redesign da seção Tráfego Pago (UI/UX)

Melhorias visuais nas páginas `/trafego/*`. Nenhuma lógica de fetch/KPI/API foi alterada.

- **Helpers compartilhados**
  - `src/lib/trafego-ui.ts` → `truncateAdName()`: corta em ` - [T]` ou 35 chars. Usado em Visão Geral, Anúncios, Alertas.
  - `src/components/empty-cell.tsx` → `<EmptyCell value render reason allowZero />`: padroniza estados vazios (`—` para null, `Sem dados` muted para integração ausente, `0` apenas quando `allowZero`).
- **Visão Geral** (`/trafego/visao-geral`)
  - KPIs em 2 grupos: primário (Investido/CPL/Leads CRM, `text-2xl`) e secundário (text-base, bg sutil) separados por borda.
  - Card CRM vs Meta com barra de progresso colorida dinâmica (<40 vermelho, 40–70 amarelo, >70 verde) e % em destaque.
  - `AlertsPanel` inicia expandido quando há alertas críticos; colapsado se só avisos (prop `defaultExpanded`).
  - Top Anúncios: labels 11px muted ACIMA dos valores 14px bold; nome truncado com tooltip.
- **Campanhas** (`/trafego/campanhas`) — reescrito
  - Tabela compacta (Campanha|Leads|CPL|Investido|Qualif.%|Reuniões|Fechados|Status); clique na linha abre accordion inline com funil + gráfico CPL.
  - Funil em barras agora usa **escala relativa** ao total de leads da campanha.
  - Card top performer (borda azul/roxa + troféu) acima da tabela — menor CPL com ≥1 lead.
- **Anúncios** (`/trafego/anuncios`)
  - Coluna **Score** movida para 2ª posição.
  - Colunas **C/Reunião** e **C/Fech.** ocultas por padrão; dropdown "＋ Colunas" no topo da tabela.
  - Top-3 por Investido com borda esquerda ouro (`#F59E0B`) / prata (`#94A3B8`) / bronze (`#CD7C3A`).
  - Nome do anúncio truncado com `truncateAdName()`.
- **Conjuntos** (`/trafego/conjuntos`)
  - 3 mini-KPIs acima da tabela: Total Investido, CPL Médio Ponderado, Conjuntos Ativos.
  - Filtro "Somente Ativos" já era default no `useTrafegoFilters` (`statusFiltro="ACTIVE"`).
- **Ad Intelligence** (`/trafego/inteligencia`)
  - Score: gauge semicircular substituído por **badge retangular** com label (Crítico 0–30, Atenção 31–60, Bom 61–80, Ótimo 81–100).
  - Coluna MRR: mostra **"Sem dados"** muted quando `mrr=0 && contracts=0`; mantém `R$ 0,00` se há contratos.
  - Tab **Sugestões** recebe badge laranja (`bg-orange-500/20 text-orange-400`) quando há sugestões.
  - **Última sync** exibida abaixo do botão "Sincronizar Leads" via `formatRelativeTime()` (agora/há Xmin/Xh/Xd).
- **Vídeos** (`/trafego/video`)
  - `VideoKpiCards`: cores semânticas dinâmicas — Hook Rate (≥80 verde / 60–79 amarelo / <60 vermelho), Completion (>15 verde / 5–15 amarelo / <5 vermelho), Custo/ThruPlay (≤1,50 verde / 1,51–3,00 amarelo / >3,00 vermelho).
  - `HookRanking`: adicionadas colunas **Leads** e **CPL** (fetch extra em `ads_performance` últimos 90d, match por `ad_id`; `—` quando ausente).
  - `FunnelRetentionMap`: `<ReferenceLine y={3}>` pontilhada — "Benchmark 3%".
- **Alertas** (`/trafego/alertas`)
  - Tabela dividida em 2 seções: **🔴 Alertas Críticos (N)** (header vermelho) e **⚠️ Avisos (N)** (header amarelo).
  - Botões IA / 24h recebem `title` tooltip: "Gerar sugestão com IA" / "Silenciar por 24h".
  - Nome do anúncio truncado com `truncateAdName()` + tooltip completo.
- **Relatórios** (`/trafego/relatorios`)
  - Variações agora coloridas por **impacto no negócio**, não pela direção. Investido → neutro. Leads/CTR/Fechados/ROAS → maior é verde. CPL/CAC → maior é vermelho.
  - Se o período anterior está totalmente zerado, colunas "Anterior"/"Variação" ocultas e mostra "Sem dados para comparação no período anterior".
  - Altura dos gráficos Tendência Diária e Leads/dia aumentada para **240px**.
- **Global**
  - `useTrafegoFilters` persiste o período selecionado em `localStorage["trafego_periodo_filtro"]` e hidrata ao montar — a seleção viaja entre as páginas `/trafego/*`.
  - `<EmptyCell>` disponível para código novo. **Parcial**: a substituição dos `"—"` literais já existentes nas páginas NÃO foi feita globalmente — o output visual já é idêntico ao default do componente, então foi deixado para evolução gradual.
- **API** (bugfix colateral) `src/app/api/team/comissao/route.ts`: retorna 200 com `resultado: null` quando o membro não tem cargo de comissão (admin/gestor), em vez de 404. Remove poluição nos logs do dev server.

### 2026-04-07 — Cadastro centralizado em /equipe (Gestão)

- **Cadastro de colaboradores migrado** de `/config` para `/equipe` (aba **Gestão**). `/config` agora só mostra um aviso e link para /equipe.
- **NovoModal** em `/equipe` expandido: nome, usuário, senha (olho), **cargo granular** (Closer/SDR/Tráfego/Head/Pleno/Junior/Diretor/Desenvolvimento/Admin), email, telefone, data de admissão, funções. Um único submit cria em todas as tabelas do cargo.
- **Botão "Backfill"** no header de `/equipe`: chama `POST /api/employees/backfill` (admin-only) que itera `closers` + `sdrs` + `team_notion_mirror` e cria em lote contas de login (senha padrão `comarka2026`) para todo mundo que ainda não tem employees. Pula quem já existe.
- **Migration** `migration-backfill-employees.sql` atualizada: agora também faz backfill de todos os operacional + administrativo de `team_notion_mirror` (não só closers/sdrs). Mesma senha padrão. Idempotente.
- **API** `PATCH /api/employees/[id]`: agora aceita `cargo` e `email` também.

### 2026-04-07 — Backfill de employees e edição completa em /equipe

- **Migration**: `migrations/migration-backfill-employees.sql` — para cada `closers`/`sdrs` sem `employees`, cria conta de login com **senha padrão `comarka2026`** (hash SHA-256 via pgcrypto, compatível com `/api/auth/login`). Usuario derivado de `closers.usuario` se existir, senão `slugify(nome)`. `senha_visivel` também populada com `comarka2026` para o admin trocar pelo modal.
- **Backfill cargo**: registros antigos com `cargo` null recebem o valor a partir de `role` (closer→Closer, sdr→SDR, admin→Admin).
- **API** `PATCH /api/employees/[id]`: passa a aceitar `cargo` e `email` além dos campos antigos.
- **UI** `/equipe` EditModal:
  - Campos completos: nome, usuário, senha (olho), **cargo granular** (Closer/SDR/Tráfego/Head/Pleno/Junior/Diretor/Desenvolvimento/Admin), email, telefone, data de admissão.
  - `role` enum é derivado automaticamente do cargo no salvar.
  - Aviso amarelo quando a senha cadastrada ainda é a padrão `comarka2026` (lembrete pra trocar).
- **Resultado**: depois de rodar a migration, todos os closers/sdrs já criados aparecem em `/equipe` com login funcional (`comarka2026`). O admin clica no lápis e completa email, telefone, data, troca a senha — tudo num modal só.

### 2026-04-07 — Cadastro unificado de colaborador em /config

- **Migration**: `migrations/migration-employees-cargo.sql` — adiciona `employees.cargo TEXT` (mais granular que role: Closer, SDR, Tráfego, Head, Pleno, Junior, Diretor, Desenvolvimento, Admin). Backfill copia `role → cargo` em registros existentes.
- **API** `/api/employees` POST estendida:
  - Aceita `cargo`, `email`, `funcoes` além dos campos antigos.
  - Deriva `role` enum a partir do cargo (closer/sdr/admin).
  - Sempre cria em `employees`.
  - Se cargo=Closer → também cria em `closers`.
  - Se cargo=SDR → também cria em `sdrs`.
  - Se cargo for **operacional** (Tráfego/Head/Pleno/Junior/Diretor/Desenvolvimento/CEO) → também cria em `team_notion_mirror` com `notion_id='local_<uuid>'`. Assim a pessoa **aparece automaticamente como analista** no dropdown do perfil dos clientes.
- **UI** `/config`: nova seção **"Cadastrar Colaborador"** no topo com formulário completo (nome, usuário, senha com olho, cargo, email, telefone, data admissão, funções). Um único submit grava em todas as tabelas correspondentes ao cargo.
- **Resolve o problema do login**: antes a página `/closers` (e o CRUD direto em `/config`) inseria só na tabela `closers`, sem criar `employees` → o colaborador não conseguia logar. Agora o caminho oficial é `/config → Cadastrar Colaborador` que cria tudo junto.

### 2026-04-07 — Senha visível na Equipe (admin)

- **Problema**: o login é SHA-256 (one-way), então o admin não conseguia recuperar a senha de um colaborador para compartilhar.
- **Migration**: `migrations/migration-employees-senha-visivel.sql` — adiciona `employees.senha_visivel TEXT` (texto plano apenas para o admin visualizar).
- **API** `/api/employees`:
  - POST grava `senha_visivel = senha` junto com o hash.
  - PATCH `/api/employees/[id]`: quando `senha` é enviada, atualiza ambos `senha_hash` e `senha_visivel`.
- **UI** `/equipe`:
  - Novo componente `PasswordField` reutilizável: input com botão **olho** (Eye/EyeOff) para mostrar/ocultar (default oculto) + botão **copiar** quando há valor.
  - **NovoModal**: campo Senha agora usa `PasswordField`.
  - **EditModal**: carrega `senha_visivel` da API e mostra no `PasswordField`. Admin clica no olho para ver/editar.
- **Para usuários antigos** (criados antes da migration), `senha_visivel` será `null` — admin precisa abrir o EditModal e definir uma nova senha uma vez. Isso resolve o caso da funcionária que não conseguia logar: abre o registro, define nova senha, compartilha.

### 2026-04-07 — Verificação final + cleanup soft-delete (Fase 8)

- Type-check completo (`npx tsc --noEmit`) sem erros após todas as 7 fases.
- Auditoria de leitores de `clientes_teses` e `otimizacoes_historico` para garantir que ninguém vê registros soft-deletados:
  - `/api/notion/clientes-filtrados/route.ts`: passou a filtrar `deleted_at IS NULL` em `clientes_teses`.
  - `/api/clientes/resumo-semanal/route.ts`: passou a filtrar `deleted_at IS NULL` em `clientes_teses` e `otimizacoes_historico`.
- Verificações de não-quebra:
  - `clientes_notion_mirror`: o trigger novo grava `notion_id='local_<uuid>'`, sem conflito com IDs do Notion vindos do `/api/mirror/sync`. Sync do Notion continua funcionando.
  - `/churn`, `/financeiro` e `/onboarding` lêem `clientes` (tabela diferente de `clientes_notion_mirror`) e `clientes_receita`. Nenhum desses caminhos foi tocado pelas fases.
  - PATCH de `/api/dashboard/clientes` não escreve mais no Notion (`updateClienteAnalista` removido na Fase 1) — perfil e lista agora consistentes.
- **Migrations a rodar (em ordem) no Supabase**:
  1. `migration-fluxo-entrada-clientes.sql`
  2. `migration-clientes-teses-v2.sql`
  3. `migration-clientes-crm-config.sql`
  4. `migration-otimizacoes-snapshot.sql`

### 2026-04-07 — Alertas de gestão na página Clientes (Fase 7)

- **API** `/api/dashboard/clientes`: GET agora enriquece cada cliente com `teses_count`, `teses_ativas_count`, `primeira_tese_created_at`, `ultima_otimizacao_data`, `ultima_otimizacao_confirmada_em`, `ghl_subaccount_id`. Dados vêm de joins extras com `clientes_teses`, `otimizacoes_historico`, `clientes_crm_config` (todos com `deleted_at IS NULL`).
- **UI** `/dashboard/clientes/page.tsx`:
  - Função `alertasGestor(c)` aplica 5 regras: (1) sem tese ativa há >7 dias, (2) sem otimização nos últimos 30 dias, (3) otimização pendente há >5 dias sem confirmação, (4) `ghl_subaccount_id` null, (5) SDR/Closer não atribuído.
  - **Fim de semana**: `isWeekendNow` (dom/sáb) zera todos os alertas, conforme regra do projeto.
  - **Badge por cliente**: contador vermelho "⚠ N" ao lado do nome com tooltip listando os alertas específicos.
  - **Sino global**: ícone `Bell` no topo com badge vermelho do total. Clique abre modal listando todos os clientes com alertas (link para o perfil de cada um + labels dos alertas).
  - Modal respeita `isWeekendNow` e mostra aviso "Alertas não disparam aos fins de semana".

### 2026-04-07 — Otimizações: editar, soft delete, snapshot de métricas (Fase 6)

- **Migration**: `migrations/migration-otimizacoes-snapshot.sql` — acrescenta em `otimizacoes_historico`: `deleted_at`, `data_confirmacao`, `snapshot_metricas JSONB`, `updated_at`.
- **API** `/api/clientes-extra/otimizacoes`:
  - POST agora grava `data_confirmacao = now()` e aceita `snapshot_metricas` no body.
  - PATCH aceita `confirm: true` (atualiza `data_confirmacao`) + `snapshot_metricas` opcional + `updated_at`.
  - DELETE vira **soft delete** (seta `deleted_at`).
- `/api/clientes-extra/[id]`: GET filtra `deleted_at IS NULL` nas otimizações.
- **UI perfil**:
  - Botão "Editar" por otimização → formulário inline com os campos atuais. Botão "Confirmar" dispara `capturarSnapshot` + PATCH com `confirm: true`.
  - "Nova Otimização" também captura snapshot automaticamente no POST.
  - Delete pede confirmação via `confirm()` e faz soft delete (UI remove da lista).
  - Cada otimização com `snapshot_metricas` mostra seção colapsável "Métricas no momento da confirmação" com CPL / ROAS / leads / spend / histórico da última mudança / data da confirmação.
- **Snapshot**:
  - `spend_periodo` e `leads_periodo` vêm de `GET /api/meta-spend?since=YYYY-MM-01&until=hoje` (chamada direta à Meta, não cache do n8n).
  - `cpl_atual = spend / leads`.
  - `roas_atual = (valor_mensal × fidelidade_meses) / spend` (calcula apenas se o contrato estiver carregado).
  - `historico_ultima_mudanca` = resumo textual dos campos antes da edição (preservado no snapshot novo).

### 2026-04-07 — Aba CRM (GHL) no perfil do cliente (Fase 5)

- **Migration**: `migrations/migration-clientes-crm-config.sql` — nova tabela `clientes_crm_config` (`cliente_id` unique=notion_id, `ghl_subaccount_id`, `ghl_pipeline_id`, `stage_mapping JSONB`, `conexao_ativa`, `last_sync_at`, `last_test_at`, `last_test_result`, `deleted_at`).
- **APIs novas**:
  - `GET /api/clientes/crm-config?cliente_id=<notion_id>` — config atual.
  - `PUT /api/clientes/crm-config` — upsert por `cliente_id`.
  - `GET /api/ghl/pipelines` — lista pipelines distintos de `ghl_funnel_snapshot` (snapshot mais recente).
  - `GET /api/ghl/pipelines?pipeline_id=X` — stages do pipeline (ordenados por `stage_position`). Como o snapshot não tem `stage_id`, usamos `stage_name` como identificador (único por pipeline).
  - `POST /api/ghl/test-connection` `{ cliente_id, ghl_subaccount_id }` — pinga `services.leadconnectorhq.com/locations/<id>` com `GHL_API_KEY`. Persiste `conexao_ativa`, `last_test_at`, `last_test_result`.
- **UI** `[id]/page.tsx`: nova aba "CRM" com:
  - Campo Subaccount ID + select de pipeline.
  - Botão "Testar conexão" → pinga GHL e atualiza badge Ativa/Desconectado.
  - Mapeamento de etapas: para cada stage do pipeline, select com status internos (Novo Lead, Reunião Marcada, Reunião Feita, Proposta Enviada, Follow-up, Comprou, Perdido).
  - Botão "Salvar" grava tudo via PUT.
  - Exibe último teste e última sincronização.

### 2026-04-07 — Teses v2 substituem Saúde do Cliente (Fase 4)

- **Migration**: `migrations/migration-clientes-teses-v2.sql` — acrescenta em `clientes_teses`: `nome_tese`, `tipo`, `publico_alvo`, `status` (Ativa/Pausada/Em Teste, CHECK), `data_ativacao`, `observacoes`, `deleted_at`. Backfill copia `tese → nome_tese`. Colunas `tese` e `orcamento` mantidas (soma de orçamento continua substituindo o orçamento principal do cliente).
- **API** `/api/clientes/teses`: GET filtra `deleted_at IS NULL`. POST aceita todos os campos novos, `status` default 'Ativa', `data_ativacao` default hoje. PATCH passa campos novos e valida status. DELETE vira **soft delete** (atualiza `deleted_at`).
- **UI perfil do cliente** (`src/app/dashboard/clientes/[id]/page.tsx`):
  - Card "Saúde do Cliente" **removido** da aba Geral. Substituído por card compacto "Teses" com preview (nome, badge colorido por status, tipo, público, data). Botão "Gerenciar →" leva para a aba Teses.
  - Aba Teses: cards completos com todos os campos editáveis (nome, tipo=Área do Direito, público-alvo, status, data ativação, observações, orçamento). Status com badges coloridos: **verde=Ativa**, **cinza=Pausada**, **amarelo=Em Teste**. Delete pede confirmação e faz soft delete.
- **Compat**: colunas `saude_score/observacao/tendencia` em `clientes_extra` permanecem no schema (não fizemos DROP). Apenas a UI foi removida. Se quiser limpar depois, é ALTER TABLE manual.

### 2026-04-07 — SDR e Closer que fecharam o cliente (Fase 3)

- **Nova rota**: `/api/dashboard/fechamento?nome=<cliente>` cruza `contratos.cliente_nome` (normalizado) e devolve `sdr_id`, `closer_id`, `sdr_nome`, `closer_nome`, `data_fechamento` do contrato mais recente. Resolve nomes via tabelas `sdrs` e `closers`.
- `/api/dashboard/clientes`: GET enriquece cada cliente com `fechamento: { sdr_id, closer_id, sdr_nome, closer_nome }` (mesma lógica em batch — uma única query). Permite badges na lista sem N+1.
- `src/app/dashboard/clientes/page.tsx`: card da lista mostra avatares circulares (1ª letra) coloridos azul=SDR, verde=Closer, com tooltip do nome completo.
- `src/app/dashboard/clientes/[id]/page.tsx`: perfil exibe duas linhas novas "SDR responsável" e "Closer que fechou" com avatar + nome. Carregadas via `/api/dashboard/fechamento` quando o nome do cliente é conhecido.
- **Origem do dado**: a tabela `clientes_receita` (Entrada financeira) só tem `closer text` (string solta). A fonte real de SDR/Closer com IDs é a tabela `contratos` (criada em `migration-v2.sql`), preenchida pela página `/contratos`. O cruzamento é por nome normalizado (mesma função `normalize` usada em outros lugares).

### 2026-04-07 — Analistas dinâmicos no perfil do cliente (Fase 2)

- `src/app/dashboard/clientes/[id]/page.tsx`: trocada a chamada `/api/notion/gestores` (Notion direto) por `/api/dashboard/analistas` (lê de `team_notion_mirror`, sem Notion). Lista agora vem da mesma fonte que a aba Clientes — qualquer membro Operacional/Head/Pleno/Junior/Tráfego/Desenvolvimento/Diretor adicionado ao time aparece automaticamente.
- Bug pré-existente corrigido: o select salvava `g.id` (notion_id do gestor) mas a UI exibia `g.nome`. Agora salva `g.nome`, consistente com a página da lista. Edições antigas com IDs continuam visíveis no fallback "Atual: ...".

### 2026-04-07 — Fluxo único Entrada → Clientes (Fase 1)

A aba `/dashboard/clientes` agora é dirigida 100% por `clientes_receita` (formulário "Entrada" do financeiro). O Notion deixa de ser fonte: a tabela `clientes_notion_mirror` virou apenas armazenamento local dos campos editáveis (status, situação, resultados, atenção, analista, etc).

- **Migration**: `migrations/migration-fluxo-entrada-clientes.sql` — adiciona `entrada_id` na mirror, função `normalize_cliente_nome`, função/trigger `entrada_to_clientes_mirror` em `clientes_receita` (AFTER INSERT/UPDATE OF status_financeiro), e backfill linkando rows existentes por nome normalizado + criando mirror para entradas órfãs.
- **Regra**: toda nova entrada cria/linka uma row na mirror com `status='Não iniciado'`. Quando uma entrada volta de qualquer status para `status_financeiro='ativo'` (churn revertido / contrato reativado), o status na mirror é resetado para `'Não iniciado'`.
- **API** `/api/dashboard/clientes`: GET passa a iterar `clientes_receita` (operacional: ativo/pausado/pagou_integral/parceria) e busca a mirror via `entrada_id` (com fallback de nome para legado). PATCH não escreve mais no Notion (`updateClienteAnalista` removido). Suporta `notion_id="pending_<entrada_id>"` para criar a mirror row sob demanda.
- **`notion_id` continua como ID interno** — quando o sync com Notion for desligado, nada quebra; novas mirror rows são geradas localmente como `local_<uuid>`.
- Outras páginas (`/churn`, `/financeiro`, `/onboarding`) **não foram tocadas** — continuam lendo `clientes_notion_mirror` / `clientes_receita` / `clientes` como antes.

---

## 1. COMECE POR AQUI

### 1.1 O que é este sistema?

Dashboard comercial da Comarka Ads — agência de marketing jurídico. Centraliza métricas de vendas, tráfego pago, time de SDR e closers, projeções financeiras e CRM. Todos os dados são interligados: o mesmo número aparece igual em todos os lugares.

### 1.2 Como rodar localmente

```bash
npm install
npm run dev
# Acesse http://localhost:3000
```

### 1.3 Variáveis de ambiente (.env.local)

| Variável | O que é | Onde pegar |
|----------|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do Supabase | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública do Supabase | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave admin do Supabase | Supabase → Settings → API |
| `GHL_API_KEY` | Chave da API GoHighLevel | GHL → Settings → API |
| `GHL_LOCATION_ID` | ID da subaccount GHL | GHL → Settings → Business Profile |
| `META_ADS_ACCESS_TOKEN` | Token Meta Ads | Meta Business → Marketing API |
| `META_ADS_ACCOUNT_ID` | ID da conta (formato `act_XXXX`) | Meta Ads Manager |
| `ANTHROPIC_API_KEY` | API Claude | console.anthropic.com |
| `OPENAI_API_KEY` | API OpenAI | platform.openai.com |
| `GEMINI_API_KEY` | API Gemini | aistudio.google.com |
| `NOTION_API_KEY` | Integração Notion | notion.so/my-integrations |
| `ASAAS_API_KEY` | Chave API Asaas (cobranças) | Asaas → Minha Conta → Integrações → API |
| `ASAAS_ENVIRONMENT` | `production` ou `sandbox` | Configuração manual |
| `ASAAS_WEBHOOK_TOKEN` | Token p/ validar webhooks Asaas | Asaas → Configurações → Webhooks |
| `ADMIN_WHATSAPP` | Nº WhatsApp admin (alertas financeiros) | Formato: 5511999998888 |

### 1.4 Deploy

```bash
vercel --prod
# URL: dashboard-comercial-one.vercel.app
```

### 1.5 Integrações externas

| Sistema | Função | Sincronização |
|---------|--------|---------------|
| **Supabase** | Banco de dados (PostgreSQL) | Tempo real |
| **Meta Ads** | Métricas de anúncios + pausar via API | A cada 2h via n8n + API direta + pausar via `/api/meta/pausar` |
| **GoHighLevel** | CRM e pipeline SDR | Webhook + sync 4h via n8n |
| **Notion** | Salva relatórios de IA | Automático |
| **n8n** | Automações | Cron jobs configuráveis |
| **Evolution API** | WhatsApp: alertas, anomalias, confirmações | Automático via crons e ações manuais |
| **Asaas** | Gateway de pagamentos (boleto, PIX, cartão) | Sync diário via cron + webhooks + API direta |

---

## 2. FUNCIONALIDADES DA DASHBOARD

---

### 2.1 DASHBOARD

#### 2.1.1 Visão Geral

**Caminho:** Dashboard → Visão Geral

- **Seletor de período:** Dia, Semana, Mês ou personalizado. Muda todos os dados.
- **Alertas:** Bloco minimizado no topo. Clique para expandir/recolher.
  - 🚨 Crítico: No-Show > 30%, ROAS < 2x, Resultado do Time < R$ 2.000
  - ⚠️ Aviso: Divergências entre fontes, alertas do SDR
- **Blocos de KPIs:**
  - Funil: Leads → Reuniões Agendadas → Taxa Comparecimento → Feitas → No-Show
  - Financeiro: Contratos, LTV, MRR, Ticket Médio
  - Marketing: Investido (Meta real), ROAS (LTV/Invest.), CPL, CAC
  - Time: Comissão (10% MRR), Resultado (MRR + Entradas - Comissão - Invest.)
- **Projeção de contratos:** Ritmo atual projetado até fim do mês.
  - Verde "No caminho certo" / Amarelo "Atenção" / Vermelho "Precisa acelerar"
  - **Em fins de semana:** exibe projeção neutra sem alerta de urgência
- **CRM resumido:** Leads ativos no pipeline com badges por etapa
- **Saúde do Time:** Linha por closer com status, score e link para análise

#### 2.1.2 Hoje

**Caminho:** Dashboard → Hoje

- **Meta diária:** Ritmo necessário (leads, reuniões, contratos) para bater a meta mensal
  - **Em fins de semana:** mostra "Fim de semana — sem meta diária" ao invés de alerta
- **Leads que chegaram:** Nome, telefone, canal, anúncio + badge do responsável
  - Badge vermelho "Sem responsável" se lead não tem closer atribuído
  - Filtro: Todos / Sem responsável / [nome do closer]
- **Reuniões do Dia:** Leads agendados para o dia selecionado
- **Follow-ups Atrasados:** Leads em Follow Up há mais de 3 dias
- **Lançamentos:** Quais closers lançaram e quais estão pendentes
- **Navegação de data:** Setas ← → e calendário para ver qualquer dia

#### 2.1.3 Relatório Mensal

**Caminho:** Dashboard → Relatório Mensal

- **Visualizações:**
  - Todos os Closers — cards mensais com todas as métricas
  - Comparar Closers — tabela lado a lado (Contratos, MRR, Conv., No-Show, Ticket)
  - [Nome individual] — métricas do closer. Investimento atribuído = custo/reunião × reuniões dele
- **Cards mensais:** Topo de Funil → Reuniões → Conversão (com meta vs realizado) → Financeiro → Custos
- **Gráficos:** MRR × Resultado, Contratos, ROAS — com tendência linear e linha de meta
- **Investimento:** Vem do Meta Ads real, fallback para config_mensal

---

### 2.2 VENDAS

#### 2.2.1 CRM

**Caminho:** Vendas → CRM

- **Abas:** Todos, Oportunidade, Reunião, Proposta, Follow Up, Assinatura, Comprou, Desistiu, Frio
- **Filtro por Closer:** Dropdown. Salva na sessão (sessionStorage)
- **Colunas:**
  - Nome, Etapa (dropdown colorido), Na etapa há (dias com cores), Score (0-100 + badge), Closer, SDR, Funil, Origem, Canal, Entrada, Mensal, Fidelidade, Total, Data Venda, Criado em
- **Score de Lead (0-100):**
  - Área atuação +20, telefone +15, email +10, faturamento +15, mensalidade +15, canal +5, funil +5, ad_id +5, closer +5, site/insta +5
  - 🔥 Alta (≥70) / ⚡ Médio (≥40) / sem badge (baixo)
- **Etapa Frio:** Leads em Oportunidade > 30 dias → "⚠️ Inativo". Botão "Mover para Frio" em massa
- **Auto-contrato:** Mudar para "Comprou" cria contrato automaticamente
- **Linha expandível:** Todos os detalhes (telefone, email, área, objeções, resumo)

#### 2.2.2 Funil (Tempo de Fechamento)

**Caminho:** Vendas → Funil

- **KPIs:** Ciclo Médio Total, Criação→Reunião, Reunião→Proposta, Proposta→Fechamento
- **Fallback:** data_comprou → data_venda → updated_at
- **Tempo por Canal:** Tabela Canal × Ciclo Médio × Nº Contratos
- **Histograma:** Faixas 0-7d, 8-15d, 16-30d, 31-60d, 60d+
- **Leads Ativos:** Em andamento com dias no funil
- **Leads Fechados:** Tabela com datas de cada etapa

#### 2.2.3 Análise por Dias

**Caminho:** Vendas → Análise por Dias

- **Filtro por Closer:** Filtra tudo simultaneamente
- **Insights acionáveis:**
  - "✅ Concentre fechamentos às [dia]s (conv. X%). Evite [dia] (conv. Y%)."
  - "📞 Reforce confirmação às [dia]s — no-show de X%."
- **Gráfico:** Marcadas, Feitas, Contratos por dia da semana
- **Semanas:** 4 cards com Contratos, Feitas, No-show, Conv.
- **Heatmap:** Closer × Dia com taxa de conversão colorizada

#### 2.2.4 Histórico e Tendências

**Caminho:** Vendas → Histórico

- **Evolução MRR:** Gráfico com MRR, média móvel 3M e linha de meta
- **MRR Líquido:** Inputs de churn por mês + gráfico Bruto vs Líquido
- **Melhores marcas:** Maior MRR, Mais Contratos, Menor CAC
- **Tendência KPIs:** Tabela média 3M vs atual (↑↓→)

#### 2.2.5 Canais

**Caminho:** Vendas → Canais

- **Donut:** Canais dinâmicos (dos contratos reais). Clicável = filtra tabela
- **Comparativo:** Contratos, %, MRR, Ticket, LTV, CAC, Eficiência (LTV/CAC)
  - Canais pagos: CAC calculado / Orgânicos: "(orgânico)"
  - Ordenado por eficiência
- **Funil por Canal:** Leads → Reunião % → Proposta % → Contrato % + CPL, CPRF, CAC
- **MRR mensal por canal:** Gráfico de linha
- **Closer × Canal:** Tabela cruzada

#### 2.2.6 Churn

**Caminho:** Vendas → Churn

Dados vêm do Notion (database de Churn) + Supabase (tabela `clientes`), deduplicados por nome+data.

- **Seletor de período:** Este mês / 3M / 6M / 12M / Período personalizado / Tudo
- **KPIs:** Churn Rate (com tooltip explicativo), MRR Perdido, Clientes Ativos, MRR em Risco
- **Gráficos:** Churn Rate (%) linha + Saídas e MRR Perdido (barras)
- **Motivos:** Grade com barras de proporção e valor por motivo
- **Detalhamento por Mês:** Lista colapsável — clique para ver clientes daquele mês
- **Registrar churn:** Botão "+ Registrar" abre formulário (cliente, MRR, motivo, data, obs). Salva no Supabase
- **Impacto no Dashboard:** Card "Impacto do Churn" na Visão Geral com Churn Rate, MRR Perdido, MRR em Risco e Crescimento Líquido (MRR novo - Churn)

#### 2.2.7 Pipeline de Churn

**Caminho:** Vendas → Pipeline Churn

Kanban visual com 5 etapas do processo de cancelamento:
1. 📩 **Aviso de Saída Recebido** — cliente comunicou que vai sair
2. ⚖️ **Jurídico** — departamento jurídico envolvido
3. ⏳ **No Prazo do Aviso** — período de 30 dias em andamento
4. 📋 **Procedimentos Finais** — pausar campanhas, remover acessos, etc.
5. ✅ **Finalizado** — processo encerrado

- Cards mostram: nome, MRR, data, motivo, progresso da checklist
- Clicar no card abre painel com: info detalhada, navegação de etapas, botões Avançar/Retroceder, checklist da etapa
- Checklist baseada no processo real do Notion (analisar retorno, conferir pendências, avisar time, etc.)
- Progresso salvo em localStorage

---

### 2.3 TIME

#### 2.3.1 SDR

**Caminho:** Time → SDR

- **Título:** Mostra nome real do SDR selecionado
- **Alerta de lançamento:** Só em dias úteis (seg-sex). Não alerta em fins de semana
- **KPIs:** Leads, Reuniões Agendadas/Feitas, No-Show, % Leads→Reunião, Taxa Agendamento
- **Funil GHL:** Barras do pipeline real do GoHighLevel (sync 4h). Alertas embaixo

#### 2.3.2 Closers

**Caminho:** Time → Closers

- **Cards:** Nome + badge status + score + variação vs mês anterior + contratos + MRR + barra meta
- **Perfil individual:** Score gauge, breakdown, diagnósticos, lançamento diário embutido, IA

---

### 2.4 TRÁFEGO PAGO

#### 2.4.1 Visão Geral

**Caminho:** Tráfego Pago → Visão Geral

- **Período padrão:** "Este mês"
- **KPIs:** Investido, Impressões, Cliques, CTR, Leads, CPL, CAC, ROAS
- **Dados:** API direta do Meta (100% preciso). Fallback para Supabase
- **CPL:** Média ponderada (totalSpend/totalLeads)
- **Spend:** Inclui anúncios pausados que gastaram

#### 2.4.2 Estrutura / Campanhas / Conjuntos / Anúncios

**Caminho:** Tráfego Pago → Estrutura

Drill-down hierárquico: Campanhas → Conjuntos → Anúncios. CPL usa Meta leads em todos os níveis.

**Ao clicar em um anúncio:** abre modal com 3 tabs:

**Tab Leads:**
- Tabela de leads do `leads_crm` vinculados via `ad_id`
- Colunas: nome, status no CRM (badge), data entrada, nicho (area_atuacao), custo estimado (spend / total leads)
- Filtro por status do CRM
- Header mostra total de leads + CPL real

**Tab Criativo:**
- Se criativo vinculado em `trafego_criativos`: exibe score (0-10 com barra visual), fase do ciclo de vida (badge colorido), tipo
- Botão **"Ver análise IA"** → exibe `analise_resultado` (pontos fortes/fracos, sugestões A/B/C com cópia)
- Botão **"Gerar novo copy"** → chama `POST /api/ia/analisar-criativo` com Claude Haiku
- Se sem criativo: botão **"Vincular criativo"** → abre `/trafego/criativos`

**Tab Anomalias:**
- Lista de anomalias de `trafego_anomalias` do anúncio
- Badge por tipo com cor, causa provável, data
- Botão **"Resolver"** marca como resolvida

#### 2.4.3 Frequência

Heatmap de leads por dia da semana e hora do dia.

#### 2.4.4 Vídeo

Métricas de vídeo: Hook Rate, retenção por quartil, fadiga de criativo.

#### 2.4.5 Alertas

**Caminho:** Tráfego Pago → Alertas

3 tabs: **Alertas**, **Regras**, **Anomalias**.

**Tab Alertas:**
- CPL acima do threshold configurado
- CTR abaixo do mínimo (últimos 3 dias)
- Frequência saturada (últimos 7 dias)
- Zero leads com gasto
- Tabela dividida em "Alertas Críticos" (vermelho) e "Avisos" (amarelo)
- Botões por alerta: **IA** (análise expandida com Gemini Flash), **Diag** (diagnóstico existente), **24h** (snooze)
- Modal de análise IA exibe: severidade, causa provável, tolerável (sim/não + justificativa), ação recomendada, urgência em horas, regras que dispararam
- Ações no modal: **Pausar via Meta API** (somente admin, com confirmação), **Ignorar** (registra em histórico), **Falso positivo** (registra + sugere ajuste de threshold)
- Após qualquer ação: envia WhatsApp de confirmação via Evolution API

**Tab Regras (somente admin):**
- Lista todas as regras de `trafego_regras_otimizacao`
- Cada regra exibe: nome, métrica, operador, threshold, ação sugerida, prioridade (P1/P2/P3)
- Toggle ativo/inativo por regra
- Badges: **Auto** (ação automática), **Alta efetividade** (taxa aplicação > 70% com ≥3 disparos), **Revisar** (taxa ignorada > 70%)
- Histórico: quantas vezes disparada, aplicada, ignorada, falso positivo
- Botão **"Nova regra"** → modal: nome, métrica (cpl/ctr/frequencia/cpc/roas/leads_dia/spend_dia), operador (≥/≤/>/</=), threshold, ação sugerida, prioridade, checkbox ação automática
- Seed padrão: CPL≥150 (pausar conjunto P3), CTR<1% (revisar copy P2), Freq≥3.5 (trocar criativo P2), Zero leads (pausar anúncio P3), ROAS<3 (revisar público P2)

**Tab Anomalias:**
- Feed de anomalias ativas (`resolvida = false`), ordenado por data DESC
- Badges por tipo com cor: gasto_zerado (vermelho), cpl_dobrou (laranja), leads_zerados (vermelho), spend_esgotando (amarelo), spend_sobrando (azul), performance_queda_brusca (laranja)
- Exibe causa provável, valores anterior/atual, data
- Botão **"Resolver"** por anomalia

#### 2.4.6 Ad Intelligence

- **Composite Score (0-100):** Qualificação 25% + Agendamento 30% + Fechamento 35% + Lead Score 10%
- **Status:** 🔴 Crítico / 🟡 Atenção / 🟢 Top Performer / ⚪ OK
- **4 tabs:** Criativos (ranking + funil expandível), Audiências, Alertas, Sugestões de investimento

#### 2.4.7 Biblioteca de Criativos

**Caminho:** Tráfego Pago → Criativos (`/trafego/criativos`)

**KPI Cards (4):**
- Total criativos ativos
- Score médio da biblioteca (0-10)
- Criativos em fadiga
- Melhor CPL (menor CPL histórico)

**Filtros:** cliente, tipo (vídeo/imagem/roteiro), status_veiculacao (ativo/pausado/fadigado/arquivado), fase ciclo vida (aquecimento/pico/estável/fadiga/encerrado).

**Grid de cards:**
- Ícone por tipo (Video/Image/FileText)
- Nome, cliente, nicho
- Score visual (barra 0-10 colorida: ≥7 verde, ≥4 amarelo, <4 vermelho)
- Fase do ciclo de vida (badge colorido)
- CPL, leads do período ativo
- Status de análise IA (badge: pendente/processando/concluído)
- Botão "Ver detalhes"

**Modal de detalhe (4 tabs):**

*Tab Métricas:*
- Score, fase, CPL atual em cards
- Gráfico de linha (Recharts): CPL mês a mês durante veiculação
- Histórico de fases (badges por mês)

*Tab Copy/Roteiro:*
- Exibe copy_texto, roteiro_texto ou transcricao_texto conforme tipo
- Se vídeo com transcricao_status='pendente': aviso amarelo
- Botão **"Analisar com IA"** → `POST /api/ia/analisar-criativo` (Claude Haiku)

*Tab Análise IA:*
- Pontos fortes (verde) / fracos (vermelho) em grid
- Gatilhos emocionais/racionais identificados (badges)
- Público provável, nicho jurídico
- Sugestões de copy versões A/B/C: headline, copy completo, justificativa, referência histórica
- Botão **"Copiar"** por sugestão (clipboard)
- Alerta compliance OAB (warning amarelo se presente)

*Tab Histórico:*
- Timeline vertical: criado, início veiculação, análise IA concluída, entrada em fadiga, fim veiculação

**Botão "Novo criativo":**
- Modal: nome*, cliente*, tipo*, nicho, ad_id (opcional para vincular ao Meta)
- Se tipo=imagem: campo de copy. Se tipo=roteiro: campo de roteiro. Se tipo=vídeo: upload futuro
- Ao salvar: se roteiro ou copy manual → `transcricao_status='manual'` + dispara análise IA automaticamente

**Regras:**
- Análise de vídeo requer `transcricao_status != 'pendente'`
- Criativos com `deleted_at` não aparecem (soft delete)
- Score de 0-10 calculado pela IA (Claude Haiku)
- Ciclo de vida calculado pelo job diário `/api/trafego/ciclo-vida-criativos`

#### 2.4.8 Performance Temporal

**Caminho:** Tráfego Pago → Temporal (`/trafego/performance-temporal`)

**Filtros:** cliente (dropdown), período (1M / 3M / 6M).

**Cards de insight automático (3):**
- **Melhor janela:** dia + hora com menor CPL médio (verde)
- **Pior janela:** dia + hora com maior CPL médio (vermelho)
- **Melhor qualificação:** dia + hora com maior taxa de qualificação (azul)

**Heatmap CPL (dia da semana × hora):**
- Eixo X: horas (0-23)
- Eixo Y: dias da semana (Dom-Sáb)
- Cor da célula: verde = CPL baixo, amarelo = médio, vermelho = alto, cinza = sem dados
- Número dentro da célula: total de leads
- Tooltip no hover: CPL, leads, spend, taxa qualificação
- Legenda de cores abaixo

**Gráfico de barras:** leads por dia da semana (Recharts BarChart, azul).

**Dados populados pelo job diário** `POST /api/trafego/performance-temporal` (05h, dias úteis). Agrega leads de `leads_crm` dos últimos 30 dias por `ghl_created_at` hora e dia_semana, cruza com spend de `ads_performance`.

#### 2.4.9 APIs de Tráfego Expandido

**IA:**
- `POST /api/ia/analisar-criativo` — Aceita `{criativo_id}`. Claude Haiku analisa copy jurídico. Retorna JSON: pontos_fortes, pontos_fracos, score 0-10, gatilhos, público, nicho, sugestões A/B/C, alerta compliance OAB. Salva em `trafego_criativos.analise_resultado`.
- `POST /api/ia/avaliar-alerta-trafego` — Aceita `{ad_id, adset_id, campaign_id, cliente_id, metrica, valor_atual}`. Gemini Flash avalia contra regras + histórico 7 dias. Retorna severidade, causa, tolerável, ação, urgência, regras aplicadas. Registra disparos em `trafego_regras_historico`.

**Meta API:**
- `POST /api/meta/pausar` — Somente admin. Aceita `{tipo: 'ad'|'adset'|'campaign', objeto_id, cliente_id}`. Pausa via Meta Graph API v21.0. Atualiza `ads_metadata.status`. Registra em histórico. Envia WhatsApp de confirmação.

**CRUD:**
- `GET/POST/PATCH /api/trafego/regras` — CRUD regras de otimização. GET inclui stats (aplicada/ignorada/disparada/falsa_positiva).
- `GET/PATCH /api/trafego/anomalias` — Lista (filtros: resolvida, ad_id, cliente_id) e resolve anomalias.
- `GET/POST /api/trafego/criativos` — Lista com métricas atuais. POST cria + auto-análise se copy/roteiro manual.

**Cron Jobs** (todos em `vercel.json`, protegidos por `CRON_SECRET`, dias úteis):
- `POST /api/trafego/verificar-regras` — Cada 2h (`0 */2 * * 1-5`). Para cada anúncio ativo com spend>0 últimas 24h: avalia regras configuradas, cria alertas, detecta 6 tipos de anomalia (gasto_zerado, cpl_dobrou, leads_zerados, spend_esgotando, spend_sobrando, performance_queda_brusca), pausa automaticamente se regra automática + severidade crítica. WhatsApp para gestor.
- `POST /api/trafego/ciclo-vida-criativos` — Diário 06h (`0 6 * * 1-5`). Para cada criativo com ad_id: calcula fase (aquecimento 1-7d, pico 8-21d CPL≤pico, estável, fadiga CPL>pico×1.2, encerrado 7d+ sem veiculação). Upsert métricas. Se fadiga: alerta + WhatsApp.
- `POST /api/trafego/performance-temporal` — Diário 05h (`0 5 * * 1-5`). Agrega leads por dia_semana × hora para cada cliente com meta_campaign_id. Calcula CPL, taxa qualificação, spend.

#### 2.4.10 Tabelas de Tráfego Expandido

**Schema** (migration `migration-trafego-modulo-expandido.sql`):

| Tabela | Chave | Descrição |
|--------|-------|-----------|
| `trafego_regras_otimizacao` | id uuid | Regras configuráveis: métrica + operador + threshold → ação. Ação automática opcional. Prioridade 1-3. |
| `trafego_regras_historico` | id uuid, FK regra_id | Log de disparos: acao = disparada/aplicada/ignorada/falsa_positiva. Valor da métrica no momento. |
| `trafego_criativos` | id uuid, FK cliente_id | Biblioteca: vídeo/imagem/roteiro. Copy, roteiro, transcrição. Análise IA (jsonb). Score 0-10. Ciclo vida. Soft delete. |
| `trafego_criativo_metricas` | id uuid, FK criativo_id | Métricas mensais: CPL, CTR, spend, leads, frequência, score, fase. UNIQUE (criativo, mês). |
| `trafego_anomalias` | id uuid | 6 tipos de anomalia detectadas automaticamente. Causa provável. Resolvida sim/não. |
| `trafego_performance_temporal` | id uuid, FK cliente_id | CPL por dia_semana (0-6) × hora (0-23). UNIQUE (cliente, dia, hora, mês). |

**Índices:** trafego_criativos.ad_id, trafego_criativos.cliente_id, trafego_regras_historico.regra_id, trafego_anomalias.cliente_id, trafego_performance_temporal.cliente_id.

---

### 2.5 PROJEÇÕES

#### 2.5.1 Projeção de Meta

**Caminho:** Projeções

- **Metas financeiras:** MRR, Faturamento/LTV mensal, Entrada mensal (formatação R$ automática)
- **Métricas do funil:** Toggle Histórico / Manual / Desativado
  - Base histórica: 1M, 3M, 6M ou 12M (seletor)
  - Métricas: Contratos, Ticket, Lead→Reunião, Reunião→Fechamento, No-show, CPL, CAC
- **Cálculo reverso:** Clientes → Reuniões → Leads → Budget
- **Funil visual:** Leads → Agendamentos → Reuniões → Clientes (com % entre etapas)

#### 2.5.2 Funil Inteligente

Tabela comparativa:

| Métrica | Atual (mês) | Necessário p/ Meta | Ref 3M | Ref 12M | Status |

- 9 linhas (Investimento, Leads, Reuniões, Contratos, CPL, Taxas, No-Show)
- Badge por linha: ✅ No ritmo / ⚠️ Acelerar X% / 🔴 Gap X%
- Projeção baseada em dias úteis passados/totais

#### 2.5.3 Sugestões de Ação

Geradas automaticamente por regras:
- Leads abaixo + CPL alto → "Aumentar orçamento 20-50%"
- Leads ok + reuniões baixas → "Revisar qualificação SDR"
- Reuniões ok + fechamento baixo → "Revisar pitch"
- No-show > 30% → "Confirmação 24h"
- CTR < 1% → "Testar novo criativo"
- Frequência > 3x → "Público saturado"

Cada sugestão: impacto (alto/médio/baixo), resultado estimado, botão "Marcar como aplicado"

#### 2.5.4 Otimizações de Custo

Calcula economia potencial por ponto de ineficiência:
- **No-Show:** Custo desperdiçado + ações (confirmação D-1, lembrete 2h)
- **Qualificação SDR:** Custo de leads não aproveitados
- **Ciclo de venda:** Gap custo agendamento vs realização

Total de economia potencial no topo. Botão "Implementar" por sugestão.

#### 2.5.5 Diagnóstico IA do Funil

- 3 cards colapsáveis: Diagnóstico / Risco Principal / Ações Prioritárias
- Seletor de IA (Claude, GPT-4o, Gemini, etc.)
- Cache em localStorage (mostra última análise enquanto carrega nova)
- Botão "Copiar análise" + "Atualizar"
- Salva automaticamente no Notion

#### 2.5.6 Evolução de Metas por Closer

**Caminho:** Projeções → Evolução de Metas

- Card por closer: gráfico 6 meses, tendência (↑→↓), meta atual vs sugerida
- **Regras:**
  - 3/3 meses bateu → +15%
  - 2/3 → +8%
  - 1/3 → manter
  - 0/3 → -10% com plano de melhoria
- Aprovar individual ou em lote. Input para meta manual

---

### 2.6 FINANCEIRO

#### 2.6.1 Metas e Bônus

Metas gerais + metas por closer. Campos de dinheiro com formatação R$.

#### 2.6.2 Entradas (Recebimentos)

**Caminho:** Financeiro → Entradas (`/recebimentos`)

Módulo completo de controle de receita e pagamentos de todos os clientes da agência.

**Seletor de ano:** Setas ← → para navegar entre anos (2025, 2026, 2027...).
**Seletor de mês:** Botão "Tudo" (agregado do ano) + Jan-Dez para navegar entre meses.

**KPI Cards (8-9 cards) — cada um com tooltip de info (ícone ℹ️ ao passar o mouse):**
- **Receita Confirmada:** Soma dos pagamentos confirmados (status pago) no mês. Comparativo com mês anterior.
- **Receita Pendente:** Valor total dos ativos recorrentes que passaram do vencimento sem pagar.
- **Clientes Ativos:** Total de clientes na casa (ativos + pagou integral + MDS + parcerias + pausados). Sub-info mostra quantos pagaram no mês.
- **Ticket Médio:** Valor mensal médio dos clientes ativos recorrentes (soma valores / qtd ativos).
- **Novos Clientes:** Clientes cujo mês de fechamento coincide com o mês selecionado.
- **Churn:** Total histórico de cancelamentos e receita perdida.
- **Inadimplentes:** Ativos recorrentes que passaram do vencimento sem pagar.
- **MRR Líquido:** Receita confirmada − receita perdida com churns.
- **LTV Médio (meses):** Média de permanência dos ativos recorrentes (quando disponível).

**Tabela de Clientes — dividida por seções:**
1. **Advogados** — clientes ativos recorrentes (categoria padrão)
2. **Pagou Integral** — com divisória azul. Detalhes de pagamento integral (valor total, forma, parcelas, MRR equivalente) aparecem ao expandir o cliente clicando na seta.
3. **Negócio Local** — clientes de negócio local
4. **MDS** — clientes MDS (R$500/mês cada, distribuídos a partir do agregado da Joyce)
5. **Parcerias** — clientes parceria (Frank Deering, Bacellar, Aquino). LTV atualizado automaticamente no dia de pagamento.
6. **Pausados** — seção colapsável
7. **Inativos/Churned** — seção colapsável, valor total exibido

**Colunas da tabela:**
- Cliente, Plat. (badge colorido), Valor, Closer, Contrato, Vence (dia), Status (dropdown), Pgto, Pago em, LTV, Ações

**Coluna "Pago em":**
- Mostra "dia X" quando pagamento foi no mesmo mês de referência
- Mostra "X/MM" (dia/mês) quando pagamento foi em mês diferente (ex: pagou março em fevereiro → "28/02")

**Coluna LTV:**
- Mostra LTV individual de cada cliente em meses (ex: "12m", "3m")
- Ordenável. Dados sincronizados da planilha Excel.

**Status financeiro (dropdown clicável):**
- Ativo, Pausado, Pagou Integral, Parceria
- Churned: NÃO aparece no dropdown — só via pipeline de churn (botão ☠️ nas ações)

**Marcar como Pago/Perdoado:**
- Botão ✓ nas ações abre modal
- Dois modos: **Pago** (verde, com valor) e **Perdoado** (roxo, sem valor)
- Perdoado: campo de **justificativa** obrigatório (ex: "cortesia", "acordo")
- Justificativa fica visível no tooltip do badge "Perdoado *" e ao expandir o cliente
- Campo de **mês do pagamento**: permite registrar que o pagamento foi feito em mês diferente
- LTV incrementado automaticamente ao confirmar pagamento

**Churn integrado:**
- Botão de churn nas ações → modal com seleção de motivo e observação
- Atualiza simultaneamente: clientes_receita (marca churned) + tabela clientes (pipeline de churn)

**Expand do cliente (seta ►):**
- Timeline visual: 12 meses (Jan-Dez) com ícones por status (✓ pago, ♥ perdoado, 🤝 parceria, ⚠ atrasado, ⏳ pendente)
- Total pago no ano, meses pagos, inadimplência
- Para pagou integral: card azul com valor total, forma de pagamento, parcelas e MRR equivalente
- Para perdoado: card roxo com justificativa do perdão

**Filtros:**
- Status do pagamento: Todos / Pago / Pendente / Atrasado
- Closer (dropdown)
- Busca por nome

**Inadimplentes (abaixo da tabela):**
- Lista de clientes ativos com pagamento atrasado
- Botão direto "Marcar Pago" para cada inadimplente

**Exportar CSV:** Botão no header exporta todos os clientes do mês.

**Novo Cliente:** Botão "+ Novo Cliente" abre modal de cadastro.

**Atualização sem reload:** Todas as ações (pagar, editar, mudar status, churnar) atualizam a tabela automaticamente sem recarregar a página.

#### 2.6.3 Lançamento Diário

Closer + data + reuniões + contratos. MRR e LTV calculados.

#### 2.6.4 Contratos

Tabela editável: cliente, closer, SDR, origem, entrada, MRR, meses, total.

#### 2.6.5 Painel Financeiro (Módulo Expandido)

**Caminho:** Financeiro → Painel Financeiro (`/financeiro`)

Visão completa do módulo financeiro com 6 seções integradas. **Somente admin.**

**KPI Cards (5 no topo):**
- **MRR Atual:** soma de `valor_mensal` dos clientes ativos em `clientes_receita`. Com variação % vs mês anterior.
- **Crescimento MoM:** variação percentual do MRR em relação ao mês anterior.
- **Crescimento Anual (YoY):** variação percentual em relação ao mesmo mês do ano anterior.
- **Lucro Líquido:** receita confirmada do mês - total de despesas. Com variação % vs mês anterior.
- **Crescimento Lucro MoM:** variação percentual do lucro vs mês anterior.

**Seção Fluxo de Caixa Projetado:**
- Toggle: Otimista | Realista | Pessimista
- Gráfico de barras (Recharts): próximos 3 meses com Receita, Custos, Resultado
- Card de impacto de churn: valor total em risco + quantidade de clientes em risco
- Detalhamento expansível: lista de clientes risco alto (vermelho) e médio (amarelo)
- Dados calculados pelo cron `POST /api/financeiro/projecao-fluxo` (dia 1 às 08h)
- Cenários:
  - **Otimista:** MRR integral, custos médios 3 meses, churn_impacto = 0
  - **Realista:** MRR - 50% dos médios - 100% dos altos, custos iguais
  - **Pessimista:** MRR - todos em risco - inadimplência histórica, custos + 10% buffer

**Seção Margem por Cliente:**
- Tabela: Cliente | Receita | Custo Mídia | Custo Gestor | Margem Bruta | Margem Líquida | Margem %
- Ordenada por margem % ASC (piores margens primeiro)
- Badge vermelho se margem < 30%, amarelo se < 50%, verde se >= 50%
- Dados calculados pelo cron `POST /api/financeiro/calcular-margem` (segunda 09h)
- custo_midia: spend Meta Ads via API direta (`/api/meta-spend` com campaign_id)
- custo_gestor: salário_base do gestor (compensation_config) / nº clientes ativos do gestor

**Seção Comissões:**
- Card por closer/SDR: salário base, OTE, comissão acumulada, % OTE atingido
- Barra de progresso do OTE (verde >= 80%, amarelo >= 50%, vermelho < 50%)
- Total de comissões a pagar no mês
- Projeção: se mantiver ritmo atual, fecha em X% da meta
- Usa `calculateCompensation()` de `src/lib/commission.ts`

**Seção Asaas — Cobranças:**
- Tabela: Cliente | Descrição | Valor | Vencimento | Status | Match | Ações
- Filtros: dropdown de status (pending/received/confirmed/overdue/refunded) e match_status
- Badge de pendentes de aprovação no header da seção
- Botão "Nova Cobrança" → modal (somente admin):
  - Campos: descrição, valor (CurrencyInput), tipo (boleto/pix/cartão/outros), data vencimento, cliente ID
  - Cria com `aprovacao_criacao_status = 'aguardando'` — NÃO cria no Asaas ainda
- Botões "Aprovar criação" e "Reprovar" por linha (admin)
  - Aprovar: chama API Asaas POST /payments, salva asaas_id
- Botões "Confirmar recebimento" e "Reprovar" por linha (admin)
  - Confirmar: atualiza status = 'confirmed', dispara conciliação automática
- Fila "Sem Match": pagamentos com match_status = 'sem_match', botão conciliação manual
- Trilha de auditoria expansível por pagamento (ícone documento)

**Conciliação automática** (`src/lib/asaas-conciliacao.ts`):
- Match por descrição normalizada (lowercase, sem acentos, sem sufixos como ltda/me/eireli)
- Tenta match em `clientes` (ativos) e `clientes_receita`
- Se match: atualiza cliente_id, contrato_id, match_status = 'conciliado_auto'
- Se sem match após 3 tentativas: match_status = 'sem_match', fila para admin
- Disparada após: sync de pagamentos e aprovação de recebimento

**Exportar para Contador:**
- Modal com seleção de mês e formato (CSV | PDF)
- CSV: receitas linha a linha, despesas, folha, resultado líquido, margem por cliente
- Salva registro em `financeiro_exportacoes`
- Somente admin

**Cron Jobs Financeiros** (em `vercel.json`):
- `POST /api/financeiro/alertas-cobranca` — dia 1 às 10h: alerta clientes sem cobrança + WhatsApp
- `POST /api/financeiro/calcular-margem` — segunda às 09h: calcula margem por cliente
- `POST /api/financeiro/projecao-fluxo` — dia 1 às 08h: projeção 3 cenários × 3 meses
- `POST /api/asaas/sync` — dias úteis às 07h: sincroniza pagamentos dos últimos 30 dias

**Regras de negócio:**
- Dupla verificação obrigatória: nenhuma cobrança criada no Asaas sem `aprovacao_criacao_status = 'aprovado'`
- Nenhum recebimento confirmado sem `aprovacao_recebimento_status = 'aprovado'`
- Toda aprovação registrada em `asaas_auditoria` com `ip_sessao`
- custo_midia SEMPRE via Meta API direta (nunca n8n sync)
- Jobs não executam sábado/domingo
- Soft delete em todas as tabelas

**Tabelas:**
- `asaas_pagamentos` — cobranças com dupla verificação
- `asaas_auditoria` — trilha de auditoria
- `financeiro_fluxo_caixa` — projeção (UNIQUE mes_referencia + cenario)
- `financeiro_margem_cliente` — margem (UNIQUE cliente_id + mes_referencia)
- `financeiro_exportacoes` — registro de exportações

**Variáveis de ambiente:**
- `ASAAS_API_KEY` — chave API Asaas (header `access_token`)
- `ASAAS_ENVIRONMENT` — `production` ou `sandbox`
- `ASAAS_WEBHOOK_TOKEN` — validar webhooks Asaas
- `ADMIN_WHATSAPP` — WhatsApp do admin para alertas (formato: 5511999998888)

---

### 2.7 CONFIGURAÇÕES

#### 2.7.1 Configurações Gerais

Leads totais, investimento, closers/SDRs ativos, senha do portal.

#### 2.7.2 Integrações

Chaves de API + status de conexão de cada IA.

#### 2.7.3 Alertas

Thresholds por área — 4 seções colapsáveis:
- **Comercial:** No-Show limite, ROAS mínimo, Resultado mínimo
- **Tráfego:** CPL máximo, CTR mínimo, Frequência, Zero leads
- **SDR:** Qualificação mínima, Desqualificação máxima, Leads parados
- **Funil/CRM:** Lead inativo, Ciclo máximo

#### 2.7.4 Erros n8n

Log de erros dos workflows. Filtro: Pendentes / Todos / Resolvidos.

#### 2.7.5 FAQ

Este documento, acessível direto na dashboard.

#### 2.7.6 Integrações e Status das APIs

**Caminho:** Configurações → Integrações (`/config/integracoes`)

Painel de configuração de todas as chaves de API e verificação de status em tempo real.

**Botão "Verificar Agora":** Testa TODAS as APIs em paralelo e mostra:
- Nome da API, status (verde/vermelho), mensagem, tempo de resposta (ms)
- **Meta Ads:** validade exata do token (dias restantes + data de expiração). Alerta vermelho se expirado ou < 7 dias.
- APIs verificadas: Supabase, Meta Ads, GoHighLevel, Anthropic (Claude), OpenAI, Google Gemini, Notion

**Configuração de chaves:** Todos os campos de API keys, IDs e URLs organizados por integração. Exportar como .env.local ou JSON.

**Asaas (💳):** Seção dedicada com:
- `ASAAS_API_KEY` — chave da API (Minha Conta → Integrações → API)
- `ASAAS_ENVIRONMENT` — `production` ou `sandbox`
- `ASAAS_WEBHOOK_TOKEN` — validação de webhooks recebidos
- `ADMIN_WHATSAPP` — número do admin para alertas de cobrança

#### 2.7.7 Permissoes por Cargo

**Caminho:** Configurações → Permissões (`/config/permissoes`)

Tabela de visibilidade: define quais áreas do sistema cada cargo pode acessar.
- Linhas: 21 áreas do sistema (Dashboard, CRM, Tráfego, Financeiro, etc.)
- Colunas: Admin, Closer, SDR
- Admin: sempre acesso total (não editável)
- Closer/SDR: checkboxes individuais para cada área
- Botões: "Marcar tudo" / "Desmarcar tudo" por cargo
- "Padrão": restaura configuração pré-definida
- Salva em localStorage (config persistente por navegador)

---

### 2.8 CUSTOS DA AGÊNCIA

**Caminho:** Financeiro → Custos da Agência (`/financeiro/custos`)

Controle completo de despesas operacionais (exceto Ads, que vem da Meta API).

**KPIs:** Total Custos, Folha Total, Custos Fixos, Parcelamentos Ativos (com variação % vs mês anterior)

**Tabela Custos por Categoria (agrupada):** Categorias organizadas em 5 grupos colapsáveis com subtotal por grupo. Clique no grupo para expandir/colapsar. Highlight vermelho se > 130% da média, verde se < 70%. Clique na célula abre detalhes.

| Grupo | Categorias |
|-------|-----------|
| Pessoas | Equipe Operacional, Equipe Comercial, Equipe de MKT, Prolabore, Comissões, Bonificações |
| Infraestrutura | Aluguel, Energia, Internet, Limpeza, Telefone, Manutenção |
| Ferramentas & Serviços | Ferramentas/Softwares, Mentoria, Contador, Cursos e Treinamentos |
| Investimentos | Equipamento, Obra, Investimentos, Audiovisual |
| Outros | Comemoração, Eventos/Viagens, Imposto, Mercado, Prejuízo, Outros |

**Gráfico Evolução:** BarChart empilhado (Pessoas, Infraestrutura, Ferramentas, Investimentos, Outros)

**Lançamento:** Formulário inline (data, descrição, conta, categoria, valor, parcelamento). Tabela dos últimos 20 lançamentos com soft delete.

**29 categorias:** Ads (excluído dos totais), Aluguel, Audiovisual, Bonificações, Comemoração, Comissões, Contador, Cursos, Energia, Equipamento, Equipe Comercial/Operacional/MKT, Eventos, Ferramentas, Imposto, Internet, Investimentos, Limpeza, Manutenção, Mentoria, Mercado, Obra, Outros, Prejuízo, Prolabore, Telefone.

**6 contas:** Nu PJ, BB, Nu LU, American, Mercado Pago, Outro.

**Integração Dashboard:** Cards "Custos Operacionais" e "Margem Operacional" na visão geral. Alerta de Burn Rate quando custos > 85% da receita.

**Importação:** Script `npx tsx scripts/seed-despesas.ts <arquivo.xlsx>` para importar despesas históricas do Excel (aba "Lançamento de despesa").

---

### 2.9 TAREFAS INTERNAS

**Caminho:** Portal → Tarefas (`/portal/tarefas`)

Kanban com 3 colunas: Pendente → Em Andamento → Concluída.

**Cards:** Título, badge de prioridade (baixa/média/alta/urgente), tipo (lançamento/follow up/confirmar reunião/proposta/interno/outro), prazo com cor (verde/amarelo/vermelho), tempo de execução ao vivo, quem criou → quem vai fazer.

**Ações:** Avançar status, ver detalhes, comentários.

**Modal de criação:** Título, descrição, atribuir para (closers + SDRs), tipo, prioridade, prazo.

**Filtros:** Minhas tarefas / Criadas por mim / Todas.

**Timestamps automáticos:** iniciado_em quando muda para em_andamento, concluido_em quando conclui.

**Banner lançamento diário:** Aparece no topo do portal em dias úteis se o colaborador não fez lançamento do dia. Banner amarelo "Lançar agora" ou badge verde "Lançamento feito".

---

### 2.10 TELA TV (Display)

**Caminho:** `/tv` — acesso público (sem login), pensada para tela cheia numa TV

**3 visualizações** (botões Tudo / Metas / Ranking):

**Metas:**
- 3 gauges semicírculo (meia lua): Entrada (Faturamento), MRR, Contratos — cada um mostra valor atual, % da meta e meta total
- Gráfico de progresso acumulado no mês (linhas MRR + Contratos dia a dia)

**Ranking:**
- Ranking de closers com medalhas (🥇🥈🥉)
- Por closer: contratos, MRR, entrada, reuniões, conversão, barra de meta
- Totais da equipe no header

**Tudo:** Gauges + progresso + ranking juntos

Relógio em tempo real. Auto-refresh a cada 5 minutos. Fundo preto otimizado para display.

---

### 2.11 SINCRONIZAÇÃO MANUAL

**Botão "Atualizar Dados"** presente em Dashboard, Tráfego Pago e CRM.

Ao clicar, dispara sincronização real:
- **Dashboard:** puxa oportunidades do GHL (todos os pipelines exceto Social Selling) + dados dos últimos 7 dias do Meta Ads
- **Tráfego Pago:** sincroniza Meta Ads
- **CRM:** sincroniza oportunidades do GHL

Toast mostra resultado: "GHL: X oportunidades sincronizadas" / "Meta Ads: últimos 7 dias atualizados"

API: `POST /api/sync?source=meta|ghl|all`

---

### 2.12 EQUIPE (Gestão de Colaboradores)

**Caminho:** Equipe (`/equipe`) — apenas Admin

#### 2.8.1 Lista de Colaboradores

- Cards agrupados por cargo: Administradores, Closers, SDRs
- Resumo: qtd closers ativos, SDRs ativos, total
- Filtro: Ativos / Todos / Inativos (arquivados)
- Ações por colaborador: Ver detalhes, Editar, Arquivar/Reativar
- **Novo Colaborador:** cria automaticamente o registro na tabela `closers` ou `sdrs` + `employees`

#### 2.8.2 Perfil Individual (`/equipe/[id]`)

**Aba Compensação:**
- KPIs em tempo real: comissão calculada, bônus, contratos, total bruto
- Seletor de mês (Jan-Dez)
- Formulário completo de configuração:
  - Salário base, Comissão % e base de cálculo (MRR, Valor Total ou Valor Entrada)
  - Bônus por meta atingida + % extra para meta superada
  - OTE (On-Target Earnings)
  - Benefícios: VA, VT, outros + descrição
- Salva por mês (permite configurar compensação diferente a cada mês)

**Aba Notificar:**
- Enviar notificação direta para o colaborador (título + mensagem)

#### 2.8.3 Editar Colaborador (modal)

- Nome, usuário, senha, cargo, telefone, data de admissão
- Alterar cargo: closer → sdr → admin
- **Campo Senha**: input com botão **olho** para mostrar/ocultar (default oculto) + botão de copiar quando há valor. A senha cadastrada é carregada da coluna `employees.senha_visivel` (ver migration `migration-employees-senha-visivel.sql`). O login usa SHA-256 (`senha_hash`) — `senha_visivel` é só para o admin conseguir visualizar/compartilhar quando o colaborador esquece.
- **Para usuários antigos** criados antes da migration: `senha_visivel` é null, então o admin precisa abrir o modal e definir uma senha nova uma vez.

#### 2.8.4 ⚠️ Importante: cadastro de login

**Login só funciona via tabela `employees`**, não via `closers` ou `sdrs`.

A página `/closers` (e o equivalente para SDRs) só insere na tabela `closers`/`sdrs`, sem criar a row em `employees` — o colaborador não vai conseguir logar.

**Caminho correto** para criar login: `/equipe` → botão "Novo" → escolher cargo (Closer/SDR/Admin). A API `/api/employees` cria automaticamente: (1) row em `employees` com `senha_hash` + `senha_visivel`, (2) row em `closers` ou `sdrs` ligada via `entity_id`.

---

### 2.9 PORTAL DO COLABORADOR

**Caminho:** `/portal` (login) → `/portal/painel` (closer) ou `/portal/painel-sdr` (SDR)

#### 2.9.1 Controle de Acesso

3 níveis de acesso com middleware de proteção:
- **Admin:** acessa tudo (dashboard completa + portal de qualquer colaborador)
- **Closer:** acessa apenas `/portal/*` (painel pessoal, leads, salário, notificações, perfil)
- **SDR:** acessa apenas `/portal/*` (painel SDR, pipeline, salário, notificações, perfil)

Login via `/portal` com usuário e senha. JWT em cookie HTTP-only (7 dias). Rotas admin bloqueadas para closer/SDR via middleware.

#### 2.9.2 Portal do Closer (`/portal/painel`)

- KPIs: Contratos, MRR, Reuniões Feitas, Taxa de Conversão
- Gauges de meta (MRR e LTV vs meta mensal)
- Lançamento diário (reuniões agendadas/feitas)
- Histórico do mês

#### 2.9.3 Portal do SDR (`/portal/painel-sdr`)

- KPIs: Leads Recebidos, Contatos, Reuniões Agendadas, Taxa Agendamento
- Barras de progresso vs metas (contatos, conexões, reuniões)
- Lançamento diário
- Histórico do mês

#### 2.9.4 Meus Leads (`/portal/meus-leads`)

CRM filtrado por closer_id. Mostra apenas leads atribuídos ao closer logado.
- Filtro por etapa + busca por nome
- Resumo: ativos, fechados, MRR fechado
- Expand com detalhes (telefone, email, canal, área, reunião, LTV)

#### 2.9.5 Meu Pipeline (`/portal/meus-leads-sdr`)

Leads filtrados por sdr_id. Mostra pipeline do SDR logado.
- Resumo: total, agendadas, feitas
- Busca + expand com detalhes e closer atribuído

#### 2.9.6 Salário e Comissão (`/portal/salario`)

- Barra de progresso OTE (On-Target Earnings)
- 4 cards: Salário Base, Comissão (tempo real), Bônus, Benefícios
- Total Bruto
- Detalhamento: % comissão, base de cálculo, contratos, meta atingida, VA, VT, outros
- Seletor de mês
- Comissão calculada em tempo real baseada nos contratos/reuniões do mês

#### 2.9.7 Notificações (`/portal/notificacoes`)

- Sino no header com badge de não lidas (polling 30s)
- Dropdown com últimas 5 notificações
- Página completa com filtro (Todas / Não lidas)
- Marcar como lida individual ou todas
- Tipos: lead atribuído, contrato fechado, meta atingida, mensagem do admin, pagamento aprovado

**Notificações automáticas (triggers no banco):**
- Lead atribuído a um closer → notificação automática
- Contrato fechado → notificação automática para o closer

#### 2.9.8 Equipe no Portal (`/portal/equipe`)

Métricas agregadas da equipe sem expor dados individuais de outros:
- Total reuniões feitas vs meta (barra de progresso)
- Total contratos vs meta
- Taxa de conversão média da equipe
- Ranking do colaborador logado ("Você está em Xº lugar") sem mostrar nomes/valores dos outros
- Gráfico de evolução semanal da equipe (reuniões e contratos agregados)

#### 2.9.9 Meu Perfil (`/portal/meu-perfil`)

- Dados pessoais: nome, cargo, usuário, telefone, data admissão
- Editar telefone
- Alterar senha (valida senha atual)

#### 2.9.9 Layout Mobile

- Top bar: nome + cargo + sino de notificações + botão sair
- Bottom nav (mobile): 5 abas (Painel, Leads/Pipeline, Salário, Alertas, Perfil)
- Desktop: tabs horizontais
- Responsivo para uso no celular

---

### 2.10 VISIBILIDADE POR CARGO

| Área | Admin | Closer | SDR |
|------|-------|--------|-----|
| Dashboard geral | ✅ | ❌ | ❌ |
| CRM completo | ✅ | ❌ | ❌ |
| Financeiro (entradas, DRE, custos) | ✅ | ❌ | ❌ |
| Tráfego Pago | ✅ | ❌ | ❌ |
| Projeções | ✅ | ❌ | ❌ |
| Configurações | ✅ | ❌ | ❌ |
| Equipe (gestão) | ✅ | ❌ | ❌ |
| Portal pessoal | ✅ (qualquer) | ✅ (próprio) | ✅ (próprio) |
| Meus leads/pipeline | — | ✅ | ✅ |
| Salário/comissão | ✅ (todos) | ✅ (próprio) | ✅ (próprio) |
| Notificações | ✅ (todas) | ✅ (próprias) | ✅ (próprias) |

---

## 3. GLOSSÁRIO

| Termo | Significado |
|-------|-------------|
| **MRR** | Monthly Recurring Revenue — receita mensal recorrente |
| **LTV** | Lifetime Value — valor total do contrato (MRR × meses) |
| **CAC** | Customer Acquisition Cost — investimento / contratos |
| **CPL** | Cost Per Lead — investimento / leads |
| **CPRF** | Custo Por Reunião Feita — investimento / reuniões realizadas |
| **ROAS** | Return On Ad Spend — LTV / investimento |
| **No-Show** | Lead que agendou reunião mas não compareceu |
| **Closer** | Vendedor que conduz a reunião de fechamento |
| **SDR** | Sales Development Representative — qualifica leads |
| **GHL** | GoHighLevel — CRM de pipeline |
| **Hook Rate** | % de cliques/visualizações após ver anúncio |
| **Composite Score** | Nota 0-100 combinando qualificação + agendamento + fechamento |
| **Ticket Médio** | MRR médio por contrato |
| **Churn Rate** | % de cancelamentos sobre base ativa |
| **Pagou Integral** | Cliente que pagou todo o contrato antecipadamente |
| **Perdoado** | Mês de pagamento dispensado (com justificativa) |
| **MDS** | Clientes de marketing digital simples — R$500/mês |
| **Parceria** | Cliente parceiro sem cobrança, mas com LTV automático |
| **Status Financeiro** | ativo, pausado, pagou_integral, parceria, churned |
| **OTE** | On-Target Earnings — remuneração esperada quando 100% da meta é atingida |
| **RBAC** | Role-Based Access Control — controle de acesso por cargo |
| **Etapa Frio** | Lead arquivado — oportunidade inativa > 30 dias |

---

## 4. PERGUNTAS FREQUENTES

### 4.1 Dados e Precisão

**Os números do Meta batem com o Gerenciador de Anúncios?**
Sim. A dashboard chama a API do Meta diretamente (`/api/meta-spend`). Não depende só do n8n.

**Como o CPL é calculado?**
Total Investido / Total de Leads (média ponderada). Não é média simples das campanhas.

**Como funciona o ROAS?**
ROAS = LTV Total / Investimento Total. Usa LTV (valor total), não MRR mensal.

**O investimento inclui anúncios pausados?**
Sim. O spend total inclui todos os anúncios que gastaram no período, independente do status atual.

### 4.2 Alertas e Comportamento

**Por que não tem alerta no fim de semana?**
Projeção de contratos, meta diária e alerta de lançamento SDR só aparecem em dias úteis (seg-sex). Em fins de semana, exibem informação neutra sem urgência.

**Como mudar os thresholds dos alertas?**
Configurações → Alertas. 4 áreas com thresholds editáveis + reset para padrão.

### 4.3 CRM e Leads

**O que é o "Resultado do Time"?**
MRR + Entradas - Comissões (10%) - Investimento. Lucro operacional.

**Por que leads "Frio" não aparecem no Dashboard?**
São arquivados. Para reativar, mude a etapa no CRM.

**O que acontece quando mudo lead para "Comprou"?**
Contrato é criado automaticamente com os dados do lead.

**O que acontece quando lead muda de etapa no GHL?**
Trigger `trg_preserve_mes_referencia` garante que o mês original não é sobrescrito.

### 4.4 Projeções

**Como calcula o investimento necessário?**
Menor entre (leads × CPL) e (clientes × CAC). CAC vem do histórico real.

**O que é o Funil Inteligente?**
Tabela que compara Atual × Necessário × Referência 3M × Referência 12M com status por linha.

### 4.5 Financeiro e Asaas

**Como configurar o Asaas?**
Configurações → Integrações → seção Asaas (💳). Preencher `ASAAS_API_KEY` (obrigatório), `ASAAS_ENVIRONMENT` (production/sandbox), `ASAAS_WEBHOOK_TOKEN` (opcional) e `ADMIN_WHATSAPP`. Adicionar as mesmas variáveis na Vercel.

**Como criar uma cobrança?**
Financeiro → Painel Financeiro → botão "Nova Cobrança". A cobrança fica aguardando aprovação — NÃO é criada no Asaas até um admin aprovar.

**Como aprovar uma cobrança?**
Na tabela de cobranças Asaas, clicar em "Aprovar" na linha do pagamento. Isso cria a cobrança real no Asaas e registra a ação na auditoria.

**Como funciona a conciliação automática?**
Após sync ou aprovação de recebimento, o sistema tenta vincular o pagamento a um cliente por nome normalizado (sem acentos, lowercase). Após 3 tentativas sem match, vai para fila "Sem Match" para conciliação manual.

**Como exportar dados para o contador?**
Financeiro → Painel Financeiro → botão "Exportar" → selecionar mês e formato (CSV ou PDF).

**O que é a margem por cliente?**
Receita do contrato - custo mídia (Meta API direta) - custo do gestor (salário / nº clientes). Calculada automaticamente toda segunda-feira.

**O que são os cenários de fluxo de caixa?**
Projeção para os próximos 3 meses. Otimista (sem churn), Realista (desconta risco médio/alto), Pessimista (desconta todos os riscos + inadimplência + 10% buffer custos).

### 4.6 Integrações

**Os relatórios de IA são salvos?**
Sim, automaticamente no Notion. Cada análise vira uma página formatada.

**O n8n parou. Como sei?**
Configurações → Erros n8n. O Error Handler global captura todos os erros.

**Como adicionar um closer?**
Equipe → Novo → preencher nome, usuário, senha, cargo "Closer". Cria automaticamente na tabela closers + employees.

**Como configurar salário e comissão?**
Equipe → clicar no colaborador → aba Compensação → definir salário base, % comissão, bônus, OTE, benefícios. Salvar por mês.

**Como enviar notificação para um colaborador?**
Equipe → clicar no colaborador → aba Notificar → título + mensagem → Enviar.

**Como arquivar um colaborador?**
Equipe → botão de arquivo (ícone) ao lado do colaborador. Pode reativar a qualquer momento.

---

## 5. AUTOMAÇÕES (N8N)

| Workflow | Frequência | Função |
|----------|------------|--------|
| **Meta Ads → Dashboard** | 2h | Sync últimos 7 dias do Meta para Supabase |
| **GHL → CRM** | Webhook | Lead entra no GHL → cria/atualiza no Supabase |
| **GHL Funnel → Supabase** | 4h | Sync funil SDR e closers do GHL |
| **Error Handler** | Automático | Captura erros de todos os workflows |

---

## 6. BANCO DE DADOS (SUPABASE)

### 6.1 Tabelas principais

| Tabela | Função |
|--------|--------|
| `leads_crm` | Leads com etapas e dados completos |
| `leads_crm_historico` | Log de mudanças de etapa |
| `lancamentos_diarios` | Lançamentos diários dos closers |
| `contratos` | Contratos fechados |
| `config_mensal` | Config mensal (leads, investimento) |

### 6.2 Metas

| Tabela | Função |
|--------|--------|
| `metas_mensais` | Metas gerais do mês |
| `metas_closers` | Metas por closer |
| `metas_sdr` | Metas do SDR |

### 6.3 Time e Colaboradores

| Tabela | Função |
|--------|--------|
| `closers` | Cadastro de closers (nome, ativo, metas) |
| `sdrs` | Cadastro de SDRs |
| `employees` | Colaboradores unificados: auth (usuario, senha_hash), role (admin/closer/sdr), entity_id (link para closers/sdrs), dados pessoais |
| `compensation_config` | Configuração de compensação por colaborador/mês: salário, comissão %, bônus, OTE, benefícios |
| `payment_history` | Histórico de pagamentos: salário + comissão + bônus + benefícios - descontos = total |
| `notifications` | Notificações: tipo, título, mensagem, lida, metadata. Triggers automáticos para lead atribuído e contrato fechado |

### 6.4 Tráfego Pago

| Tabela | Função |
|--------|--------|
| `ads_performance` | Performance diária dos anúncios (do Meta) |
| `ads_metadata` | Metadados (nome, campanha, conjunto, status) |
| `leads_ads_attribution` | Atribuição lead → anúncio |
| `creative_scores` | Scores de criativos (Ad Intelligence) |
| `audience_performance` | Performance por audiência |
| `lead_funnel_events` | Eventos do funil por lead |

### 6.5 Integrações

| Tabela | Função |
|--------|--------|
| `ghl_funnel_snapshot` | Snapshot do funil GHL |
| `ghl_sdr_alerts` | Alertas SDR do GHL |
| `n8n_error_log` | Erros dos workflows |
| `alertas_snooze` | Alertas silenciados |

---

### 6.6 Clientes

| Tabela | Função |
|--------|--------|
| `clientes` | Base de clientes do **pipeline de churn** (status ativo/cancelado/pausado, MRR, data_cancelamento). NÃO é a fonte da página `/dashboard/clientes`. |
| `clientes_receita` | **Fonte única da Entrada** (formulário financeiro). Trigger `entrada_to_clientes_mirror` cria/linka uma row em `clientes_notion_mirror` toda vez que uma entrada é criada ou reativada. |
| `clientes_notion_mirror` | Armazenamento local dos campos editáveis do dashboard de clientes (status, situacao, resultados, atencao, analista, etc). Coluna `entrada_id` (FK para `clientes_receita.id`) liga ao registro da Entrada. `notion_id` continua como ID interno (rows criadas via trigger usam `local_<uuid>`). |
| `clientes_extra` | Dados complementares por notion_id: meta_account_id, google_customer_id, whatsapp_resumo, briefing (jsonb), ultima_verificacao, ultima_analise_ia. *Colunas `saude_*` ainda existem mas a UI foi removida (substituída por Teses).* |
| `clientes_teses` | Teses do cliente. Campos: `nome_tese`, `tipo` (Área do Direito), `publico_alvo`, `status` (Ativa/Pausada/Em Teste), `data_ativacao`, `observacoes`, `orcamento`, `deleted_at` (soft delete). Soma de orçamento substitui o orçamento principal do cliente. |
| `clientes_crm_config` | Configuração CRM por cliente: `cliente_id` (notion_id), `ghl_subaccount_id`, `ghl_pipeline_id`, `stage_mapping` JSONB (etapa GHL → status interno), `conexao_ativa`, `last_test_at`, `last_test_result`, `last_sync_at`, `deleted_at`. |
| `otimizacoes_historico` | Otimizações editáveis: comentarios, feito, proxima_vez, solicitado, `data_confirmacao`, `snapshot_metricas` JSONB (cpl/roas/leads/spend/historico capturados no momento da confirmação), `deleted_at` (soft delete). |
| `pagamentos_mensais` | Pagamentos por mês: cliente_id, mes_referencia, valor_pago, dia_pagamento, status (pago/pendente/perdoado/parceria), justificativa, mes_pagamento. Unique: (cliente_id, mes_referencia) |
| `custos_operacionais` | Custos operacionais (DRE) |
| `custos_fixos_recorrentes` | Custos fixos recorrentes |
| `vw_churn_mensal` | View calculada: churn rate e MRR churn por mês |
| `asaas_pagamentos` | Cobranças do Asaas com dupla verificação (aprovação criação + recebimento), conciliação automática, soft delete |
| `asaas_auditoria` | Trilha de auditoria de ações sobre pagamentos (criação, aprovação, conciliação, etc.) com ip_sessao |
| `financeiro_fluxo_caixa` | Projeção de fluxo de caixa — 3 cenários (otimista/realista/pessimista) × 3 meses. UNIQUE (mes_referencia, cenario) |
| `financeiro_margem_cliente` | Margem por cliente: receita, custo_midia, custo_gestor, margem_bruta, margem_liquida, margem_pct. UNIQUE (cliente_id, mes_referencia) |
| `financeiro_exportacoes` | Registro de exportações CSV/PDF para contador com gerado_por e tipo |

---

---

## 7. PORTAL DE CLIENTES (Supabase)

### 7.1 Arquitetura

- **Fonte única da lista**: `clientes_receita` (formulário "Entrada" do financeiro). Trigger SQL `entrada_to_clientes_mirror` cria/linka automaticamente uma row em `clientes_notion_mirror` para cada nova entrada (status inicial `'Não iniciado'`). Reativação (`status_financeiro` ≠ ativo → ativo) reseta status para `'Não iniciado'`.
- **`clientes_notion_mirror`** virou armazenamento local — não é mais espelho do Notion para a página /clientes. Quando o Notion for desligado, nada quebra: novas rows são geradas com `notion_id='local_<uuid>'`.
- **Sync legado do Notion** (`/api/mirror/sync`) ainda existe e é compatível, mas a página `/dashboard/clientes` não depende dele.
- **API principal**: `GET /api/dashboard/clientes` itera `clientes_receita` (operacional: ativo/pausado/pagou_integral/parceria) e enriquece cada cliente com dados de mirror, teses, otimizações, fechamento (SDR/Closer da tabela `contratos`) e CRM config. PATCH grava direto na mirror local (sem escrever no Notion).
- **Outras páginas** (`/churn`, `/financeiro`, `/onboarding`) continuam usando suas próprias tabelas e não foram afetadas.

### 7.2 Tabelas Supabase relacionadas

| Tabela | Função |
|--------|--------|
| `clientes_notion_mirror` | Estado editável local dos clientes (status, situacao, resultados, atencao, analista, etc). FK `entrada_id → clientes_receita.id`. |
| `clientes_extra` | Dados complementares por notion_id: meta_account_id, google_customer_id, whatsapp_resumo, briefing (jsonb), ultima_verificacao, ultima_analise_ia. |
| `clientes_teses` | Teses v2: nome_tese, tipo (Área do Direito), publico_alvo, status (Ativa/Pausada/Em Teste), data_ativacao, observacoes, orcamento, deleted_at. |
| `clientes_crm_config` | Conexão GHL por cliente: ghl_subaccount_id, ghl_pipeline_id, stage_mapping JSONB, conexao_ativa, last_test_at/result, last_sync_at, deleted_at. |
| `otimizacoes_historico` | Otimizações editáveis com soft delete. Cada confirmação grava `data_confirmacao` + `snapshot_metricas` JSONB (cpl/roas/leads/spend/historico). |
| `teses_metricas` | Métricas mensais por tese: investimento, leads, CPL (generated), ROAS (generated). |
| `reunioes_cliente` | Reuniões com link, transcrição, resumo IA, status, tipo. |
| `resumos_cliente` | Resumos semanais gerados por IA (últimos 10). |
| `contratos` | Fonte real de SDR/Closer que fechou cada cliente (FKs `sdr_id`, `closer_id`, `cliente_nome`). Cruzado por nome normalizado pela API. |
| `churn_log` | Log de churns com motivo, LTV, meses_ativo, gestor_id. |
| `churn_monthly_summary` | Resumo mensal de churn (fonte única da métrica de churn rate). |

### 7.3 Página `/dashboard/clientes/[id]` — Tabs

- **Visão Geral**: propriedades editáveis (status, situacao, resultados, atencao, nicho, analista, **SDR responsável**, **Closer que fechou** com avatar), preview de Teses (cards com badges coloridos por status), níveis de atenção, contas de mídia, WhatsApp, otimizações com snapshot expansível, análise IA.
- **Teses**: CRUD completo dos campos novos (nome, tipo, público-alvo, status, data ativação, orçamento, observações). Status com badges coloridos: verde=Ativa, cinza=Pausada, amarelo=Em Teste. Soft delete.
- **Métricas**: gráficos de spend/leads/CPL por dia.
- **Reuniões**: CRUD + geração de resumo via IA a partir de transcrição.
- **Contrato**: dados financeiros do contrato.
- **Resumos**: histórico de resumos semanais gerados cruzando todos os dados do cliente.
- **CRM**: aba nova — conexão GHL com pipeline, mapeamento de etapas para status internos, botão "Testar conexão" e badge Ativa/Desconectado.

Botão "Registrar Verificação" no header atualiza `ultima_verificacao` e dispara badge ⚠️ se > 7 dias sem verificar.

### 7.4 Otimizações: edit, soft delete e snapshot

- **Edição inline**: cada otimização tem botão "Editar" → formulário inline → "Confirmar" salva via PATCH com `confirm: true`.
- **Soft delete**: botão lixeira pede confirmação e seta `deleted_at` (recuperável via Supabase).
- **Snapshot automático**: ao criar nova otimização ou clicar "Confirmar" em uma edição, o cliente captura métricas via `GET /api/meta-spend?since=<inicio_mes>&until=<hoje>` (chamada direta à Meta, não cache do n8n) + ROAS = (`valor_mensal × fidelidade_meses`) / spend. O snapshot fica colapsado abaixo da otimização sob "Métricas no momento da confirmação".

### 7.5 Cores padronizadas dos badges

- **Situação**: Estável=azul, Melhorando=verde, Piorando=vermelho
- **Resultados**: Ótimos=verde escuro, Bons=verde claro, Médios=azul, Ruins=vermelho claro, Péssimos=vermelho escuro
- **Atenção**: Ouro=dourado bold, Prata=cinza com texto preto, Bronze=cor de bronze
- **Status de Tese**: Ativa=verde, Pausada=cinza, Em Teste=amarelo

### 7.6 Analista (gestor de tráfego)

Dropdown populado via `/api/dashboard/analistas` que lê `team_notion_mirror` (sem chamada direta ao Notion) e filtra cargos operacionais (Diretor/CEO, Head, Pleno, Junior, Tráfego, Desenvolvimento). Closers, SDRs e Administrativo ficam fora. Salva o **nome** (não o ID) — consistente entre lista e perfil.

### 7.7 Alertas de gestão

A página `/dashboard/clientes` exibe um sino global (header) e badge "⚠ N" no card de cada cliente quando há alertas pendentes. Regras (todas zeradas aos sábados/domingos):

1. Sem tese ativa há mais de 7 dias do cadastro
2. Nenhuma otimização registrada nos últimos 30 dias
3. Otimização pendente (sem `data_confirmacao`) há mais de 5 dias
4. `ghl_subaccount_id` ausente em `clientes_crm_config`
5. SDR ou Closer não atribuído (cruzando com `contratos`)

Clique no sino abre modal listando todos os clientes com alertas e link direto para cada perfil.

---

## 8. ONBOARDING

### 8.1 Fluxo

1. Cliente criado **no Notion** (DB Onboarding `fffb5b1a-3b98-8152-960f-e2877b92bcdd`)
2. Dashboard detecta e **inicia cronômetro automaticamente** (`onboarding_tracking`)
3. Arrastar card entre colunas do kanban atualiza etapa no Notion
4. Ao mover para "Trabalho iniciado" → finaliza cronômetro e grava `tempo_total_segundos`

### 8.2 Página `/dashboard/onboarding/template`

Editor do checklist padrão. Os itens aqui são adicionados automaticamente como `to_do` blocks em qualquer nova página criada (mas o dashboard não cria mais páginas — só Notion cria).

### 8.3 Métricas

Exibidas no topo do kanban: tempo médio em dias, em andamento, finalizados.

---

## 9. EQUIPE & TIME

### 9.1 Menu Time & Equipe

```
Time & Equipe
├── Meu Portal (redireciona closer → /closer/[id], sdr → /relatorio-sdr/[id])
├── Equipe Geral (admin view, setores + níveis)
└── Gestão (CRUD employees)
```

### 9.2 `/equipe-geral` — Divisão por setor

- **Diretoria** 👑 (Diretor/CEO)
- **Comercial** (Closer, SDR)
- **Operacional** (Head, Pleno, Junior)
- **Marketing** (SM, Edição)
- **Sucesso do Cliente** (CS)
- **Administrativo** (Adm, Financeiro)

Cards clicáveis → `/dashboard/team/[notion_id]`

### 9.3 `/dashboard/team/[id]` — Detalhe do membro

- Funções editável inline (salva no Notion)
- KPIs: clientes ativos, orçamento total, % bons, % melhorando
- Tabela de clientes ativos (filtrada por analista do Notion)
- **Desempenho Comercial (se Closer/SDR)**: busca por nome em `closers`/`sdrs` table, carrega lancamentos_diarios + contratos do mês atual, mostra KPIs de reuniões/conversão/MRR, lista contratos fechados + link para relatório completo
- Kanban de Tarefas filtrado pelo nome
- Análise IA com Claude

---

## 10. CHURN

### 10.1 Fonte única de métricas

Tabela `churn_monthly_summary` com seed histórico desde Out/2024. Todas as páginas que precisam de churn rate leem daqui (aba Churn + aba Entradas).

### 10.2 Fluxo de registro de churn

1. Em `/churn` clicar em "Registrar"
2. Select de clientes ativos vindos de `clientes_receita`
3. Ao confirmar: trigger SQL atualiza automaticamente `churn_monthly_summary.num_saidas + 1`
4. Sincronização bidirecional: marca cliente como "Finalizado" no Notion + "churned" em `clientes_receita`
5. Apagar churn **reverte** o cliente para ativo em ambos sistemas

### 10.3 Pipeline de Churn (kanban)

Etapas: Aviso de Saída → Jurídico → No Prazo → Procedimentos Finais → Finalizado. Drag-and-drop entre colunas atualiza `etapa_churn`.

---

## 11. Página do Colaborador Operacional (`/dashboard/team/[id]`)

### 11.1 Seção "Clientes Ativos" minimizável
Accordion colapsado por padrão. Header com chevron clicável. Estado persistido em `localStorage` na chave `team:<id>:clientesCollapsed` (um estado por colaborador).

### 11.2 Fonte única dos clientes
A tabela de clientes do colaborador consome `/api/dashboard/clientes` (mesma fonte da aba global — `clientes_notion_mirror`) e filtra client-side por `analista` (match contém primeiro nome do membro). Edições usam `PATCH /api/dashboard/clientes` — **mesma row** da mirror, sem duplicação. Salvar na página do colaborador reflete imediatamente na aba global.

### 11.3 Campos editáveis
Status, Situação, Resultados, Último Feedback, Orçamento. Opções alinhadas com a aba global (Status: Ativo/Planejamento/Pausado/Aviso 30 dias/Inadimplente/Finalizado/Não iniciado; Situação: Melhorando/Estável/Piorando; Resultados: Ótimos/Bons/Médios/Ruins/Péssimos).

### 11.4 Filtros rápidos
Input de busca por nome + dropdowns de Situação e Resultados. Filtragem 100% client-side sobre o array já carregado — zero chamadas extras ao banco.

### 11.5 Bloco "Análise IA" removido
O card de Análise IA foi removido da página do colaborador operacional.

---

## 12. Portal do Colaborador

### 12.1 Tabela `team_members_profile`
Migration: `migrations/migration-team-members-profile.sql`. Chave primária `notion_id text` (alinhada com a URL `/dashboard/team/[id]`, que vem do Notion). Link opcional `employee_id` → `employees(id)`. Campos: `foto_url`, `data_entrada`, `chave_pix`, `contrato_url`, `cargo`, `salario_base`, `handbook_url`, `bio`, `updated_at` (trigger automático). RLS habilitada com policy `service_role_all` (acesso só via API server-side).

### 12.2 Storage buckets
Buckets privados (criar via Storage UI ou SQL admin):
- `contratos-colaboradores` — PDFs de contrato
- `fotos-colaboradores` — fotos de perfil

Acesso só via signed URLs gerados pelo backend. Upload acontece em `POST /api/team/profile/upload` (multipart, validando ownership). A URL assinada (1 ano) é persistida em `team_members_profile.foto_url` / `contrato_url`.

### 12.3 API
- `GET  /api/team/profile/[notionId]` — retorna `{ profile, permissions: { canEdit, canEditAdminFields, isOwner } }`
- `PATCH /api/team/profile/[notionId]` — upsert. Campos próprios: `foto_url`, `chave_pix`, `bio`. Campos admin: + `data_entrada`, `cargo`, `salario_base`, `contrato_url`, `handbook_url`. PATCH valida permissão antes de aceitar cada campo.
- `POST /api/team/profile/upload` — multipart `{ file, notion_id, kind: "foto"|"contrato" }`. Foto: próprio ou admin. Contrato: só admin.

### 12.4 UI "Meu Portal"
Componente `src/components/team/portal-colaborador.tsx` (modal). Botão "Meu Portal" no header da página `/dashboard/team/[id]` aparece se:
- O primeiro nome do `nome` da sessão (`/api/auth/me`) bate com o do membro (heurística usada no resto do app), **ou**
- A sessão é admin.

Modo visualização: foto, nome+cargo, data de entrada, chave Pix, botões "Baixar Contrato" / "Ver Handbook". Modo edição: campos próprios para o dono, campos admin só para admin.

### 12.5 Análise de Upsell
Coluna `orcamento_inicial numeric` adicionada em `clientes_notion_mirror`. Backfill: `orcamento_inicial = orcamento` para rows existentes (snapshot do momento da migration — sem isso, o upsell mostraria 100% para todos os legados).

A tabela de clientes da página do colaborador exibe três colunas:
- **Orç. Inicial** (somente leitura, preenchido no onboarding)
- **Orç. Atual** (editável, mesma row)
- **Upsell** (calculado client-side): badge colorido com `Δ` em R$ e `%`. Verde se positivo, cinza se neutro, vermelho se negativo. Mostra `—` quando `orcamento_inicial` não está definido.

> **Pendente:** rodar `migrations/migration-team-members-profile.sql` no Supabase e criar os dois buckets privados antes de usar o portal/upsell.

---

## 13. Feedbacks de Cliente + Aba de Alertas

### 13.1 Tabela `client_feedbacks`
Migration: `migrations/migration-client-feedbacks.sql`. Campos principais: `cliente_notion_id text` (FK `clientes_notion_mirror.notion_id`), `gestor_id uuid` (FK `employees.id`), `data_feedback date`, `n_contratos`/`contratos_nao_informado`, `faturamento`/`faturamento_nao_informado`, `data_envio_feedback`/`envio_nao_informado`, `observacoes`. RLS habilitada com policy `service_role_all`. Índices em `(cliente_notion_id, data_feedback DESC)` e `gestor_id`.

### 13.2 API
- `GET /api/team/feedbacks?cliente_notion_id=<id>` — últimos 10 feedbacks de um cliente
- `GET /api/team/feedbacks?clientes=id1,id2,...` — agregado `{ id: { ultimo, total_30d } }`, evita N+1 na aba de Alertas
- `POST /api/team/feedbacks` — INSERT. Quando `*_nao_informado=true`, força o campo correspondente para `null`. Após o INSERT, atualiza `clientes_notion_mirror.ultimo_feedback` para refletir na aba global.

### 13.3 UI: linha expansível com formulário
Cada linha da tabela de clientes do colaborador é expansível (chevron + ícone "registrar feedback"). Ao expandir abre o `FeedbackForm` (componente local em `team/[id]/page.tsx`):
- Data do feedback (default = hoje)
- Nº de contratos + toggle 🚫 "Não informado" (desabilita input + envia `null`)
- Faturamento (R$) + toggle 🚫
- Data envio do cliente + toggle 🚫
- Observações (textarea)
- Botão "Salvar Feedback"
Histórico abaixo: últimos 5 ordenados por `data_feedback desc`, com 🚫 quando não informado.

### 13.4 Aba de Alertas (3C)
Card colapsado por padrão no topo da página `/dashboard/team/[id]`. Header fica vermelho quando há alertas, e mostra badge com o total. Tipos:
- 🔴 **CRÍTICO** — `situacao = 'Piorando'`
- 🟠 **ATENÇÃO** — `ultimo_feedback` há mais de 10 dias (ou ausente)
- 🟡 **AVISO** — nenhum registro em `client_feedbacks` nos últimos 30 dias (calculado via endpoint agregado)
- 🔵 **INFO** — orçamento sem crescimento há 60+ dias (`orcamento == orcamento_inicial` E `orcamento_atualizado_em < hoje - 60d`)

Clicar num alerta abre o accordion de clientes, expande a linha do cliente correspondente e faz scroll até ela (`#cliente-row-<notion_id>`).

### 13.5 Tracking de orçamento estagnado
Migration adiciona `clientes_notion_mirror.orcamento_atualizado_em timestamptz` + trigger `mirror_track_orcamento_change` que atualiza esse timestamp sempre que `orcamento` muda. Backfill inicial usa `now()` para clientes existentes (sem isso, todos os legados gerariam alerta logo no primeiro dia). O campo é exposto em `/api/dashboard/clientes`.

> **Pendente:** rodar `migrations/migration-client-feedbacks.sql` no Supabase.

---

## 14. Lançamento do Dia dentro da página do closer

A página `/closer/[id]` agora tem um card "Lançamento do Dia" no topo. Permite editar `reunioes_marcadas` e `reunioes_feitas` para qualquer data (default = hoje).

- UPSERT em `lancamentos_diarios` com `onConflict: "closer_id,data"` (a tabela tem `unique(closer_id, data)`).
- Pré-preenche os campos lendo o lançamento existente para a data escolhida — então funciona tanto para criar quanto para editar.
- Preserva os campos `ganhos`, `mrr_dia`, `ltv` quando o lançamento já existia (para não zerar dados gravados por outras fontes).
- Validação: feitas ≤ marcadas.
- Como `lancamentos_diarios` é a fonte única, a edição alimenta automaticamente: `/closers`, `/sdr`, `/historico`, `/relatorio`, `/hoje`, `/analise-dias`, `/dashboard/team/[id]` (bloco "Desempenho Comercial"), `/portal/painel`, `/portal/equipe` etc.
- Funciona para qualquer closer (existente ou criado depois) sem mudanças, porque a página é dinâmica `[id]`.

---

## 15. Bugfix — Falso "deve N meses" no MarcarPagoModal

### O sintoma
Ao registrar pagamento de um cliente como Kayna Mota em /entradas, o modal exibia "este cliente tem 3 meses sem pagamento" mesmo o cliente estando adimplente em todos os outros lugares (KPI de Inadimplentes não o flagueava).

### A causa
`getMesesPendentes` em `src/components/financeiro/MarcarPagoModal.tsx` ignorava o `status_financeiro` do cliente. Em paralelo, o KPI de inadimplentes (`/api/financeiro/entradas/route.ts:70,102`) só considera `status_financeiro = 'ativo'` (filtro `ativosRecorrentes`). Logo, qualquer cliente com `status_financeiro` igual a `pagou_integral`, `parceria`, `pausado` ou `churned`:
- não aparecia em Inadimplentes (correto: ele não tem cobrança mensal),
- mas o modal acusava todos os meses sem row de pagamento como "pendente" (incorreto).

### A correção
- `MarcarPagoModal` agora aceita `statusFinanceiro` (passado pelo `EntradasTabela`) e retorna `[]` em `getMesesPendentes` quando o status está em `STATUS_NAO_RECORRENTE = { pagou_integral, parceria, pausado, churned }` — o mesmo critério usado no KPI.
- Também aceita rows com `status` em `{ pago, perdoado, parceria, pagou_integral, pausado }` como "mês resolvido" (não pendente).

### Quem mais era afetado
**Todos os clientes com `status_financeiro` ≠ 'ativo'** — ou seja, qualquer cliente integral, em parceria, pausado ou churned. Sempre que algum desses fosse aberto no modal de pagamento, recebia falso alerta de meses devidos. Após o fix, o modal só lista pendências reais para clientes recorrentes ativos.

---

## 16. Histórico de situação + Saúde da Carteira + Risco de Churn

### 16.1 Tabela `client_situation_history` (4A)
Migration: `migrations/migration-client-situation-history.sql`. PK uuid, FK `cliente_notion_id` → `clientes_notion_mirror.notion_id`, `gestor_id` → `employees.id`. Campos: `situacao_anterior`, `situacao_nova`, `data_mudanca` (default `now()`), `origem` CHECK em `('gestor_manual','crm_sync','feedback_analysis')`, `contexto`. Trigger `trg_client_situacao_change` insere row automaticamente sempre que `clientes_notion_mirror.situacao` muda; deduplica se já houver row idêntica nos últimos 5s (evita duplicar quando a UI faz UPDATE seguido de UPDATE de contexto).

### 16.2 API `src/app/api/team/situation-history/route.ts`
- `GET ?cliente_notion_id=...` — últimas 50 mudanças
- `POST { cliente_notion_id, situacao_nova, contexto }` — atualiza a mirror (trigger grava o histórico) e em seguida anexa `contexto` + `gestor_id` da sessão à row mais recente. Origem padrão: `gestor_manual`.

### 16.3 UI: aba Histórico no cartão expandido (4B)
A linha expansível dos clientes na página do colaborador agora tem **abas**: "Registrar Feedback" e "Histórico de Situação".
- Form de mudança manual: select da nova situação + textarea "O que aconteceu nesse período?" + botão Registrar.
- Timeline vertical com badges coloridos (de → para), origem, contexto e data/hora.
- **Cruzamento com feedbacks**: cada evento mostra resumo do feedback registrado dentro de ±3 dias da mudança (data, contratos, faturamento, observação).

### 16.4 Saúde da Carteira (4C)
Card no topo da página `/dashboard/team/[id]`. Score 0–100 (cores: 0–40 vermelho, 41–70 amarelo, 71–100 verde) calculado via média ponderada:
- 40% — % de clientes com situação `Estável` ou `Melhorando`
- 30% — % com `ultimo_feedback` ≤ 10 dias
- 20% — % com upsell positivo (`orcamento > orcamento_inicial`)
- 10% — % sem alerta crítico (sem risco de churn e situação ≠ Piorando)

Mostra também o breakdown dos 4 componentes em mini-cards.

### 16.5 Flag de Risco de Churn (4D)
Função `churnRiskInfo(c)` retorna `atRisk = true` quando os 3 critérios são satisfeitos simultaneamente:
1. `situacao = 'Piorando'`
2. `ultimo_feedback < hoje - 10` (ou ausente)
3. zero feedbacks em `client_feedbacks` nos últimos 30 dias

Quando ativo:
- Ícone 🔴 ao lado do nome do cliente na tabela, com tooltip listando os 3 critérios.
- Alerta separado na seção "Alertas" com label "RISCO DE CHURN" — tipo `churn`, ordenado antes de todos os outros (cor vermelho-escuro), apontando os critérios que dispararam.

> **Pendente:** rodar `migrations/migration-client-situation-history.sql` no Supabase.

---

## 17. Bugfix — Churn registrado não aparecia nos cards (e o irmão MRR perdido zerado)

### Sintoma reportado
Após registrar churn pela aba Entradas, o cliente saía da lista mas:
- Card "Churn no mês" continuava no valor antigo.
- A página /churn não contabilizava o cancelamento.

### Causa raiz
O sistema mantém **duas** estruturas paralelas para churn:

1. **`churn_log`** — auditável, com motivos canônicos e mensalidade.
   Trigger `trigger_update_churn_summary` (`AFTER INSERT ON churn_log`)
   incrementa `churn_monthly_summary.num_saidas` automaticamente.
   `churn_monthly_summary` é a fonte canônica de COUNT lida por:
   - `/api/financeiro/entradas` (card "Churn no mês")
   - `/api/churn-canonico` (consumido por `/churn` e `/recebimentos`)
   - `/api/churn-summary`
   - `/churn/page.tsx`

2. **`clientes`** — pipeline com `data_cancelamento`/`mrr`.
   Fonte de **MRR perdido** lida por:
   - `vw_churn_mensal` → `/api/churn`
   - `/api/churn-canonico` (`receita_churned`)
   - `/api/financeiro/entradas` (`receitaChurned`)
   - `/api/financeiro/dre`

Os endpoints de registro estavam **assimétricos**:
- `/api/financeiro/churnar-cliente` (usado pela aba Entradas) escrevia em `clientes` e em `clientes_receita`, **mas nunca em `churn_log`** → trigger não disparava → COUNT desatualizado.
- `/api/churn-log` POST (usado pelo flow alternativo) escrevia em `churn_log` e `clientes_receita`, **mas nunca em `clientes`** → MRR perdido zerado.

### Correção
- **`/api/financeiro/churnar-cliente`**: passou a inserir em `churn_log` após gravar o pipeline. Mapeia os motivos do dropdown da UI para os valores aceitos pelo CHECK constraint do `churn_log.motivo` (`MOTIVO_MAP`), preservando o texto original em `motivo_detalhe`. Tem fallback que faz UPSERT direto em `churn_monthly_summary` caso o INSERT no log falhe (CHECK violado, RLS, etc). Anti-duplicata: só insere se não houver row em `churn_log` para o mesmo cliente no mês corrente.
- **`/api/churn-log` POST**: passou a fazer upsert em `clientes` (pipeline) com `data_cancelamento`, `mrr` e `motivo`, garantindo que o MRR perdido apareça em `/churn`, `/dre` e `/churn-canonico`.
- **`/api/churn-log` DELETE**: passou a remover a row do pipeline `clientes` E a decrementar `churn_monthly_summary.num_saidas` (o trigger só dispara em INSERT). Antes, deletar um churn deixava o COUNT inflado para sempre.

### Outros números varridos (todos OK)
- Filtros `clientes_receita.status_financeiro = 'churned'` em `/api/financeiro/entradas` (linhas 76, 83, 196, 203, 139): ✅ funcionavam, porque ambos os endpoints já marcavam clientes_receita.
- `vw_churn_mensal` (view sobre `clientes`): ✅ agora consistente com o trigger porque ambos endpoints escrevem em `clientes`.
- `/api/churn` (lê de `clientes` direto): ✅ sempre funcionou via `churnar-cliente`, agora também via `churn-log`.
- `/api/financeiro/dre` (mrr cancelado por data): ✅ idem.

### Como aplicar
Sem migration nova — só correções de código. Re-deploy resolve a partir do próximo registro de churn. Para regularizar registros antigos que estão no `clientes` mas não no `churn_log` / `churn_monthly_summary`, precisaria de um backfill manual via SQL (não automatizado nessa correção).

---

## 18. Bugfix — Reativar cliente churnado pelo cartão de Recebimentos/Entradas

### Sintoma
Em /recebimentos, ao abrir Editar de um cliente churnado e mudar o status para ativo, dava `invalid input syntax for type date: ""`. Mesmo se passasse, o cliente continuaria nos cards de churn (porque a reativação não revertia os espelhos).

### Causa
1. `EditarClienteModal` mandava `fidelidade_inicio: ""` (string vazia) sempre que o campo estava em branco. O PATCH `/api/financeiro/entradas/cliente/[id]` repassava esse valor pro Postgres, que rejeita string vazia em coluna `date`.
2. O modal só editava o campo `status`, não `status_financeiro` (que é a fonte canônica do filtro de churn em todos os outros lugares). Resultado: mesmo após salvar, o cliente continuava `status_financeiro = 'churned'`.
3. Reativar não revertia os espelhos paralelos (`clientes`, `churn_log`, `churn_monthly_summary`) — então o cliente continuaria no count de churn dos cards (`/api/churn-canonico`, `/api/financeiro/entradas`, etc).

### Correção
**`src/components/financeiro/EditarClienteModal.tsx`**
- Envia `fidelidade_inicio: null` quando o campo está vazio.
- Espelha `status_financeiro = form.status` no payload, garantindo que reativação realmente troca o status canônico.

**`src/app/api/financeiro/entradas/cliente/[id]/route.ts`**
- Defensivo: coage `""` para `null` em colunas DATE conhecidas (`fidelidade_inicio`, `fidelidade_fim`, `mes_fechamento`).
- Recalcula `fidelidade_fim` a partir de meses + início, e limpa para `null` quando algum dos dois é vazio (em vez de pular o cálculo).
- Detecta reativação (`status` ou `status_financeiro` virando `ativo`/`pausado`/`pagou_integral`/`parceria`) e:
  - Apaga rows do pipeline `clientes` com `status='cancelado'` para esse nome.
  - Para cada row em `churn_log` desse cliente, decrementa `churn_monthly_summary.num_saidas` do mês correspondente e apaga a row do log.
  - Garante que os cards de churn em /entradas, /churn, /recebimentos voltam ao valor correto imediatamente.

### Quem mais era afetado
Qualquer cliente cancelado teria o mesmo erro ao tentar reativar via cartão. Mesmo clientes ativos podiam quebrar se alguém abrisse o Editar com fidelidade vazia e clicasse Salvar — agora resolvido.

---

## 19. Comissão do colaborador (5A/5B/5C)

### 19.1 Tabela `team_commission_config` (5A)
Migration: `migrations/migration-team-commission-config.sql`. Uma row por `(colaborador_id, mes_referencia)`. FK para `employees(id)`. Campos: `cargo` (CHECK closer/sdr/social_seller), `meta_reunioes_mes`, `meta_vendas_mes`, `ote_base`, `mes_referencia` (sempre dia 1 do mês). Trigger `updated_at` automático. RLS habilitada.

### 19.2 Lib `src/lib/comissao.ts` (5B)
Faixas exatas conforme regras de negócio:
- **SDR/Social Seller** — `FAIXAS_SDR`: 0–49% R$0, 50–65% R$4, 66–79% R$6, 80–89% R$8, 90%+ R$12 por comparecimento.
- **Closer** — `FAIXAS_CLOSER`: 0–49% 0%, 50–65% 2%, 66–79% 4%, 80–89% 7%, 90%+ 10% sobre vendas.

Funções `calcularComissaoSdr({ comparecimentos, metaReunioes })` e `calcularComissaoCloser({ totalVendido, metaVendas })` retornam `ComissaoResultado` com `meta`, `realizado`, `pctAtingido`, `comissao`, `faixaAtualLabel`, `proximaFaixa` (label + min + faltaParaAtingir) e `detalhe` ("X reuniões × R$Y = R$Z").

### 19.3 API `src/app/api/team/comissao/route.ts`
- `GET ?notion_id=...&mes=YYYY-MM` — resolve o membro pelo notion_id (usa `getTeam` + match por primeiro nome com `employees`/`closers`/`sdrs`, mesma heurística do resto do app), carrega config (fallback para a mais recente ≤ mes), busca realizado:
  - **SDR/Social Seller**: `SUM(reunioes_feitas)` em `lancamentos_diarios` por `sdr_id` + `mes_referencia`.
  - **Closer**: `SUM(mrr)` em `contratos` por `closer_id` + `mes_referencia`.
  Aplica faixa via `calcularComissaoSdr/Closer` e retorna `{ resultado, config, historico (6 meses), permissions }`.
- `PATCH` — apenas admin/super-admin; UPSERT em `team_commission_config`.

`permissions.canView` = admin ou owner (primeiro nome bate). `canEditConfig` = admin.

### 19.4 UI: `src/components/team/comissao-card.tsx` (5C)
Card "Comissão do Mês" renderizado em `/dashboard/team/[id]`:
- Seletor de mês (input month)
- Mini-form de configuração (admin) com meta e OTE base
- Bloco principal: "Realizado / Meta" + barra de progresso colorida (vermelho <50, amarelo <80, verde ≥80)
- Faixa atual + "próxima faixa: faltam X" (reuniões ou R$ dependendo do cargo)
- Comissão calculada em destaque (verde) com fórmula explicativa
- Tabela de histórico dos últimos 6 meses

Renderiza só se o membro tiver cargo de comissão e a sessão tiver `canView`.

> **Pendente:** rodar `migrations/migration-team-commission-config.sql` no Supabase.

---

## 20. NPS por cliente + tarefa automática + visão global

### 20.1 Tabela `client_nps` (6A)
Migration: `migrations/migration-client-nps.sql`. PK uuid, FK `cliente_notion_id` → `clientes_notion_mirror.notion_id` (a tabela canônica), `gestor_id` → `employees.id`, `nps_score` 1-10 (CHECK), `nps_comentario`, `mes_referencia date`. UNIQUE `(cliente_notion_id, mes_referencia)` — 1 NPS por cliente por mês.

### 20.2 Tarefa automática (6B)
Trigger `trg_criar_tarefa_nps` (`AFTER INSERT ON clientes_notion_mirror`) cria automaticamente uma row em `tarefas_kanban` (a tabela do kanban consumido pela página do colaborador):
- titulo: `Coletar NPS — <nome>`
- descricao: `Primeiro mês: registrar NPS do cliente no sistema`
- responsavel: `analista` do cliente
- data_vencimento: `now() + 30 dias`
- status: `a_fazer`

Só dispara se o cliente já entrar com `analista` preenchido (caso contrário, ficaria sem responsável). A tabela `tarefas_kanban` não tem `client_id` formal — usamos a coluna `cliente` (texto) para vincular.

### 20.3 API `src/app/api/team/nps/route.ts`
- `GET ?cliente_notion_id=...` — últimos 24 NPS do cliente
- `GET ?global=1` — agregação para a aba global, retorna `{ npsPorCliente, npsPorGestor, visaoGeral, alertas }`. NPS clássico = `(promotores − detratores)/total × 100`. Evolução = média mensal dos últimos 6 meses. Alertas = clientes com queda ≥ 2 vs. mês anterior.
- `POST` — UPSERT respeitando `(cliente_notion_id, mes_referencia)`. Normaliza `mes_referencia` para o dia 1.

### 20.4 UI: aba NPS no cartão expandido (6C)
Terceira aba em `ClienteExpansao` (`Registrar Feedback`/`Histórico`/**`NPS`**). O `NpsForm` mostra:
- Botões de 1–10 coloridos (1-6 vermelho, 7-8 amarelo, 9-10 verde)
- Mês de referência (input month) e comentário livre
- Histórico vertical com badges coloridos por score

### 20.5 Página global "NPS & Performance" (6D)
`src/app/dashboard/clientes/nps/page.tsx`, linkada com botão `⭐ NPS` no header de `/dashboard/clientes`. Três seções:

1. **Visão Geral** — NPS médio (1–10), NPS clássico, contagem promotores/neutros/detratores, **gráfico de pizza** da distribuição (recharts) e **gráfico de linha** da evolução de 6 meses.
2. **Alertas** — clientes com queda ≥ 2 pontos vs. mês anterior, em card destacado em vermelho.
3. **Ranking de gestores** — média de NPS de todos os clientes da carteira, ordenado.
4. **NPS por cliente** — tabela ordenável (score, variação, nome), filtrável por gestor, com último score, variação vs. mês anterior e comentário recente.

> **Pendente:** rodar `migrations/migration-client-nps.sql` no Supabase.

---

### 20.6 Remoção da página "Metas Closers" do módulo Projeções (6E)

A rota `/projecoes/metas-closers` e seu componente `MetasClosersEvolutionPage` foram removidos da UI. O item "Metas Closers" foi removido do menu lateral (sidebar).

- **Motivo:** consolidação do módulo de Projeções — a funcionalidade de metas por closer já é coberta pela página `/metas`.
- **O que foi mantido:** a tabela `metas_closers` no Supabase, o endpoint API `POST /api/projecoes/meta-closers` (cron de sugestão via IA) e todas as referências a `metas_closers` em outras páginas (dashboard, closers, metas, portal, etc.).
- **O que foi removido:** `src/app/projecoes/metas-closers/page.tsx`, entrada no sidebar, import `Zap` não utilizado.

---

## 21. Tarefas Kanban — Responsável/Solicitante por ID, Cliente vinculado e botão inline (7A)

### 21.1 Schema — migration `migrations/migration-tarefas-kanban-ids.sql`

Colunas adicionadas em `tarefas_kanban`:
- `responsavel_id uuid REFERENCES employees(id)` — referência formal ao colaborador responsável
- `solicitante_id uuid REFERENCES employees(id)` — quem criou/solicitou a tarefa
- `cliente_id uuid REFERENCES clientes(id)` — cliente vinculado (opcional)
- `deleted_at timestamptz DEFAULT NULL` — soft delete (null = ativo)
- `deleted_by uuid REFERENCES employees(id)` — quem deletou

As colunas de texto (`responsavel`, `solicitante`, `cliente`) continuam existindo para retrocompatibilidade. Novos registros preenchem ambos (ID + nome). Índices criados para todos os novos campos.

> **Pendente:** rodar `migrations/migration-tarefas-kanban-ids.sql` no Supabase.

### 21.2 API `src/app/api/tarefas-kanban/route.ts`

- **GET**: filtra `deleted_at IS NULL` (soft delete). Suporta `?responsavel_id=` além do existente `?responsavel=`.
- **POST**: aceita `responsavel_id`, `solicitante_id`, `cliente_id`. Resolve nomes automaticamente a partir dos IDs (busca em `employees`/`clientes`) para manter os campos de texto preenchidos. `solicitante_id` é preenchido automaticamente via sessão se não informado.
- **DELETE**: agora faz soft delete (`deleted_at` + `deleted_by`) em vez de exclusão física.
- **PATCH**: sem alteração (cronômetro e transições de status mantidos).

Novo endpoint `GET /api/tarefas-kanban/employees` — retorna lista de `employees` ativos com `id, nome, role, cargo, foto_url`.

### 21.3 UI — Formulário de criação

O modal de criação de tarefa (`NovaTarefaModal`) agora:
- **Solicitante**: campo read-only, preenchido automaticamente com o nome do usuário logado (via `useAuth`). Exibido como texto com ícone de usuário.
- **Responsável**: select com todos os colaboradores ativos da tabela `employees`, mostrando nome e cargo. Valor padrão: usuário logado. Editável.
- **Cliente**: campo de busca com dropdown (`ClienteSearchDropdown`). Input de texto com filtragem em tempo real. Dropdown agrupa clientes por status financeiro (Ativos, Planejamento, Pagou Integral, etc.). Campo opcional.
- Ao salvar: persiste `responsavel_id`, `solicitante_id` e `cliente_id` em `tarefas_kanban`.

### 21.4 UI — Botão inline "+ Adicionar tarefa" no Kanban

Em cada coluna do Kanban (A Fazer, Fazendo, Concluído), abaixo dos cartões:
- Botão `+ Adicionar tarefa` com estilo discreto (texto muted, borda dashed no hover).
- Ao clicar: abre o modal de criação com o status pré-selecionado correspondente à coluna.
- Reutiliza o mesmo `NovaTarefaModal` — sem componente novo de modal.

### 21.5 UI — Cliente no cartão do Kanban

No cartão de cada tarefa no Kanban:
- Se `cliente` estiver preenchido, mostra o nome do cliente em texto pequeno (10px) roxo abaixo do título.
- Badge de cliente removido (substituído pelo texto inline mais limpo).

### 21.6 Filtro de responsável

O filtro de responsável no Kanban agora usa a lista de `employees` no select (por ID). Mantém fallback para nomes de texto que não têm match em employees (tarefas antigas). Novo prop `filtroResponsavelId` para filtragem por UUID.

---

## 22. Soft Delete completo e Histórico de Excluídas (7B)

### 22.1 Soft delete em ambas as tabelas

**`tarefas_kanban`**: já tinha `deleted_at` e `deleted_by` da migration anterior. O `DELETE` na API faz `UPDATE SET deleted_at = now(), deleted_by = session.employeeId`. O `GET` filtra `.is("deleted_at", null)`.

**`tarefas`** (sistema legado): colunas `deleted_at` e `deleted_by` adicionadas na mesma migration (`migration-tarefas-kanban-ids.sql`). O `GET /api/tarefas` agora filtra `.is("deleted_at", null)`. O `DELETE /api/tarefas/[id]` faz soft delete em vez de exclusão física.

Ambas as tabelas agora seguem o mesmo padrão: nunca há DELETE físico direto — sempre passa por soft delete primeiro.

### 22.2 API de excluídas `GET/PATCH/DELETE /api/tarefas-kanban/excluidas`

- **GET**: lista tarefas com `deleted_at IS NOT NULL`, ordenadas por `deleted_at DESC`. Enriquece com `deleted_by_nome` (busca em `employees`).
- **PATCH `{ id }`**: restaura tarefa — zera `deleted_at` e `deleted_by`. Tarefa volta ao Kanban no status original.
- **DELETE `?id=`**: exclusão permanente (física). Só permite se a tarefa já está na lixeira (`deleted_at IS NOT NULL`).

### 22.3 UI — Lixeira no Kanban

Botão "Lixeira" no header do Kanban (ao lado de "Nova Tarefa"). Toggle entre Kanban e lista de excluídas.

A seção de excluídas (`HistoricoExcluidas`) mostra:
- Lista de tarefas excluídas com título, responsável, status original, cliente (se houver)
- Data/hora de exclusão e nome de quem excluiu
- Botão **Restaurar** — zera `deleted_at`, tarefa volta ao Kanban
- Botão **Excluir** — exclusão permanente com confirmação (`confirm()`)
- Estado vazio com ícone Archive e aviso dos 30 dias

### 22.4 Limpeza automática — função SQL `cleanup_tarefas_excluidas()`

Função PL/pgSQL que deleta permanentemente registros com `deleted_at < now() - 30 days` em ambas as tabelas (`tarefas_kanban` e `tarefas`).

Para ativar, agendar via pg_cron no Supabase:
```sql
SELECT cron.schedule('cleanup-tarefas-excluidas', '0 3 * * *', $$SELECT cleanup_tarefas_excluidas()$$);
```
Ou via n8n com chamada HTTP diária à função.

> **Pendente:** rodar `migrations/migration-tarefas-kanban-ids.sql` no Supabase (inclui as colunas de soft delete em `tarefas` e a função de cleanup).

---

## 23. CRM Tabela — Colunas de contrato e tooltip de score (8A)

### 23.1 Dados de contrato na tabela

O hook `useCrmData` agora faz batch-fetch da tabela `contratos` para todos os leads que possuem `contrato_id`. Os contratos são armazenados num `contratosMap` (Record por ID) e passados ao `CrmTable`.

5 novas colunas adicionadas a `ALL_COLUMNS` (prefixo `(C)` para distinguir dos campos do lead):
- **Dt Venda (C)** — `contratos.data_fechamento` formato dd/mm/yyyy
- **Mensal. (C)** — `contratos.mrr` formato R$
- **Entrada (C)** — `contratos.valor_entrada` formato R$
- **LTV (C)** — `contratos.valor_total_projeto` formato R$, cor emerald
- **Meses (C)** — `contratos.meses_contrato`

Para leads sem contrato vinculado (`contrato_id` null ou não encontrado no map), todas as colunas exibem "—". Nunca valores zerados falsos.

As colunas entram no sistema de visibilidade existente (toggle de colunas, auto-hide por sparsity). São ocultadas automaticamente se >70% dos leads não tiverem contrato.

### 23.2 KPIs de contrato

3 novos KPIs no topo da página CRM (grid expandido para 7 colunas em lg):
- **MRR Contratos** — soma de `contratos.mrr` dos leads visíveis filtrados (cor cyan)
- **LTV Contratos** — soma de `contratos.valor_total_projeto` (cor emerald)
- **Ticket Médio LTV** — Total LTV / quantidade de contratos (cor violet)

Os KPIs se recalculam automaticamente quando filtros (aba, closer, busca, canal, score) mudam.

### 23.3 Tooltip de score

Na coluna Score, um ícone (i) ao lado do valor. Ao passar o mouse:
- Tooltip com breakdown de cada componente do score
- Formato: `Score: 78/100` seguido de lista com ✓/✗, label e pontuação
- 10 componentes: Área de atuação (+20), Telefone (+15), Email (+10), Faturamento (+15), Mensalidade (+15), Canal (+5), Funil (+5), Ad atribuído (+5), Closer (+5), Site/Instagram (+5)
- `leadScore()` agora retorna `breakdown: ScoreBreakdown[]` com `label`, `pts`, `has`
- Tooltip posicionado com CSS `group-hover/tip:block`, sem dependência de shadcn Tooltip

### 23.4 Performance

Contratos são buscados em batch (uma query com `.in("id", ids)`) após carregar leads. IDs já presentes no mapa são ignorados (dedup). Nenhuma query por lead individual.

---

---

## 24. Projeções — Base histórica selecionável e mapeamento reverso completo (9A)

### 24.1 Seletor de base histórica

Seletor visual no topo da página de Projeções com 3 opções: "Último mês" (1), "Últimos 3 meses" (3), "Últimos 12 meses" (12). Já existia `histPeriod` no state — agora tem UI visível.

Se o período selecionado não tiver dados suficientes (ex: selecionou 12 meses mas só tem 5 com dados), exibe aviso amarelo: "Dados insuficientes para 12 meses — usando 5 meses disponíveis". O campo `histAvg.mesesComDados` indica quantos meses efetivamente têm dados.

### 24.2 Médias históricas expandidas

O `HistoricalAverages` agora calcula usando **taxas ponderadas** (soma total / soma total, não média de médias):
- `taxaAgendamento` = reuniões marcadas / leads totais do período
- `taxaNoShow` = (marcadas - feitas) / marcadas (ponderado)
- `cpl` = spend total / leads totais (ponderado, nunca média simples)
- `taxaLeadReuniao`, `taxaReuniaoFechamento` = ponderados idem

Novas métricas: `mrrMedio`, `investimentoMedio`, `leadsMedio`, `reunioesMarcadasMedio`, `reunioesFeitasMedio`, `contratosMedio`, `mesesComDados`.

### 24.3 Fonte de dados — `contratos` como fonte de verdade para LTV

A API `/api/projections/summary` (`fetchHistorico`) agora busca a tabela `contratos` por `mes_referencia`. Quando há contratos:
- **LTV** = soma `contratos.valor_total_projeto` (não mais `leads_crm`)
- **MRR** = soma `contratos.mrr` (não mais `lancamentos_diarios.mrr_dia`)
- **Ticket médio** = LTV total / COUNT contratos

Fallback para dados de leads/lançamentos quando não há contratos no mês.

### 24.4 Mapeamento reverso completo

Funil visual com 4 etapas: Leads → Agendamentos → Reuniões Feitas → Contratos, com taxas entre cada etapa.

9 cards projetados, cada um com referência histórica:
1. **Investimento Tráfego** — ref: invest. médio/mês
2. **Leads Necessários** — ref: média/mês
3. **CPL Projetado** — ref: CPL histórico
4. **Reuniões Agendadas** — ref: média/mês
5. **Reuniões Feitas** — ref: média/mês
6. **No-Show Esperado** — taxa % + absoluto / ref: histórico
7. **CPRF Projetado** — ref: CPRF hist.
8. **Ticket Médio Esperado** — ref: ticket hist.
9. **Contratos Necessários** — ref: média/mês

### 24.5 Fórmulas

Contratos = Meta LTV / Ticket médio | Reuniões feitas = Contratos / Taxa conversão | Agendamentos = Reuniões / (1 - NoShow) | Leads = Agendamentos / Taxa agendamento | Investimento = Leads × CPL | CPL proj = Invest / Leads | CPRF proj = Invest / Reuniões feitas.

---

*Última atualização: 2026-04-18 (v20 — projeções base histórica selecionável, mapeamento reverso completo, métricas ponderadas)*
