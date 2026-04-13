# n8n Credentials Setup

Instruções para mover tokens hardcoded dos workflows para n8n Credentials.
**IMPORTANTE:** Não alterar os valores dos tokens. Apenas mover para Credentials.

## 1. Credentials a criar

### Credential 1: supabase-service-role

1. n8n → Settings → Credentials → **New Credential**
2. Tipo: **Header Auth**
3. Nome: `supabase-service-role`
4. Adicionar Headers:
   - `apikey` = `<valor atual do SUPABASE_SERVICE_ROLE_KEY usado nos workflows>`
   - `Authorization` = `Bearer <mesmo valor>`

### Credential 2: meta-ads-token

1. n8n → Settings → Credentials → **New Credential**
2. Tipo: **Header Auth**
3. Nome: `meta-ads-token`
4. Header:
   - `Authorization` = `Bearer <token atual da Meta usado nos workflows>`

## 2. Workflows a atualizar

### Workflow GHL→CRM (ID: 0NNG11ShxBhbUg9I)
Substituir nos nós:
- **Inserir Lead**: remover headers hardcoded `apikey` e `Authorization`, adicionar credential `supabase-service-role`
- **Inserir Historico**: mesmo procedimento

### Workflow Meta Ads (ID: GKc055ISEes1nQF6)
Substituir nos nós:
- **Buscar Anúncios**: remover `access_token` da query, usar credential `meta-ads-token` via Header Auth
- **Insights de Hoje**: mesmo procedimento
- **Upsert Metadata**: substituir headers por credential `supabase-service-role`
- **Upsert Performance**: mesmo procedimento

### Workflow Relatório Semanal (ID: LXaoQubYI6tGcuIi)
Substituir nos nós:
- **Buscar Clientes Ativos**: substituir headers por credential `supabase-service-role`

## 3. Completar workflow Relatório Semanal

O workflow está incompleto — após o nó "Montar Mensagem", adicionar:

### Nó novo: "Criar Notificação Gestor"
- Tipo: HTTP Request
- Método: POST
- URL: `https://ogfnojbbvumujzfklkhh.supabase.co/rest/v1/notif_operacional`
- Credential: `supabase-service-role`
- Headers adicionais:
  - `Prefer: return=representation`
- Body (JSON):
  ```json
  {
    "user_id": "{{$json.gestor_id}}",
    "tipo": "relatorio_disponivel",
    "titulo": "Relatório semanal: {{$json.cliente_nome}}",
    "mensagem": "{{$json.resumo_texto}}",
    "cliente_notion_id": "{{$json.cliente_notion_id}}",
    "url_destino": "/dashboard/clientes/{{$json.cliente_notion_id}}"
  }
  ```

### Nó novo antes de "Montar Mensagem": "Validar Dados"
- Tipo: Code (JavaScript)
- Código:
  ```js
  const item = $input.item.json;
  if (!item.resumo || item.resumo.total_leads === 0) {
    return {
      json: {
        ...item,
        tipo_notif: "sem_dados_relatorio",
        titulo: `Sem dados: ${item.cliente_nome}`,
        mensagem: "Não há dados suficientes para gerar o relatório desta semana."
      }
    };
  }
  return { json: { ...item, tipo_notif: "relatorio_disponivel" } };
  ```

## 4. Novos workflows a criar

### Workflow: Monitor Alertas Clientes (diário 9h)

**Trigger:** Schedule, toda manhã às 9h

**Nós:**
1. **Buscar Clientes Notion** — HTTP POST para `https://api.notion.com/v1/databases/2549240cff2d486fbd346c4b0ef2a3ae/query` com credential Notion
2. **Filtrar Piorando** — Code node: filtrar `situacao === "Piorando"` ou `resultados IN ["Ruins","Péssimos"]`
3. **Criar Notificações** — HTTP POST para `/rest/v1/notif_operacional` com tipo `cliente_piorando`

### Workflow: Monitor Tarefas Vencidas (diário 8h)

**Trigger:** Schedule 8h

**Nós:**
1. **Buscar Tarefas** — HTTP POST Notion DB `90cb5b1a-3b98-8314-9d40-07c3255ad22e` com filtro `Data de vencimento < hoje` AND `Status != Concluído`
2. **Criar Notificações** — POST `/rest/v1/notif_operacional` tipo `tarefa_vencida`

### Workflow: Monitor Onboarding SLA (diário 9h)

**Trigger:** Schedule 9h

**Nós:**
1. **Buscar Onboarding** — POST Notion DB `fffb5b1a-3b98-8165-9159-000b93d7c61f`
2. **Filtrar travados** — Code: `etapa != "Trabalho iniciado" AND last_edited_time < hoje - 3 dias`
3. **Criar Notificações** — POST `/rest/v1/notif_operacional` tipo `onboarding_parado`

## 5. Meta Ads multi-conta + paginação

### Atualizar workflow Meta Ads (GKc055ISEes1nQF6):

1. **Adicionar nó inicial**: HTTP GET `/rest/v1/ad_accounts?ativo=eq.true`
2. **SplitInBatches** sobre cada conta
3. Em cada batch, usar `{{$json.account_id}}` e `{{$json.access_token}}`
4. **Loop de paginação**: após "Buscar Anúncios", verificar `response.paging.cursors.after`, chamar novamente se existir
5. **Tratamento de erro**: cada HTTP Request com ramo de erro → POST `/rest/v1/workflow_errors`
