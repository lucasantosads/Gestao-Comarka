# Dashboard Comercial — Comarka Ads

Dashboard de controle comercial para agência de tráfego pago focada no nicho jurídico (advocacia). Integra GHL (GoHighLevel/CRM), Meta Ads API, Supabase e n8n em uma plataforma única de gestão comercial, de time e de tráfego pago.

## Stack Técnica

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript
- **UI:** shadcn/ui, Tailwind CSS v3, Lucide Icons, Recharts
- **Backend/DB:** Supabase (PostgreSQL) com RLS, REST API, Realtime
- **Deploy:** Vercel (https://dashboard-comercial-one.vercel.app)
- **Automação:** n8n Cloud (comarka.app.n8n.cloud)
- **CRM:** GoHighLevel (GHL) — webhook de oportunidades
- **Ads:** Meta Ads API v21.0 — sync a cada 2 horas
- **Local:** /Users/lucassilva/dashboard-comercial

---

## Estrutura de Navegação

### Menu Lateral (Sidebar)
5 itens principais + configurações no rodapé:

```
📊 Dashboard    → /dashboard, /hoje, /relatorio
💼 Vendas       → /crm, /funil-tempo, /analise-dias, /historico, /canais
👥 Time         → /sdr, /closers, /social-selling, /closer/[id]
📢 Tráfego Pago → /trafego/visao-geral, /trafego/estrutura, /trafego/frequencia, /trafego/alertas
💰 Financeiro   → /metas, /recebimentos, /lancamento, /contratos
⚙️ Config       → /config, /config/integracoes, /trafego/relatorio-auto, /calculadora
```

Cada seção tem **tabs horizontais** no topo do conteúdo (componente `PageTabs`).

---

## Páginas e Funcionalidades

### Dashboard > Visão Geral (`/dashboard`)

**18 KPIs organizados em 4 faixas temáticas:**

Faixa 1 — Funil (destaque visual):
- Leads, Reuniões Agendadas, Reuniões Feitas, No-Show

Faixa 2 — Resultado Financeiro:
- Contratos Fechados, LTV Total, Ganho de MRR, Ticket Médio

Faixa 3 — Eficiência de Marketing:
- Valor Investido, ROAS, Custo por Lead, CAC Aproximado

Faixa 4 — Time:
- Gasto em Comissão, Resultado do Time

**Outros elementos:**
- Seletor de período: Este mês | Esta semana | Hoje | Personalizado (com navegação ‹ ›)
- Funil CRM em tempo real (Oportunidade → Reunião → Proposta → Follow Up → Assinatura → Comprou → Desistiu)
- Alertas automáticos: No-Show > 30%, ROAS < 2x, divergências entre fontes de dados
- Verificação de divergências: compara lancamentos_diarios vs contratos vs leads_crm
- Saúde do Time: score por closer (clicável para análise detalhada)
- Gráficos de metas (gauges) e charts por closer
- Real-time: atualiza quando leads_crm, lancamentos_diarios ou contratos mudam no Supabase

**Fontes de dados:**
- KPIs financeiros: `config_mensal` (leads, investimento) + `lancamentos_diarios` (marcadas, feitas, ganhos, mrr)
- LTV total: `leads_crm.valor_total_projeto` onde etapa = "comprou"
- Funil CRM: contagem de `leads_crm` por etapa do mês
- "Comprou" no funil: usa `lancamentos_diarios.ganhos` (não CRM count)

### Dashboard > Hoje (`/hoje`)

- KPIs do dia: Leads que Chegaram, Reuniões Agendadas/Feitas, Contratos, Reuniões Marcadas
- Navegação de data: ‹ › + date picker + botão "Hoje"
- Lista de leads que chegaram (nome, telefone, canal, ad_name, etapa) — real-time
- Reuniões do dia, Follow-ups atrasados (> 3 dias), Lançamentos do dia por closer
- Leads ativos (pipeline geral)

### Dashboard > Relatório Mensal (`/relatorio`)

- Cards por mês (Jan-Abr 2026) com todas as métricas agrupadas por seção
- Mini-gráficos: MRR × Resultado, Contratos, ROAS
- CSS de impressão (@media print) para exportar PDF (botão PDF)
- Botão Copiar resumo para WhatsApp

---

### Vendas > CRM (`/crm`)

- Tabela editável de leads com 7 etapas:
  Oportunidade → Reunião Agendada → Proposta Enviada → Follow Up → Assinatura → Comprou → Desistiu
- Dropdown clicável (onMouseDown) para mudar etapa — registra histórico automaticamente
- Auto-cria contrato quando lead muda para "Comprou" (com nome, closer, valores, data)
- Campos editáveis inline: nome, valores, fidelidade, closer, SDR, canal, funil, origem
- Abas filtráveis por etapa com contagem
- Busca por nome/telefone/email
- Ordenação por qualquer coluna
- Real-time via Supabase channel

**Função `mudarEtapa`:**
1. Atualiza `leads_crm.etapa` + campo de data correspondente
2. Insere em `leads_crm_historico`
3. Se "comprou": cria contrato em `contratos`, vincula `contrato_id`, exibe toast

### Vendas > Outras páginas

- **Funil de Tempo** (`/funil-tempo`): Tempo médio Criação→Reunião→Proposta→Fechamento
- **Análise por Dias** (`/analise-dias`): Performance por dia da semana, heatmap, insights automáticos
- **Histórico** (`/historico`): Tendências mês a mês com gráficos
- **Canais** (`/canais`): Performance por canal de aquisição

---

### Time > SDR (`/sdr`)

**KPIs (mesma fonte da dashboard):**
- Leads (config_mensal.leads_totais), Reuniões Agendadas/Feitas, No-Show, % Leads→Reunião, Taxa Agendamento

**Fontes:**
- Leads: `config_mensal.leads_totais` (mesmo número da dashboard)
- Reuniões: `lancamentos_diarios` (soma global de marcadas/feitas)
- Taxa Agendamento: marcadas / leads

**Outros elementos:**
- Leads no Pipeline (4 cards: Oportunidade, Proposta, Follow Up, Reunião Agendada) + tabela de leads ativos
- Histórico diário de lançamentos manuais (`lancamentos_sdr`)
- Metas com barras de progresso (Leads, Reuniões Agendadas, Reuniões Feitas, No Show)
- Gráfico comparativo realizado vs meta

### Time > Closers (`/closers` e `/closer/[id]`)

**Página individual do closer — 13 KPIs:**
Contratos, Reuniões Agendadas/Feitas, No Show, % Conversão, CAC Individual, Ticket Médio, LTV, Gasto com Reuniões, MRR, Custo/Retorno, Comissões, Retorno do Closer

**Score de Saúde (0-100) — 4 critérios:**
1. Taxa de Conversão (35%): ganhos/feitas
2. Atingimento de Meta (30%): ganhos/meta_contratos — ignorado se meta=0 (redistribui peso)
3. Ticket Médio vs Meta (20%): ticket_medio/ticket_meta
4. Aproveitamento (15%): feitas/marcadas

**Fórmulas per-closer:**
- Gasto com Reuniões = CPRF_global × feitas_do_closer = (investimento / feitas_total) × feitas_closer
- CAC Individual = gasto_reuniões / ganhos
- Retorno = MRR - comissão - gasto_reuniões
- LTV per-closer: `lancamentos_diarios.ltv` (diferente do LTV total que vem de leads_crm)

**Análise individual (`/dashboard/closers/[id]`):**
- Header com gauge, nome, badge de status
- Breakdown dos critérios com barras coloridas
- Diagnóstico automático por regras fixas (conversão baixa, volume baixo, aproveitamento baixo, ticket baixo, meta não configurada)
- Espaço para análise por IA (Claude API via `/api/closer-analysis`)

### Time > Social Selling (`/social-selling`)
- Lançamentos diários de social selling com métricas específicas

---

### Tráfego Pago > Visão Geral (`/trafego/visao-geral`)

**KPIs:** Investido, Impressões, Cliques, CTR, Leads (Meta), CPL, Leads (CRM), CAC, ROAS
- Filtros: 7d | 30d | 3 meses | Personalizado + Status (padrão: Ativos)
- Top anúncios com investido, impressões, leads, CPL, CTR
- Alertas de CPL alto
- **Comparativo de Período** (absorvido da aba Relatórios): cards de delta + gráfico de tendência diária

### Tráfego Pago > Estrutura (`/trafego/estrutura`)

**Drill-down com breadcrumb:**
Campanhas (nível 1) → clique → Conjuntos (nível 2) → clique → Anúncios (nível 3)

- Cada nível mostra: Nome, Investido, Leads, CPL, Impressões, CTR, Contagem/Score
- Nível de anúncios: score dinâmico com barra visual (verde/amarelo/vermelho)
- Botão "Voltar" + breadcrumb navegável

**Score dinâmico de anúncios (0-100):**
- CPL relativo à média (35%)
- CTR relativo à média (25%)
- Volume de leads (20%)
- Qualificação CRM (20%)

### Tráfego Pago > Frequência (`/trafego/frequencia`)
- Heatmap dia da semana × hora do dia (intensidade por leads, cor #185FA5)
- Dados de `leads_ads_attribution`

### Tráfego Pago > Alertas (`/trafego/alertas`)

**4 tipos de alerta (thresholds configuráveis em /config):**
1. 🚨 CPL acima do máximo (padrão R$ 100)
2. ⚠️ CTR abaixo do mínimo (padrão 0.8%, mín 500 impressões)
3. ⚠️ Frequência acima do máximo (padrão 3x, últimos 7 dias)
4. 🚨 Zero leads em X horas com gasto > R$ Y (padrão 48h, R$ 50)

**Cada alerta tem:** tipo on/off, sugestão automática, snooze 24h (tabela `alertas_snooze`)
**Severidade:** danger (vermelho) e warning (amarelo)
**Resumo no topo:** contagem de críticos e avisos

### Tráfego Pago > Relatório Automático (`/trafego/relatorio-auto`, movido para Config)

- Editor de template de mensagem WhatsApp com variáveis inseríveis:
  `{{investimento}}`, `{{total_leads}}`, `{{cpl_medio}}`, `{{taxa_qualificacao}}`, `{{reunioes}}`, `{{fechamentos}}`, `{{receita}}`, `{{roas}}`, `{{top_anuncios}}`, `{{cliente_nome}}`, `{{#se_roas}}...{{/se_roas}}`
- Cadastro de destinatários (nome, WhatsApp, dia/hora)
- Preview da mensagem com dados reais
- Template salvo em localStorage, persistido entre sessões

---

### Financeiro

- **Metas e Bônus** (`/metas`): Metas por closer e SDR com inputs editáveis
- **Recebimentos** (`/recebimentos`): Controle de recebimentos
- **Lançamento Diário** (`/lancamento`): Formulário de entrada diária por closer
- **Contratos** (`/contratos`): Lista de contratos com filtros

---

## Integrações e Automações

### GHL → Supabase (n8n)

**Workflow:** "GHL → Dashboard CRM" (ativo)
**Webhook:** https://comarka.app.n8n.cloud/webhook/ghl-crm-webhook

**Fluxo:** Webhook GHL → Filter (Closer OR SDR) → Mapear Dados (Code) → Inserir Lead (HTTP) → Inserir Histórico (HTTP)

**Lógica do Mapear Dados:**
- Pipeline SDR → etapa "oportunidade"
- Pipeline Closer → etapa "reuniao_agendada"
- closer_id mapeado por pipeline_id (3 closers: Lucas, Mariana, Rogério)
- ad_id extraído de `body.contact.attributionSource.adId`
- ad_name de `body.contact.attributionSource.adName`
- Canal detectado: sessionSource "Paid Social" → Tráfego Pago, tags "indicacao" → Indicação, etc.
- Campos opcionais (closer_id, ad_id, etc.) usam "SKIP" como placeholder para evitar erro de UUID vazio

**Arquivo do workflow:** `n8n-workflow-final-v2.json`

### Meta Ads → Supabase (n8n)

**Workflow:** "Meta Ads → Dashboard (Sync 2h)" (ativo)
**Account ID:** act_2851365261838044

**Fluxo a cada 2h:**
1. Calcular data de hoje
2. Buscar todos os anúncios (GET /ads) → Mapear → Upsert `ads_metadata`
3. Buscar insights do dia (GET /insights level=ad) → Mapear → Upsert `ads_performance`

**Dados coletados:** impressions, clicks, spend, actions (lead), ctr, cpc, frequency
**Dados históricos:** 937 registros de 01/01/2026 a 03/04/2026

**Arquivo do workflow:** `n8n-workflow-meta-ads-sync-2h.json`

### Relatório Semanal (n8n)

**Workflow:** "Relatório Semanal → WhatsApp"
**Schedule:** Segunda-feira 08h

**Fluxo:**
1. Buscar clientes ativos em `relatorio_config`
2. Para cada: calcular período (últimos 7 dias)
3. Chamar API /api/relatorio-semanal
4. Montar mensagem WhatsApp com métricas
5. (Pendente: enviar via Evolution API)

**Arquivo do workflow:** `n8n-workflow-relatorio-semanal.json`

### Triggers Supabase

1. **`trg_increment_leads`** — Quando lead inserido em `leads_crm`, incrementa `config_mensal.leads_totais`
2. **`trg_sync_lead_ads`** — Quando lead com ad_id inserido/atualizado em `leads_crm`, popula `leads_ads_attribution`
3. **`trg_log_stage`** — Quando `leads_ads_attribution.estagio_crm` muda, registra em `leads_stages_history`
4. **`trg_fill_lead_time`** — Preenche `hora_chegada` e `dia_semana` automaticamente (timezone America/Sao_Paulo)

---

## Banco de Dados (Supabase)

### Tabelas principais

```sql
-- Closers e time
closers (id, nome, ativo, nivel, salario_fixo, meta_ticket_medio, meta_conversao_reuniao)
sdrs (id, nome, ativo)
metas_closers (id, closer_id, mes_referencia, meta_contratos, meta_mrr, meta_ltv, meta_reunioes_feitas)
metas_sdr (id, sdr_id, mes_referencia, meta_contatos, meta_reunioes_agendadas, meta_reunioes_feitas, meta_taxa_no_show)
metas_mensais (id, mes_referencia, meta_entrada_valor, meta_faturamento_total, meta_contratos_fechados, meta_reunioes_agendadas, meta_reunioes_feitas)

-- Lançamentos e contratos
lancamentos_diarios (id, closer_id, data, reunioes_marcadas, reunioes_feitas, no_show, ganhos, mrr_dia, ltv, comissao_dia, obs, mes_referencia)
lancamentos_sdr (id, sdr_id, data, mes_referencia, leads_recebidos, contatos_realizados, conexoes_feitas, reunioes_agendadas, no_show, follow_ups_feitos, obs)
contratos (id, mes_referencia, closer_id, sdr_id, cliente_nome, origem_lead, valor_entrada, meses_contrato, mrr, valor_total_projeto[GENERATED], data_fechamento, obs)
config_mensal (id, mes_referencia, leads_totais, investimento)

-- CRM
leads_crm (id, ghl_contact_id, nome, etapa, closer_id, sdr_id, mes_referencia, ad_id, ad_name, canal_aquisicao, valor_entrada, mensalidade, fidelidade_meses, valor_total_projeto, data_venda, contrato_id, ...)
leads_crm_historico (id, lead_id, etapa_anterior, etapa_nova, changed_at)

-- Tráfego Pago
ads_metadata (ad_id[PK], ad_name, adset_id, adset_name, campaign_id, campaign_name, objetivo, status)
ads_performance (id, ad_id, data_ref, impressoes, cliques, spend, leads, cpl, ctr, cpc, frequencia, placement_breakdown[jsonb])
leads_ads_attribution (id, lead_id, ad_id, adset_id, campaign_id, nome_lead, telefone, email, hora_chegada, dia_semana, estagio_crm, receita_gerada)
leads_stages_history (id, lead_id, estagio_anterior, estagio_novo, alterado_em)

-- Configuração
alertas_config (id, tipo, threshold, campaign_id, ativo)
alertas_snooze (id, ad_id, tipo, snooze_ate)
relatorio_config (id, cliente_nome, whatsapp, dia_semana, hora, ativo)
recebimentos, reunioes_sdr
```

### Regras de dados importantes

- `contratos.valor_total_projeto` é coluna GENERATED (mrr × meses_contrato) — não editável diretamente
- `leads_crm.ghl_contact_id` é usado para upsert (merge-duplicates)
- `ads_performance` tem constraint UNIQUE(ad_id, data_ref) para upsert diário
- RLS habilitado em todas as tabelas com policy "Allow all" (sem auth por enquanto)

---

## Arquivos do Projeto

```
src/
├── app/
│   ├── layout.tsx                    # Root layout (ThemeProvider, AdminShell, Toaster)
│   ├── globals.css                   # Tailwind + print styles
│   ├── dashboard/page.tsx            # Dashboard principal (18 KPIs, alertas, funil, saúde)
│   ├── hoje/page.tsx                 # Visão de hoje (leads, reuniões, date picker)
│   ├── relatorio/page.tsx            # Relatório mensal (cards por mês)
│   ├── crm/page.tsx                  # CRM (tabela editável, dropdown etapa, auto-contrato)
│   ├── sdr/page.tsx                  # SDR (KPIs, pipeline, histórico, metas)
│   ├── closer/[id]/page.tsx          # Perfil do closer (13 KPIs, score, contratos)
│   ├── dashboard/closers/[id]/page.tsx # Análise do closer (diagnóstico, IA)
│   ├── lancamento/page.tsx           # Formulário de lançamento diário
│   ├── contratos/page.tsx            # Lista de contratos
│   ├── metas/page.tsx                # Metas por closer e SDR
│   ├── config/page.tsx               # Configurações gerais
│   ├── trafego/
│   │   ├── visao-geral/page.tsx      # KPIs + top anúncios + comparativo + tendência
│   │   ├── estrutura/page.tsx        # Drill-down campanhas→conjuntos→anúncios
│   │   ├── frequencia/page.tsx       # Heatmap hora×dia
│   │   ├── alertas/page.tsx          # Alertas operacionais (CPL, CTR, freq, zero leads)
│   │   ├── relatorio-auto/page.tsx   # Template WhatsApp + destinatários
│   │   ├── anuncios/page.tsx         # (legado, mantido como rota)
│   │   ├── campanhas/page.tsx        # (legado, mantido como rota)
│   │   └── conjuntos/page.tsx        # (legado, mantido como rota)
│   └── api/
│       ├── closer-analysis/route.ts  # POST — análise IA do closer (Claude API)
│       └── relatorio-semanal/route.ts # GET — dados do relatório semanal
├── components/
│   ├── admin-shell.tsx               # Layout principal (sidebar + tabs + main)
│   ├── sidebar.tsx                   # Menu lateral (5 itens + config no rodapé)
│   ├── page-tabs.tsx                 # Tabs horizontais por seção
│   ├── kpi-card.tsx                  # Card de KPI com trend (up/down/neutral)
│   ├── score-card.tsx                # Card de saúde do closer (gauge + detalhes)
│   ├── period-selector.tsx           # Seletor de período (mês/semana/dia/custom)
│   ├── trafego-filters.tsx           # Filtros de tráfego (período + status + campanha)
│   ├── dashboard-charts.tsx          # Gráficos do dashboard (progress, pie, bars)
│   ├── gauge-chart.tsx               # Gauge de metas
│   ├── fullscreen-modal.tsx          # Modal fullscreen (TV mode)
│   ├── month-selector.tsx            # Seletor de mês
│   └── theme-toggle.tsx              # Toggle dark/light
├── lib/
│   ├── kpis.ts                       # calcKpis() — cálculo centralizado de KPIs
│   ├── calculos.ts                   # calcularScore() — score de saúde do closer
│   ├── format.ts                     # formatCurrency, formatPercent, formatNumber, etc.
│   ├── supabase.ts                   # Cliente Supabase (browser)
│   └── utils.ts                      # cn() helper
├── hooks/
│   └── use-period-filter.ts          # Hook de período (mês/semana/dia/custom)
└── types/
    └── database.ts                   # Todos os tipos TypeScript das tabelas

# Raiz do projeto
.env.local                            # SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY, GHL_API_KEY, META_ADS_ACCESS_TOKEN, META_ADS_ACCOUNT_ID
schema.sql                            # Schema original (closers, lancamentos, config)
migration-v2.sql                       # Contratos, auth
migration-trafego-pago-v2.sql          # ads_metadata, ads_performance, leads_ads_attribution, leads_stages_history
migration-alertas-config.sql           # alertas_config, alertas_snooze, placement_breakdown
migration-relatorio-config.sql         # relatorio_config
migration-leads-attribution-trigger.sql # Triggers sync lead→ads + stage history
trigger-auto-leads-v2.sql              # Trigger auto-incremento leads_totais
migration-add-columns.sql              # meta_reunioes_feitas em metas_sdr

# Workflows n8n
n8n-workflow-final-v2.json             # GHL → Dashboard CRM
n8n-workflow-meta-ads-sync-2h.json     # Meta Ads sync a cada 2h
n8n-workflow-relatorio-semanal.json    # Relatório semanal WhatsApp
n8n-code-unico-v1.js                   # Código de referência do nó n8n
```

---

## Convenções e Regras

### Ortografia
- Textos visíveis ao usuário: português com acentuação correta (reunião, conversão, diagnóstico, etc.)
- Nomes de variáveis, propriedades e colunas do banco: sem acentos (reunioes_marcadas, percentLeadsReuniao)

### Fontes de dados (fonte única de verdade)
- **Leads (card KPI):** `config_mensal.leads_totais` — auto-incrementado por trigger
- **MRR:** `lancamentos_diarios.mrr_dia` (nunca contratos.mrr)
- **Ganhos/Contratos:** `lancamentos_diarios.ganhos` (nunca contratos.length)
- **LTV total:** `leads_crm.valor_total_projeto` onde etapa = comprou (fallback: lancamentos.ltv)
- **LTV per-closer:** `lancamentos_diarios.ltv`
- **Investimento:** `config_mensal.investimento`
- **Leads Meta Ads:** `ads_performance.leads` (com fallback `leads_ads_attribution`)

### Scores
- **Score de saúde do closer:** Taxa Conversão 35% + Meta 30% + Ticket 20% + Aproveitamento 15%
  - Meta zerada: ignora critério, redistribui peso proporcionalmente
  - Status: ≥70 Saudável, ≥45 Atenção, <45 Crítico

- **Score de anúncio:** CPL relativo 35% + CTR relativo 25% + Volume 20% + Qualificação CRM 20%
  - Badge: ≥70 verde, ≥40 amarelo, <40 vermelho

### Alertas de divergência
Dashboard verifica automaticamente:
- lancamentos.ganhos vs contratos.length
- lancamentos.ganhos vs leads_crm comprou count
- lancamentos.mrr vs contratos.mrr sum

### Real-time
Dashboard escuta via Supabase Realtime: leads_crm, lancamentos_diarios, contratos

### Dados de closers
- Mariana: `9b3edc8c-e5ce-450a-95b9-742f3c5c23b1`
- Rogério: `c8a5b749-b313-432e-ab4e-55bce924ec88`
- Lucas: `a987d655-88d0-490b-ad73-efe04843a2ec`

### Pipeline IDs (GHL)
- Lucas (Closer): `ZjrMXF5XMBSCZOorLeu8`
- Mariana (Closer): `ENg4tFVzJsUh8rHRntAX`
- Rogério (Closer): `8B7pjhZ4jv0e4u3JjtsR`
- SDR: `001UBPx2ijgQ9YLeO1jh`

### Supabase
- Project ref: `ogfnojbbvumujzfklkhh`
- URL: https://ogfnojbbvumujzfklkhh.supabase.co

### Meta Ads
- Account ID: `act_2851365261838044`
