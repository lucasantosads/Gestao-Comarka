-- FALLBACK DE CRIACAO DE TABELAS AUSENTES (CRIADAS VIA INTERFACE/OPENAPI)

CREATE TABLE IF NOT EXISTS public."despesas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "data_lancamento" date,
  "descricao" text,
  "conta" text,
  "categoria" text,
  "valor" numeric,
  "tipo" text,
  "parcela_atual" integer,
  "parcelas_total" integer,
  "mes_referencia" text,
  "deleted_at" timestamptz,
  "created_at" timestamptz
);
ALTER TABLE public."despesas" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_despesas" ON public."despesas" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."clientes_receita" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text,
  "plataforma" text,
  "valor_mensal" numeric,
  "ltv_meses" integer,
  "closer" text,
  "tipo_contrato" text,
  "dia_pagamento" integer,
  "status" text,
  "mes_fechamento" date,
  "obs" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "categoria" text,
  "status_financeiro" text,
  "valor_integral" numeric,
  "forma_pagamento" text,
  "parcelas_integral" integer,
  "fidelidade_meses" integer,
  "fidelidade_inicio" date,
  "fidelidade_fim" date,
  "meta_campaign_id" text,
  "meta_adset_id" text,
  "nicho" text,
  "score_saude" integer,
  "score_calculado_em" timestamptz,
  "meta_leads_semana" integer,
  "risco_churn" text,
  "risco_churn_motivo" text,
  "risco_calculado_em" timestamptz
);
ALTER TABLE public."clientes_receita" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_clientes_receita" ON public."clientes_receita" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."folha_pagamento" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text,
  "cargo" text,
  "valor_mensal" numeric,
  "dia_vencimento" integer,
  "meio_pagamento" text,
  "ativo" boolean,
  "created_at" timestamptz
);
ALTER TABLE public."folha_pagamento" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_folha_pagamento" ON public."folha_pagamento" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."recebimentos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "contrato_id" uuid,
  "closer_id" uuid,
  "cliente_nome" text,
  "data_prevista" date,
  "data_recebida" date,
  "valor" numeric,
  "tipo" text,
  "status" text,
  "mes_referencia" text,
  "obs" text,
  "created_at" timestamptz
);
ALTER TABLE public."recebimentos" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_recebimentos" ON public."recebimentos" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."compensation_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid,
  "mes_referencia" text,
  "salario_base" numeric,
  "comissao_percentual" numeric,
  "comissao_base" text,
  "bonus_meta_atingida" numeric,
  "bonus_meta_superada_pct" numeric,
  "ote" numeric,
  "vale_alimentacao" numeric,
  "vale_transporte" numeric,
  "outros_beneficios" numeric,
  "descricao_beneficios" text,
  "created_at" timestamptz
);
ALTER TABLE public."compensation_config" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_compensation_config" ON public."compensation_config" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."creative_scores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ad_id" text,
  "ad_name" text,
  "campaign_id" text,
  "campaign_name" text,
  "adset_id" text,
  "adset_name" text,
  "total_leads" integer,
  "qualified_leads" integer,
  "disqualified_leads" integer,
  "meetings_scheduled" integer,
  "meetings_held" integer,
  "no_shows" integer,
  "proposals_sent" integer,
  "contracts_closed" integer,
  "total_mrr" numeric,
  "spend" numeric,
  "qualification_rate" numeric,
  "meeting_rate" numeric,
  "close_rate" numeric,
  "no_show_rate" numeric,
  "cac" numeric,
  "composite_score" numeric,
  "alert_status" text,
  "alert_message" text,
  "last_updated" timestamptz
);
ALTER TABLE public."creative_scores" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_creative_scores" ON public."creative_scores" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."kanban_cronometro_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "colaborador_id" uuid,
  "data" date,
  "duracao_min" integer,
  "tarefa_id" uuid,
  "created_at" timestamptz
);
ALTER TABLE public."kanban_cronometro_log" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_kanban_cronometro_log" ON public."kanban_cronometro_log" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."v_creative_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ad_id" text,
  "ad_name" text,
  "campaign_id" text,
  "campaign_name" text,
  "adset_id" text,
  "adset_name" text,
  "total_leads" integer,
  "qualified_leads" integer,
  "disqualified_leads" integer,
  "meetings_scheduled" integer,
  "meetings_held" integer,
  "no_shows" integer,
  "proposals_sent" integer,
  "contracts_closed" integer,
  "total_mrr" numeric,
  "spend" numeric,
  "qualification_rate" numeric,
  "meeting_rate" numeric,
  "close_rate" numeric,
  "no_show_rate" numeric,
  "cac" numeric,
  "composite_score" numeric,
  "alert_status" text,
  "alert_message" text,
  "last_updated" timestamptz
);
ALTER TABLE public."v_creative_alerts" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_v_creative_alerts" ON public."v_creative_alerts" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."ig_content_schedule" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "gerado_em" timestamptz,
  "gerado_por_analise" uuid,
  "data_sugerida" date,
  "hora_sugerida" text,
  "dia_semana_sugerido" text,
  "tipo_conteudo" text,
  "titulo_interno" text,
  "tema" text,
  "hook_sugerido" text,
  "hook_visual_sugerido" text,
  "estrutura_conteudo" text,
  "cta_sugerido" text,
  "legenda_sugerida" text,
  "hashtags_sugeridas" text,
  "por_que_esse_conteudo" text,
  "baseado_em" jsonb,
  "projecao_performance" jsonb,
  "status" text,
  "notion_page_id" text,
  "post_id_publicado" uuid,
  "observacoes" text,
  "criado_em" timestamptz,
  "atualizado_em" timestamptz
);
ALTER TABLE public."ig_content_schedule" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_ig_content_schedule" ON public."ig_content_schedule" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."asaas_pagamentos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "asaas_id" text,
  "cliente_id" uuid,
  "contrato_id" uuid,
  "descricao" text,
  "valor" numeric,
  "status" text,
  "data_vencimento" date,
  "data_pagamento" date,
  "tipo" text,
  "match_status" text,
  "match_tentativas" integer,
  "aprovacao_criacao_status" text,
  "aprovacao_criacao_por" uuid,
  "aprovacao_criacao_em" timestamptz,
  "aprovacao_recebimento_status" text,
  "aprovacao_recebimento_por" uuid,
  "aprovacao_recebimento_em" timestamptz,
  "criado_em" timestamptz,
  "atualizado_em" timestamptz,
  "deleted_at" timestamptz
);
ALTER TABLE public."asaas_pagamentos" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_asaas_pagamentos" ON public."asaas_pagamentos" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."custos_fixos_recorrentes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text,
  "tipo" text,
  "cargo" text,
  "valor" numeric,
  "dia_vencimento" integer,
  "ativo" boolean,
  "parcelas_total" integer,
  "parcelas_pagas" integer,
  "data_inicio" date,
  "data_fim" date,
  "created_at" timestamptz,
  "employee_id" uuid
);
ALTER TABLE public."custos_fixos_recorrentes" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_custos_fixos_recorrentes" ON public."custos_fixos_recorrentes" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."comarka_pro_feedbacks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "colaborador_id" uuid,
  "cliente_id" uuid,
  "descricao" text,
  "evidencia_url" text,
  "status" text,
  "aprovado_por" uuid,
  "aprovado_em" timestamptz,
  "mes_referencia" date,
  "deleted_at" timestamptz,
  "criado_em" timestamptz
);
ALTER TABLE public."comarka_pro_feedbacks" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_comarka_pro_feedbacks" ON public."comarka_pro_feedbacks" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."team_commission_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "colaborador_id" uuid,
  "cargo" text,
  "meta_reunioes_mes" integer,
  "meta_vendas_mes" numeric,
  "ote_base" numeric,
  "mes_referencia" date,
  "created_at" timestamptz,
  "updated_at" timestamptz
);
ALTER TABLE public."team_commission_config" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_team_commission_config" ON public."team_commission_config" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."ig_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "instagram_id" text,
  "tipo" text,
  "titulo" text,
  "legenda" text,
  "hook_texto" text,
  "hook_visual" text,
  "duracao_segundos" integer,
  "audio_tipo" text,
  "tem_cta_legenda" boolean,
  "tem_cta_audio" boolean,
  "publicado_em" timestamptz,
  "dia_semana" text,
  "hora_publicacao" integer,
  "url_midia" text,
  "thumbnail_url" text,
  "status" text,
  "criado_em" timestamptz,
  "atualizado_em" timestamptz,
  "published_weekday" integer,
  "published_weekday_name" text
);
ALTER TABLE public."ig_posts" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_ig_posts" ON public."ig_posts" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."sistema_rate_limit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "servico" text,
  "endpoint" text,
  "chamadas_hora" integer,
  "limite_hora" integer,
  "chamadas_dia" integer,
  "limite_dia" integer,
  "pct_utilizado" numeric,
  "data_hora" timestamptz
);
ALTER TABLE public."sistema_rate_limit_log" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_sistema_rate_limit_log" ON public."sistema_rate_limit_log" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."metas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" uuid,
  "mes_referencia" date,
  "tipo_meta" text,
  "valor_meta" numeric,
  "criado_em" timestamptz
);
ALTER TABLE public."metas" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_metas" ON public."metas" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."tarefas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "titulo" text,
  "descricao" text,
  "criado_por" uuid,
  "atribuido_para" uuid,
  "status" text,
  "prioridade" text,
  "prazo" timestamptz,
  "iniciado_em" timestamptz,
  "concluido_em" timestamptz,
  "tipo" text,
  "created_at" timestamptz,
  "updated_at" timestamptz
);
ALTER TABLE public."tarefas" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_tarefas" ON public."tarefas" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."clientes_teses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "notion_id" text,
  "tese" text,
  "orcamento" numeric,
  "ordem" integer,
  "created_at" timestamptz,
  "nome_tese" text,
  "tipo" text,
  "publico_alvo" text,
  "status" text,
  "data_ativacao" date,
  "observacoes" text,
  "deleted_at" timestamptz
);
ALTER TABLE public."clientes_teses" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_clientes_teses" ON public."clientes_teses" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."vw_posts_performance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "instagram_id" text,
  "tipo" text,
  "titulo" text,
  "hook_texto" text,
  "publicado_em" timestamptz,
  "hora_publicacao" integer,
  "dia_semana" text,
  "duracao_segundos" integer,
  "audio_tipo" text,
  "impressoes" integer,
  "alcance" integer,
  "plays" integer,
  "curtidas" integer,
  "comentarios" integer,
  "compartilhamentos" integer,
  "salvamentos" integer,
  "envios_dm" integer,
  "views_3s" integer,
  "views_completas" integer,
  "taxa_gancho_3s" numeric,
  "taxa_conclusao" numeric,
  "taxa_engajamento" numeric,
  "ratio_envio_curtida" numeric,
  "score_viral" numeric,
  "idade_horas" integer,
  "score_hook" numeric,
  "score_geral" numeric,
  "nivel_performance" text,
  "melhor_janela_horas" integer
);
ALTER TABLE public."vw_posts_performance" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_vw_posts_performance" ON public."vw_posts_performance" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."sistema_integracao_status" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text,
  "status" text,
  "ultimo_ping_em" timestamptz,
  "ultimo_ping_sucesso_em" timestamptz,
  "latencia_ms" integer,
  "latencia_media_ms" integer,
  "mensagem_erro" text,
  "atualizado_em" timestamptz
);
ALTER TABLE public."sistema_integracao_status" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_sistema_integracao_status" ON public."sistema_integracao_status" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome_lead" text,
  "origem" text,
  "status" text,
  "sdr_responsavel_id" uuid,
  "closer_responsavel_id" uuid,
  "data_entrada" timestamptz,
  "data_ultimo_contato" timestamptz,
  "motivo_perda" text,
  "observacoes" text,
  "criado_em" timestamptz,
  "atualizado_em" timestamptz
);
ALTER TABLE public."leads" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_leads" ON public."leads" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."alertas_cliente" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cliente_notion_id" text,
  "tipo" text,
  "mensagem" text,
  "criado_em" timestamptz,
  "resolvido_em" timestamptz,
  "notificado_whatsapp" boolean,
  "metadata" jsonb
);
ALTER TABLE public."alertas_cliente" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_alertas_cliente" ON public."alertas_cliente" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."comarka_pro_pontos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "colaborador_id" uuid,
  "mes_referencia" date,
  "temporada_id" uuid,
  "pontos_brutos" integer,
  "multiplicador_ativo" numeric,
  "pontos_finais" integer,
  "meses_sequencia" integer,
  "atualizado_em" timestamptz
);
ALTER TABLE public."comarka_pro_pontos" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_comarka_pro_pontos" ON public."comarka_pro_pontos" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."vw_churn_mensal" (
  "mes_referencia" text,
  "clientes_inicio_mes" integer,
  "clientes_cancelados" integer,
  "churn_rate" numeric,
  "mrr_perdido" numeric,
  "mrr_churn_rate" numeric
);
ALTER TABLE public."vw_churn_mensal" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_vw_churn_mensal" ON public."vw_churn_mensal" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."custos_operacionais" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mes_referencia" date,
  "categoria" text,
  "valor" numeric,
  "descricao" text,
  "recorrente" boolean,
  "created_at" timestamptz
);
ALTER TABLE public."custos_operacionais" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_custos_operacionais" ON public."custos_operacionais" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."client_feedbacks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cliente_notion_id" text,
  "gestor_id" uuid,
  "data_feedback" date,
  "n_contratos" integer,
  "contratos_nao_informado" boolean,
  "faturamento" numeric,
  "faturamento_nao_informado" boolean,
  "data_envio_feedback" date,
  "envio_nao_informado" boolean,
  "observacoes" text,
  "created_at" timestamptz
);
ALTER TABLE public."client_feedbacks" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_client_feedbacks" ON public."client_feedbacks" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."projecoes_historico_acuracia" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mes_referencia" date,
  "mrr_projetado" numeric,
  "mrr_realizado" numeric,
  "contratos_projetados" integer,
  "contratos_realizados" integer,
  "leads_projetados" integer,
  "leads_realizados" integer,
  "acuracia_mrr" numeric,
  "acuracia_contratos" numeric,
  "acuracia_leads" numeric,
  "acuracia_media" numeric,
  "calculado_em" timestamptz,
  "deleted_at" timestamptz
);
ALTER TABLE public."projecoes_historico_acuracia" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_projecoes_historico_acuracia" ON public."projecoes_historico_acuracia" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."onboarding_notion_mirror" (
  "notion_id" text,
  "nome" text,
  "etapa" text,
  "plataformas" text,
  "orcamento_mensal" numeric,
  "gestor_trafego" text,
  "gestor_junior" text,
  "head_trafego" text,
  "comercial" text,
  "sucesso_cliente" text,
  "produto" text,
  "raw_properties" jsonb,
  "ultimo_sync_em" timestamptz,
  "editado_em" timestamptz
);
ALTER TABLE public."onboarding_notion_mirror" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_onboarding_notion_mirror" ON public."onboarding_notion_mirror" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."metas_social_selling" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "social_seller_id" uuid,
  "mes_referencia" text,
  "meta_reunioes_agendadas" integer,
  "meta_vendas" integer,
  "meta_conexoes" integer
);
ALTER TABLE public."metas_social_selling" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_metas_social_selling" ON public."metas_social_selling" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."comarka_pro_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "temporada_atual" integer,
  "premio_mensal_1" numeric,
  "premio_mensal_2" numeric,
  "premio_mensal_3" numeric,
  "premio_trimestral_1" numeric,
  "premio_trimestral_2" numeric,
  "premio_trimestral_3" numeric,
  "premio_semestral_1" numeric,
  "premio_semestral_2" numeric,
  "premio_semestral_3" numeric,
  "premio_anual_1" numeric,
  "premio_anual_2" numeric,
  "premio_anual_3" numeric,
  "multiplicador_sequencia" numeric,
  "meses_sequencia_necessarios" integer,
  "atualizado_em" timestamptz
);
ALTER TABLE public."comarka_pro_config" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_comarka_pro_config" ON public."comarka_pro_config" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."lancamentos_sdr" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sdr_id" uuid,
  "data" date,
  "mes_referencia" text,
  "leads_recebidos" integer,
  "contatos_realizados" integer,
  "conexoes_feitas" integer,
  "reunioes_agendadas" integer,
  "no_show" integer,
  "follow_ups_feitos" integer,
  "obs" text
);
ALTER TABLE public."lancamentos_sdr" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_lancamentos_sdr" ON public."lancamentos_sdr" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."custos_fixos_pagamentos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "custo_fixo_id" uuid,
  "tipo" text,
  "mes_referencia" text,
  "status" text,
  "pago_em" timestamptz,
  "valor_pago" numeric,
  "observacao" text,
  "criado_por" text,
  "created_at" timestamptz,
  "updated_at" timestamptz
);
ALTER TABLE public."custos_fixos_pagamentos" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_custos_fixos_pagamentos" ON public."custos_fixos_pagamentos" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."clientes_status_historico" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cliente_id" uuid,
  "status_anterior" text,
  "status_novo" text,
  "alterado_por" uuid,
  "motivo" text,
  "criado_em" timestamptz
);
ALTER TABLE public."clientes_status_historico" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_clientes_status_historico" ON public."clientes_status_historico" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."payment_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid,
  "mes_referencia" text,
  "salario_base" numeric,
  "comissao_calculada" numeric,
  "bonus" numeric,
  "beneficios" numeric,
  "descontos" numeric,
  "descricao_descontos" text,
  "total_liquido" numeric,
  "status" text,
  "data_pagamento" date,
  "obs" text,
  "created_at" timestamptz
);
ALTER TABLE public."payment_history" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_payment_history" ON public."payment_history" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."registros_diarios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" uuid,
  "data" date,
  "funcao_no_dia" text,
  "dados" jsonb,
  "criado_em" timestamptz
);
ALTER TABLE public."registros_diarios" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_registros_diarios" ON public."registros_diarios" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."trilha_cargos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text,
  "nivel" integer,
  "descricao" text,
  "kpis" jsonb,
  "created_at" timestamptz
);
ALTER TABLE public."trilha_cargos" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_trilha_cargos" ON public."trilha_cargos" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."v_funnel_by_ad" (
  "ad_id" text,
  "entradas" integer,
  "qualificados" integer,
  "desqualificados" integer,
  "reunioes_agendadas" integer,
  "reunioes_realizadas" integer,
  "no_shows" integer,
  "propostas" integer,
  "contratos" integer,
  "mrr_total" numeric
);
ALTER TABLE public."v_funnel_by_ad" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_v_funnel_by_ad" ON public."v_funnel_by_ad" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."team_notion_mirror" (
  "notion_id" text,
  "nome" text,
  "cargo" text,
  "funcoes" text,
  "email" text,
  "telefone" text,
  "status" text,
  "drive" text,
  "raw_properties" jsonb,
  "ultimo_sync_em" timestamptz,
  "editado_em" timestamptz
);
ALTER TABLE public."team_notion_mirror" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_team_notion_mirror" ON public."team_notion_mirror" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."tarefas_kanban" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "titulo" text,
  "descricao" text,
  "responsavel" text,
  "solicitante" text,
  "cliente" text,
  "setor" text,
  "urgencia" text,
  "status" text,
  "data_vencimento" date,
  "total_segundos" integer,
  "em_andamento" boolean,
  "ultimo_inicio" timestamptz,
  "iniciado_em" timestamptz,
  "finalizado_em" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "cronometro_encerrado" boolean
);
ALTER TABLE public."tarefas_kanban" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_tarefas_kanban" ON public."tarefas_kanban" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."employees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text,
  "email" text,
  "usuario" text,
  "senha_hash" text,
  "role" text,
  "entity_id" uuid,
  "ativo" boolean,
  "foto_url" text,
  "telefone" text,
  "data_admissao" date,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "cargo" text,
  "senha_visivel" text,
  "cargo_nivel" text,
  "is_head_operacional" boolean,
  "is_gestor_trafego" boolean
);
ALTER TABLE public."employees" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_employees" ON public."employees" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."onboarding_tracking" (
  "notion_id" text,
  "cliente_nome" text,
  "iniciado_em" timestamptz,
  "finalizado_em" timestamptz,
  "tempo_total_segundos" integer,
  "etapa_atual" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "etapa_entrada_em" timestamptz,
  "checklist_total" integer,
  "checklist_done" integer
);
ALTER TABLE public."onboarding_tracking" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_onboarding_tracking" ON public."onboarding_tracking" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."comarka_pro_temporadas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "numero" integer,
  "ano" integer,
  "trimestre" integer,
  "inicio" date,
  "fim" date,
  "encerrada" boolean,
  "criado_em" timestamptz
);
ALTER TABLE public."comarka_pro_temporadas" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_comarka_pro_temporadas" ON public."comarka_pro_temporadas" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."onboarding_checklist_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "notion_id" text,
  "template_item_id" uuid,
  "secao" text,
  "texto" text,
  "ordem" integer,
  "checked" boolean,
  "checked_at" timestamptz,
  "created_at" timestamptz
);
ALTER TABLE public."onboarding_checklist_items" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_onboarding_checklist_items" ON public."onboarding_checklist_items" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."asaas_auditoria" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pagamento_id" uuid,
  "acao" text,
  "executado_por" uuid,
  "observacao" text,
  "ip_sessao" text,
  "criado_em" timestamptz,
  "deleted_at" timestamptz
);
ALTER TABLE public."asaas_auditoria" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_asaas_auditoria" ON public."asaas_auditoria" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."ig_metric_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" uuid,
  "tipo_evento" text,
  "ocorreu_em" timestamptz,
  "horas_pos_pub" numeric,
  "quantidade" integer,
  "fonte" text
);
ALTER TABLE public."ig_metric_events" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_ig_metric_events" ON public."ig_metric_events" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."reunioes_cliente" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cliente_notion_id" text,
  "tipo" text,
  "data_reuniao" timestamptz,
  "link_gravacao" text,
  "transcricao" text,
  "resumo_ia" text,
  "resumo_gerado_em" timestamptz,
  "notas" text,
  "status" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "snapshot_metricas" jsonb,
  "gestor_id" uuid
);
ALTER TABLE public."reunioes_cliente" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_reunioes_cliente" ON public."reunioes_cliente" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."comarka_pro_lancamentos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "colaborador_id" uuid,
  "mes_referencia" date,
  "categoria" text,
  "pontos" integer,
  "descricao" text,
  "origem" text,
  "referencia_id" uuid,
  "aprovado_por" uuid,
  "cliente_id" uuid,
  "deleted_at" timestamptz,
  "criado_em" timestamptz
);
ALTER TABLE public."comarka_pro_lancamentos" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_comarka_pro_lancamentos" ON public."comarka_pro_lancamentos" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."parcelamentos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "descricao" text,
  "valor_parcela" numeric,
  "dia_vencimento" integer,
  "meio_pagamento" text,
  "parcela_atual" integer,
  "parcelas_total" integer,
  "categoria" text,
  "ativo" boolean,
  "created_at" timestamptz
);
ALTER TABLE public."parcelamentos" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_parcelamentos" ON public."parcelamentos" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."clientes_notion_mirror" (
  "notion_id" text,
  "cliente" text,
  "status" text,
  "situacao" text,
  "resultados" text,
  "atencao" text,
  "nicho" text,
  "analista" text,
  "orcamento" numeric,
  "dia_otimizar" text,
  "ultimo_feedback" date,
  "otimizacao" date,
  "pagamento" text,
  "automacao" boolean,
  "fb_url" text,
  "gads_url" text,
  "tiktok_url" text,
  "raw_properties" jsonb,
  "ultimo_sync_em" timestamptz,
  "editado_em" timestamptz,
  "entrada_id" uuid,
  "orcamento_inicial" numeric,
  "orcamento_atualizado_em" timestamptz,
  "meta_campaign_id" text,
  "meta_adset_id" text,
  "meta_leads_mes" integer,
  "meta_leads_semana" integer,
  "meta_roas_minimo" numeric,
  "score_saude" integer,
  "score_calculado_em" timestamptz,
  "risco_churn" text,
  "risco_churn_motivo" text,
  "risco_churn_acao" text,
  "risco_calculado_em" timestamptz
);
ALTER TABLE public."clientes_notion_mirror" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_clientes_notion_mirror" ON public."clientes_notion_mirror" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."vw_ranking_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tipo" text,
  "titulo" text,
  "hook_texto" text,
  "publicado_em" timestamptz,
  "hora_publicacao" integer,
  "dia_semana" text,
  "audio_tipo" text,
  "tem_cta_legenda" boolean,
  "taxa_gancho_3s" numeric,
  "taxa_conclusao" numeric,
  "taxa_engajamento" numeric,
  "ratio_envio_curtida" numeric,
  "envios_dm" integer,
  "salvamentos" integer,
  "plays" integer,
  "score_geral" numeric,
  "nivel_performance" text,
  "rank_engajamento" integer,
  "rank_gancho" integer,
  "rank_conversao" integer
);
ALTER TABLE public."vw_ranking_posts" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_vw_ranking_posts" ON public."vw_ranking_posts" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."reunioes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lead_id" uuid,
  "tipo" text,
  "data_hora" timestamptz,
  "sdr_id" uuid,
  "closer_id" uuid,
  "qualidade_reuniao" integer,
  "observacoes" text,
  "criado_em" timestamptz
);
ALTER TABLE public."reunioes" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_reunioes" ON public."reunioes" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."vw_curva_crescimento" (
  "post_id" uuid,
  "tipo" text,
  "titulo" text,
  "publicado_em" timestamptz,
  "horas_desde_publicacao" integer,
  "plays" integer,
  "curtidas" integer,
  "envios_dm" integer,
  "salvamentos" integer,
  "taxa_gancho_3s" numeric,
  "taxa_engajamento" numeric
);
ALTER TABLE public."vw_curva_crescimento" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_vw_curva_crescimento" ON public."vw_curva_crescimento" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."metricas_trafego" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "data" date,
  "canal" text,
  "investimento" numeric,
  "leads_gerados" integer,
  "cpl" numeric,
  "criado_em" timestamptz
);
ALTER TABLE public."metricas_trafego" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_metricas_trafego" ON public."metricas_trafego" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."usuarios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text,
  "email" text,
  "funcao" text,
  "telefone_whatsapp" text,
  "ativo" boolean,
  "criado_em" timestamptz
);
ALTER TABLE public."usuarios" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_usuarios" ON public."usuarios" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."alertas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tipo" text,
  "severidade" text,
  "titulo" text,
  "descricao" text,
  "closer_id" uuid,
  "resolvido" boolean,
  "criado_em" timestamptz,
  "resolvido_em" timestamptz
);
ALTER TABLE public."alertas" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_alertas" ON public."alertas" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."ig_stories" (
  "story_id" text,
  "account_id" text,
  "media_type" text,
  "media_url" text,
  "timestamp" timestamptz,
  "expire_time" timestamptz,
  "collected_at" timestamptz
);
ALTER TABLE public."ig_stories" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_ig_stories" ON public."ig_stories" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."pagamentos_mensais" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cliente_id" uuid,
  "mes_referencia" date,
  "valor_pago" numeric,
  "dia_pagamento" integer,
  "status" text,
  "created_at" timestamptz,
  "justificativa" text,
  "mes_pagamento" text,
  "valor_esperado" numeric
);
ALTER TABLE public."pagamentos_mensais" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_pagamentos_mensais" ON public."pagamentos_mensais" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."projecoes_alertas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mes_referencia" date,
  "tipo" text,
  "mensagem" text,
  "deficit" numeric,
  "acoes_sugeridas" jsonb,
  "visualizado" boolean,
  "criado_em" timestamptz,
  "deleted_at" timestamptz
);
ALTER TABLE public."projecoes_alertas" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_projecoes_alertas" ON public."projecoes_alertas" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."metas_mensais" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mes_referencia" text,
  "meta_entrada_valor" numeric,
  "meta_faturamento_total" numeric,
  "meta_contratos_fechados" integer,
  "meta_reunioes_agendadas" integer,
  "meta_reunioes_feitas" integer,
  "meta_taxa_no_show" numeric,
  "leads_totais" integer,
  "valor_investido_anuncios" numeric,
  "custo_por_reuniao" numeric,
  "meses_padrao_contrato" integer,
  "created_at" timestamptz
);
ALTER TABLE public."metas_mensais" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_metas_mensais" ON public."metas_mensais" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."clientes_extra" (
  "notion_id" text,
  "nome" text,
  "meta_account_id" text,
  "meta_account_name" text,
  "meta_access_ativo" boolean,
  "google_customer_id" text,
  "google_account_name" text,
  "google_access_ativo" boolean,
  "whatsapp_group_url" text,
  "whatsapp_resumo" text,
  "whatsapp_ultima_atualizacao" timestamptz,
  "saude_score" integer,
  "saude_observacao" text,
  "saude_tendencia" text,
  "ultima_analise_ia" text,
  "ultima_analise_ia_em" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "briefing" jsonb,
  "briefing_preenchido_em" timestamptz,
  "ultima_verificacao" timestamptz,
  "nicho" text
);
ALTER TABLE public."clientes_extra" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_clientes_extra" ON public."clientes_extra" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."clientes_meta_historico" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cliente_notion_id" text,
  "meta_campaign_id" text,
  "meta_adset_id" text,
  "vigencia_inicio" date,
  "vigencia_fim" date,
  "criado_em" timestamptz
);
ALTER TABLE public."clientes_meta_historico" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_clientes_meta_historico" ON public."clientes_meta_historico" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."vw_melhores_horarios" (
  "dia_semana" text,
  "hora_publicacao" integer,
  "total_posts" integer,
  "media_engajamento" numeric,
  "media_envios" numeric,
  "media_plays" numeric,
  "media_gancho" numeric
);
ALTER TABLE public."vw_melhores_horarios" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_vw_melhores_horarios" ON public."vw_melhores_horarios" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."colaboradores_punicoes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid,
  "descricao" text,
  "data_ocorrencia" date,
  "registrado_por" uuid,
  "deleted_at" timestamptz,
  "created_at" timestamptz
);
ALTER TABLE public."colaboradores_punicoes" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_colaboradores_punicoes" ON public."colaboradores_punicoes" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."team_members_profile" (
  "notion_id" text,
  "employee_id" uuid,
  "foto_url" text,
  "data_entrada" date,
  "chave_pix" text,
  "contrato_url" text,
  "cargo" text,
  "salario_base" numeric,
  "handbook_url" text,
  "bio" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "ote" numeric,
  "cargo_nivel" integer,
  "data_renovacao_contrato" date
);
ALTER TABLE public."team_members_profile" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_team_members_profile" ON public."team_members_profile" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."sistema_backups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "status" text,
  "tabelas_incluidas" text,
  "tamanho_bytes" integer,
  "google_drive_file_id" text,
  "google_drive_url" text,
  "mensagem_erro" text,
  "iniciado_em" timestamptz,
  "concluido_em" timestamptz
);
ALTER TABLE public."sistema_backups" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_sistema_backups" ON public."sistema_backups" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."metas_sdr" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sdr_id" uuid,
  "mes_referencia" text,
  "meta_contatos" integer,
  "meta_conexoes" integer,
  "meta_reunioes_agendadas" integer,
  "meta_taxa_no_show" numeric,
  "meta_taxa_conexao" numeric,
  "meta_taxa_agendamento" numeric,
  "meta_reunioes_feitas" integer
);
ALTER TABLE public."metas_sdr" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_metas_sdr" ON public."metas_sdr" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."leads_crm_historico" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lead_id" uuid,
  "etapa_anterior" text,
  "etapa_nova" text,
  "changed_at" timestamptz,
  "obs" text
);
ALTER TABLE public."leads_crm_historico" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_leads_crm_historico" ON public."leads_crm_historico" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."ig_content_analysis" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" uuid,
  "analisado_em" timestamptz,
  "versao_analise" integer,
  "score_hook" numeric,
  "score_retencao" numeric,
  "score_engajamento" numeric,
  "score_conversao" numeric,
  "score_geral" numeric,
  "nivel_performance" text,
  "publico_respondeu" text,
  "melhor_janela_horas" integer,
  "o_que_funcionou" jsonb,
  "o_que_nao_funcionou" jsonb,
  "padroes_detectados" jsonb,
  "recomendacoes" jsonb,
  "vs_media_tipo" jsonb,
  "vs_media_geral" jsonb,
  "relatorio_completo" text,
  "notion_page_id" text
);
ALTER TABLE public."ig_content_analysis" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_ig_content_analysis" ON public."ig_content_analysis" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."sistema_config_historico" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tabela" text,
  "campo" text,
  "objeto_id" text,
  "valor_anterior" jsonb,
  "valor_novo" jsonb,
  "alterado_por" uuid,
  "criado_em" timestamptz
);
ALTER TABLE public."sistema_config_historico" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_sistema_config_historico" ON public."sistema_config_historico" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."tarefas_comentarios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tarefa_id" uuid,
  "autor_id" uuid,
  "texto" text,
  "created_at" timestamptz
);
ALTER TABLE public."tarefas_comentarios" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_tarefas_comentarios" ON public."tarefas_comentarios" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."colaboradores_beneficios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid,
  "nome" text,
  "valor" numeric,
  "ativo" boolean,
  "created_at" timestamptz
);
ALTER TABLE public."colaboradores_beneficios" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_colaboradores_beneficios" ON public."colaboradores_beneficios" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."ig_stories_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "story_id" text,
  "collected_at" timestamptz,
  "impressions" integer,
  "reach" integer,
  "taps_forward" integer,
  "taps_back" integer,
  "exits" integer,
  "replies" integer
);
ALTER TABLE public."ig_stories_metrics" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_ig_stories_metrics" ON public."ig_stories_metrics" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."projecoes_cenarios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mes_referencia" date,
  "nome" text,
  "orcamento_meta" numeric,
  "noshow_rate" numeric,
  "taxa_qualificacao" numeric,
  "taxa_reuniao" numeric,
  "taxa_fechamento" numeric,
  "closers_ativos" integer,
  "leads_projetados" integer,
  "qualificados_projetados" integer,
  "reunioes_projetadas" integer,
  "propostas_projetadas" integer,
  "contratos_projetados" integer,
  "mrr_projetado" numeric,
  "investimento_projetado" numeric,
  "cac_projetado" numeric,
  "is_simulacao" boolean,
  "criado_em" timestamptz,
  "deleted_at" timestamptz
);
ALTER TABLE public."projecoes_cenarios" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_projecoes_cenarios" ON public."projecoes_cenarios" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."leads_crm" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ghl_contact_id" text,
  "ghl_pipeline_id" text,
  "ghl_opportunity_id" text,
  "ad_id" text,
  "ad_name" text,
  "adset_id" text,
  "adset_name" text,
  "campaign_id" text,
  "campaign_name" text,
  "nome" text,
  "telefone" text,
  "email" text,
  "origem" text,
  "closer_id" uuid,
  "sdr_id" uuid,
  "mes_referencia" text,
  "etapa" text,
  "data_reuniao_agendada" timestamptz,
  "data_proposta_enviada" timestamptz,
  "data_follow_up" timestamptz,
  "data_assinatura" timestamptz,
  "data_comprou" timestamptz,
  "data_desistiu" timestamptz,
  "motivo_desistencia" text,
  "resumo_reuniao" text,
  "pontos_positivos" text,
  "objecoes" text,
  "proximo_passo" text,
  "contrato_id" uuid,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "canal_aquisicao" text,
  "valor_entrada" numeric,
  "mensalidade" numeric,
  "fidelidade_meses" integer,
  "valor_total_projeto" numeric,
  "data_venda" date,
  "notion_page_id" text,
  "agendamento" timestamptz,
  "area_atuacao" text,
  "instagram" text,
  "site" text,
  "link_proposta" text,
  "faturamento" numeric,
  "qualidade_lead" text,
  "funil" text,
  "origem_utm" text,
  "primeiro_contato" date,
  "follow_up_1" date,
  "follow_up_2" date,
  "preenchido_em" timestamptz,
  "lead_id" text,
  "data_negociacao" timestamptz,
  "data_no_show" timestamptz,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "utm_content" text,
  "ctwa_clid" text,
  "session_source" text,
  "ghl_created_at" timestamptz
);
ALTER TABLE public."leads_crm" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_leads_crm" ON public."leads_crm" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."financeiro_fluxo_caixa" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mes_referencia" date,
  "cenario" text,
  "receita_projetada" numeric,
  "custos_projetados" numeric,
  "resultado_projetado" numeric,
  "churn_impacto" numeric,
  "detalhamento" jsonb,
  "calculado_em" timestamptz,
  "deleted_at" timestamptz
);
ALTER TABLE public."financeiro_fluxo_caixa" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_financeiro_fluxo_caixa" ON public."financeiro_fluxo_caixa" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."ig_metrics_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" uuid,
  "capturado_em" timestamptz,
  "horas_desde_publicacao" integer,
  "impressoes" integer,
  "alcance" integer,
  "plays" integer,
  "plays_unicos" integer,
  "views_3s" integer,
  "views_completas" integer,
  "retencao_media_pct" numeric,
  "curtidas" integer,
  "comentarios" integer,
  "compartilhamentos" integer,
  "salvamentos" integer,
  "envios_dm" integer,
  "cliques_perfil" integer,
  "cliques_link_bio" integer,
  "cliques_sticker" integer,
  "taxa_gancho_3s" numeric,
  "taxa_conclusao" numeric,
  "taxa_engajamento" numeric,
  "ratio_envio_curtida" numeric,
  "score_viral" numeric,
  "avg_watch_time_ms" integer,
  "avg_watch_time_seconds" numeric,
  "video_views" integer,
  "ig_reels_video_view_total_time" integer,
  "completion_rate" numeric,
  "content_score" numeric
);
ALTER TABLE public."ig_metrics_snapshots" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_ig_metrics_snapshots" ON public."ig_metrics_snapshots" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."resumos_cliente" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cliente_notion_id" text,
  "tipo" text,
  "conteudo" text,
  "periodo_inicio" date,
  "periodo_fim" date,
  "created_at" timestamptz
);
ALTER TABLE public."resumos_cliente" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_resumos_cliente" ON public."resumos_cliente" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."sdrs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text,
  "ativo" boolean,
  "created_at" timestamptz
);
ALTER TABLE public."sdrs" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_sdrs" ON public."sdrs" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."vw_medias_por_tipo" (
  "tipo" text,
  "total_posts" integer,
  "media_taxa_gancho" numeric,
  "media_taxa_conclusao" numeric,
  "media_taxa_engajamento" numeric,
  "media_ratio_envio" numeric,
  "media_curtidas" numeric,
  "media_envios_dm" numeric,
  "media_salvamentos" numeric,
  "media_plays" numeric
);
ALTER TABLE public."vw_medias_por_tipo" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_vw_medias_por_tipo" ON public."vw_medias_por_tipo" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."churn_consistencia_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mes_referencia" date,
  "total_ativos_entrada" integer,
  "total_ativos_churn" integer,
  "divergencia" integer,
  "clientes_divergentes" jsonb,
  "status" text,
  "resolvido" boolean,
  "criado_em" timestamptz
);
ALTER TABLE public."churn_consistencia_log" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_churn_consistencia_log" ON public."churn_consistencia_log" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."ghl_sdr_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tipo" text,
  "msg" text,
  "count" integer,
  "created_at" timestamptz
);
ALTER TABLE public."ghl_sdr_alerts" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_ghl_sdr_alerts" ON public."ghl_sdr_alerts" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."reunioes_sdr" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sdr_id" uuid,
  "closer_id" uuid,
  "lead_nome" text,
  "data_reuniao" date,
  "mes_referencia" text,
  "status" text,
  "contrato_id" uuid,
  "obs" text,
  "created_at" timestamptz
);
ALTER TABLE public."reunioes_sdr" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_reunioes_sdr" ON public."reunioes_sdr" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."client_nps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cliente_notion_id" text,
  "gestor_id" uuid,
  "nps_score" integer,
  "nps_comentario" text,
  "mes_referencia" date,
  "created_at" timestamptz
);
ALTER TABLE public."client_nps" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_client_nps" ON public."client_nps" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."financeiro_exportacoes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mes_referencia" date,
  "tipo" text,
  "gerado_por" uuid,
  "url" text,
  "criado_em" timestamptz,
  "deleted_at" timestamptz
);
ALTER TABLE public."financeiro_exportacoes" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_financeiro_exportacoes" ON public."financeiro_exportacoes" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."custos_fixos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "descricao" text,
  "valor" numeric,
  "dia_vencimento" integer,
  "meio_pagamento" text,
  "categoria" text,
  "ativo" boolean,
  "created_at" timestamptz
);
ALTER TABLE public."custos_fixos" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_custos_fixos" ON public."custos_fixos" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."metas_closers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mes_referencia" text,
  "closer_id" uuid,
  "meta_contratos" integer,
  "meta_mrr" numeric,
  "meta_reunioes_feitas" integer,
  "meta_taxa_no_show" numeric,
  "meta_ltv" numeric,
  "meta_sugerida_ia" numeric,
  "meta_sugerida_justificativa" text
);
ALTER TABLE public."metas_closers" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_metas_closers" ON public."metas_closers" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."otimizacoes_historico" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "notion_id" text,
  "data" date,
  "comentarios" text,
  "feito" text,
  "proxima_vez" text,
  "solicitado" text,
  "fonte" text,
  "created_at" timestamptz,
  "deleted_at" timestamptz,
  "data_confirmacao" timestamptz,
  "snapshot_metricas" jsonb,
  "updated_at" timestamptz
);
ALTER TABLE public."otimizacoes_historico" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_otimizacoes_historico" ON public."otimizacoes_historico" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."clientes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" text,
  "email" text,
  "telefone" text,
  "data_inicio" date,
  "data_cancelamento" date,
  "status" text,
  "motivo_cancelamento" text,
  "observacao" text,
  "mrr" numeric,
  "closer_id" uuid,
  "contrato_id" uuid,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "etapa_churn" text,
  "gestor_id" uuid,
  "status_anterior" text,
  "risco_churn" text,
  "risco_churn_motivo" text,
  "obs_contrato" text,
  "obs_contrato_atualizada_em" timestamptz,
  "obs_contrato_atualizada_por" uuid,
  "churn_validado" boolean,
  "churn_validado_em" timestamptz,
  "churn_validado_por" uuid
);
ALTER TABLE public."clientes" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_clientes" ON public."clientes" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."portal_conteudo" (
  "tipo" text,
  "conteudo" text,
  "atualizado_por" uuid,
  "atualizado_em" timestamptz
);
ALTER TABLE public."portal_conteudo" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_portal_conteudo" ON public."portal_conteudo" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."client_situation_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cliente_notion_id" text,
  "situacao_anterior" text,
  "situacao_nova" text,
  "data_mudanca" timestamptz,
  "origem" text,
  "contexto" text,
  "gestor_id" uuid
);
ALTER TABLE public."client_situation_history" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_client_situation_history" ON public."client_situation_history" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."comarka_pro_roteiros" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "colaborador_id" uuid,
  "titulo" text,
  "ad_id" text,
  "ad_match_status" text,
  "metricas_snapshot" jsonb,
  "status" text,
  "aprovado_por" uuid,
  "aprovado_em" timestamptz,
  "observacao_aprovador" text,
  "cliente_id" uuid,
  "mes_referencia" date,
  "deleted_at" timestamptz,
  "criado_em" timestamptz
);
ALTER TABLE public."comarka_pro_roteiros" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_comarka_pro_roteiros" ON public."comarka_pro_roteiros" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."onboarding_template_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ordem" integer,
  "secao" text,
  "texto" text,
  "created_at" timestamptz
);
ALTER TABLE public."onboarding_template_items" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_onboarding_template_items" ON public."onboarding_template_items" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."sistema_auditoria" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "user_nome" text,
  "acao" text,
  "modulo" text,
  "objeto_tipo" text,
  "objeto_id" text,
  "valor_anterior" jsonb,
  "valor_novo" jsonb,
  "ip" text,
  "criado_em" timestamptz
);
ALTER TABLE public."sistema_auditoria" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_sistema_auditoria" ON public."sistema_auditoria" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."churn_monthly_summary" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ano_mes" text,
  "num_saidas" integer,
  "total_clientes" integer,
  "churn_rate" numeric,
  "is_historico" boolean,
  "created_at" timestamptz,
  "updated_at" timestamptz
);
ALTER TABLE public."churn_monthly_summary" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_churn_monthly_summary" ON public."churn_monthly_summary" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."financeiro_margem_cliente" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cliente_id" uuid,
  "mes_referencia" date,
  "receita" numeric,
  "custo_midia" numeric,
  "custo_gestor" numeric,
  "margem_bruta" numeric,
  "margem_liquida" numeric,
  "margem_pct" numeric,
  "calculado_em" timestamptz,
  "deleted_at" timestamptz
);
ALTER TABLE public."financeiro_margem_cliente" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_financeiro_margem_cliente" ON public."financeiro_margem_cliente" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."ghl_funnel_snapshot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pipeline_name" text,
  "pipeline_id" text,
  "stage_name" text,
  "stage_position" integer,
  "opp_count" integer,
  "won_count" integer,
  "lost_count" integer,
  "open_count" integer,
  "monetary_value" numeric,
  "updated_at" timestamptz
);
ALTER TABLE public."ghl_funnel_snapshot" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_ghl_funnel_snapshot" ON public."ghl_funnel_snapshot" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."lancamentos_social_selling" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "social_seller_id" uuid,
  "data" date,
  "mes_referencia" text,
  "perfis_prospectados" integer,
  "conexoes_enviadas" integer,
  "conexoes_aceitas" integer,
  "conversas_iniciadas" integer,
  "reunioes_agendadas" integer,
  "vendas" integer,
  "mrr_dia" numeric,
  "obs" text
);
ALTER TABLE public."lancamentos_social_selling" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_lancamentos_social_selling" ON public."lancamentos_social_selling" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."clientes_crm_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cliente_id" text,
  "ghl_subaccount_id" text,
  "ghl_pipeline_id" text,
  "stage_mapping" jsonb,
  "conexao_ativa" boolean,
  "last_sync_at" timestamptz,
  "last_test_at" timestamptz,
  "last_test_result" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "deleted_at" timestamptz
);
ALTER TABLE public."clientes_crm_config" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_clientes_crm_config" ON public."clientes_crm_config" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."lead_funnel_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lead_id" text,
  "ad_id" text,
  "event_type" text,
  "event_at" timestamptz,
  "closer_id" uuid,
  "mrr_value" numeric,
  "notes" text,
  "created_at" timestamptz
);
ALTER TABLE public."lead_funnel_events" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_lead_funnel_events" ON public."lead_funnel_events" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."audience_performance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "adset_id" text,
  "adset_name" text,
  "campaign_id" text,
  "campaign_name" text,
  "total_leads" integer,
  "qualified_leads" integer,
  "meetings" integer,
  "contracts" integer,
  "total_mrr" numeric,
  "spend" numeric,
  "composite_score" numeric,
  "alert_status" text,
  "last_updated" timestamptz
);
ALTER TABLE public."audience_performance" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_audience_performance" ON public."audience_performance" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."sistema_fila_erros" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "origem" text,
  "tipo_erro" text,
  "mensagem" text,
  "payload" jsonb,
  "tentativas" integer,
  "max_tentativas" integer,
  "status" text,
  "resolvido_por" uuid,
  "resolvido_em" timestamptz,
  "proxima_tentativa_em" timestamptz,
  "criado_em" timestamptz
);
ALTER TABLE public."sistema_fila_erros" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_sistema_fila_erros" ON public."sistema_fila_erros" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."v_audience_ranking" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "adset_id" text,
  "adset_name" text,
  "campaign_id" text,
  "campaign_name" text,
  "total_leads" integer,
  "qualified_leads" integer,
  "meetings" integer,
  "contracts" integer,
  "total_mrr" numeric,
  "spend" numeric,
  "composite_score" numeric,
  "alert_status" text,
  "last_updated" timestamptz
);
ALTER TABLE public."v_audience_ranking" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_v_audience_ranking" ON public."v_audience_ranking" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid,
  "tipo" text,
  "titulo" text,
  "mensagem" text,
  "lida" boolean,
  "link" text,
  "metadata" jsonb,
  "created_at" timestamptz
);
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_notifications" ON public."notifications" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."v_creative_ranking" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ad_id" text,
  "ad_name" text,
  "campaign_id" text,
  "campaign_name" text,
  "adset_id" text,
  "adset_name" text,
  "total_leads" integer,
  "qualified_leads" integer,
  "disqualified_leads" integer,
  "meetings_scheduled" integer,
  "meetings_held" integer,
  "no_shows" integer,
  "proposals_sent" integer,
  "contracts_closed" integer,
  "total_mrr" numeric,
  "spend" numeric,
  "qualification_rate" numeric,
  "meeting_rate" numeric,
  "close_rate" numeric,
  "no_show_rate" numeric,
  "cac" numeric,
  "composite_score" numeric,
  "alert_status" text,
  "alert_message" text,
  "last_updated" timestamptz,
  "total_spend_meta" numeric
);
ALTER TABLE public."v_creative_ranking" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_v_creative_ranking" ON public."v_creative_ranking" FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public."n8n_error_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tipo" text,
  "workflow_name" text,
  "workflow_id" text,
  "error_message" text,
  "node_name" text,
  "execution_id" text,
  "resolved" boolean,
  "created_at" timestamptz
);
ALTER TABLE public."n8n_error_log" ENABLE ROW LEVEL SECURITY; 
CREATE POLICY "Allow_ALL_n8n_error_log" ON public."n8n_error_log" FOR ALL USING (true) WITH CHECK (true);



-- SCRIPT DE INICIALIZAÇÃO GERADO AUTOMATICAMENTE

-- ========================
-- schema.sql
-- ========================

-- ============================================
-- DASHBOARD COMERCIAL - Schema SQL Completo
-- Executar no SQL Editor do Supabase
-- ============================================

CREATE OR REPLACE FUNCTION format_mes_ref(d date) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT to_char(d, 'YYYY-MM');
$$;

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
  mes_referencia text generated always as (format_mes_ref(data)) stored,
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


-- ========================
-- migration-v2.sql
-- ========================

-- ============================================
-- DASHBOARD COMERCIAL v2 - Migration
-- Executar no SQL Editor do Supabase
-- ============================================

-- 1. Adicionar campos de auth na tabela closers
ALTER TABLE closers ADD COLUMN IF NOT EXISTS usuario text UNIQUE;
ALTER TABLE closers ADD COLUMN IF NOT EXISTS senha_hash text;

-- 2. Criar tabela de contratos individuais
CREATE TABLE IF NOT EXISTS contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id uuid REFERENCES closers(id) ON DELETE CASCADE,
  lancamento_id uuid REFERENCES lancamentos_diarios(id) ON DELETE CASCADE,
  data date NOT NULL,
  nome_cliente text NOT NULL,
  mrr numeric(10,2) DEFAULT 0,
  ltv numeric(10,2) DEFAULT 0,
  mes_referencia text GENERATED ALWAYS AS (format_mes_ref(data)) STORED,
  created_at timestamptz DEFAULT now()
);

-- 3. RLS para contratos
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on contratos" ON contratos FOR ALL USING (true) WITH CHECK (true);

-- 4. Remover colunas obsoletas de config_mensal
ALTER TABLE config_mensal DROP COLUMN IF EXISTS custo_por_reuniao;
ALTER TABLE config_mensal DROP COLUMN IF EXISTS meses_contrato;


-- ========================
-- migration-trafego-pago-v2.sql
-- ========================

-- ============================================
-- MIGRATION: Tráfego Pago — Tabelas e Índices (v2)
-- Executar no SQL Editor do Supabase
-- ============================================

-- 1. ads_metadata
CREATE TABLE IF NOT EXISTS public.ads_metadata (
  ad_id text PRIMARY KEY,
  ad_name text,
  adset_id text,
  adset_name text,
  campaign_id text,
  campaign_name text,
  objetivo text,
  status text DEFAULT 'ACTIVE',
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_metadata_campaign ON public.ads_metadata(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ads_metadata_adset ON public.ads_metadata(adset_id);

ALTER TABLE public.ads_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on ads_metadata" ON public.ads_metadata FOR ALL USING (true) WITH CHECK (true);

-- 2. ads_performance
CREATE TABLE IF NOT EXISTS public.ads_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text REFERENCES public.ads_metadata(ad_id) ON DELETE CASCADE,
  data_ref date NOT NULL,
  impressoes int DEFAULT 0,
  cliques int DEFAULT 0,
  spend numeric(12,2) DEFAULT 0,
  leads int DEFAULT 0,
  cpl numeric(10,2) DEFAULT 0,
  ctr numeric(6,4) DEFAULT 0,
  cpc numeric(10,2) DEFAULT 0,
  frequencia numeric(6,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(ad_id, data_ref)
);

CREATE INDEX IF NOT EXISTS idx_ads_perf_ad ON public.ads_performance(ad_id);
CREATE INDEX IF NOT EXISTS idx_ads_perf_data ON public.ads_performance(data_ref);

ALTER TABLE public.ads_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on ads_performance" ON public.ads_performance FOR ALL USING (true) WITH CHECK (true);

-- 3. leads_ads_attribution (sem colunas geradas - preenchidas via trigger)
CREATE TABLE IF NOT EXISTS public.leads_ads_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL UNIQUE,
  ad_id text REFERENCES public.ads_metadata(ad_id) ON DELETE SET NULL,
  adset_id text,
  campaign_id text,
  nome_lead text,
  telefone text,
  email text,
  created_at timestamptz DEFAULT now(),
  hora_chegada int DEFAULT 0,
  dia_semana int DEFAULT 0,
  estagio_crm text DEFAULT 'novo',
  estagio_atualizado_em timestamptz DEFAULT now(),
  receita_gerada numeric(12,2) DEFAULT 0,
  gestor_id uuid
);

CREATE INDEX IF NOT EXISTS idx_leads_attr_ad ON public.leads_ads_attribution(ad_id);
CREATE INDEX IF NOT EXISTS idx_leads_attr_campaign ON public.leads_ads_attribution(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_attr_adset ON public.leads_ads_attribution(adset_id);
CREATE INDEX IF NOT EXISTS idx_leads_attr_created ON public.leads_ads_attribution(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_attr_estagio ON public.leads_ads_attribution(estagio_crm);

ALTER TABLE public.leads_ads_attribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on leads_ads_attribution" ON public.leads_ads_attribution FOR ALL USING (true) WITH CHECK (true);

-- Trigger para preencher hora_chegada e dia_semana automaticamente
CREATE OR REPLACE FUNCTION public.fill_lead_time_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hora_chegada := EXTRACT(HOUR FROM NEW.created_at AT TIME ZONE 'America/Sao_Paulo')::int;
  NEW.dia_semana := EXTRACT(DOW FROM NEW.created_at AT TIME ZONE 'America/Sao_Paulo')::int;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fill_lead_time ON public.leads_ads_attribution;
CREATE TRIGGER trg_fill_lead_time
  BEFORE INSERT ON public.leads_ads_attribution
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_lead_time_fields();

-- 4. leads_stages_history
CREATE TABLE IF NOT EXISTS public.leads_stages_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL,
  estagio_anterior text,
  estagio_novo text NOT NULL,
  alterado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stages_hist_lead ON public.leads_stages_history(lead_id);

ALTER TABLE public.leads_stages_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on leads_stages_history" ON public.leads_stages_history FOR ALL USING (true) WITH CHECK (true);


-- ========================
-- migration-alertas-config.sql
-- ========================

-- ============================================
-- MIGRATION: Alertas Config + Placement Breakdown
-- Executar no SQL Editor do Supabase
-- ============================================

-- 1. Tabela de configuração de alertas
CREATE TABLE IF NOT EXISTS public.alertas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL, -- cpl_max, ctr_min, frequencia_max, zero_leads
  threshold numeric(10,2) NOT NULL,
  campaign_id text, -- null = global
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE public.alertas_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on alertas_config" ON public.alertas_config FOR ALL USING (true) WITH CHECK (true);

-- 2. Tabela de snooze de alertas
CREATE TABLE IF NOT EXISTS public.alertas_snooze (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text NOT NULL,
  tipo text NOT NULL,
  snooze_ate timestamptz NOT NULL,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE public.alertas_snooze ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on alertas_snooze" ON public.alertas_snooze FOR ALL USING (true) WITH CHECK (true);

-- 3. Coluna de placement breakdown na ads_performance
ALTER TABLE public.ads_performance ADD COLUMN IF NOT EXISTS placement_breakdown jsonb;


-- ========================
-- migration-relatorio-config.sql
-- ========================

-- ============================================
-- MIGRATION: Relatório Semanal Config
-- Executar no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS public.relatorio_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome text NOT NULL,
  whatsapp text NOT NULL,
  dia_semana int DEFAULT 1, -- 0=dom, 1=seg, 2=ter...
  hora int DEFAULT 8,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE public.relatorio_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on relatorio_config" ON public.relatorio_config FOR ALL USING (true) WITH CHECK (true);


-- ========================
-- migration-leads-attribution-trigger.sql
-- ========================

-- ============================================
-- TRIGGER: Auto-popular leads_ads_attribution
-- quando um lead com ad_id é inserido em leads_crm
-- Executar no SQL Editor do Supabase
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_lead_to_ads_attribution()
RETURNS TRIGGER AS $$
BEGIN
  -- Só insere se o lead tem ad_id preenchido
  IF NEW.ad_id IS NOT NULL AND NEW.ad_id != '' THEN
    INSERT INTO public.leads_ads_attribution (
      lead_id, ad_id, adset_id, campaign_id,
      nome_lead, telefone, email,
      created_at, estagio_crm, estagio_atualizado_em,
      receita_gerada
    )
    VALUES (
      NEW.ghl_contact_id, NEW.ad_id, NEW.adset_id, NEW.campaign_id,
      NEW.nome, NEW.telefone, NEW.email,
      NEW.created_at, NEW.etapa, now(),
      CASE WHEN NEW.etapa IN ('comprou', 'assinatura_contrato') THEN COALESCE(NEW.valor_total_projeto, 0) ELSE 0 END
    )
    ON CONFLICT (lead_id) DO UPDATE SET
      estagio_crm = EXCLUDED.estagio_crm,
      estagio_atualizado_em = now(),
      receita_gerada = CASE WHEN EXCLUDED.estagio_crm IN ('comprou', 'assinatura_contrato') THEN COALESCE(NEW.valor_total_projeto, 0) ELSE leads_ads_attribution.receita_gerada END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_lead_ads ON public.leads_crm;
CREATE TRIGGER trg_sync_lead_ads
  AFTER INSERT OR UPDATE ON public.leads_crm
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lead_to_ads_attribution();

-- ============================================
-- TRIGGER: Registrar mudança de estágio em leads_stages_history
-- quando leads_ads_attribution.estagio_crm muda
-- ============================================

CREATE OR REPLACE FUNCTION public.log_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estagio_crm IS DISTINCT FROM NEW.estagio_crm THEN
    INSERT INTO public.leads_stages_history (lead_id, estagio_anterior, estagio_novo)
    VALUES (NEW.lead_id, OLD.estagio_crm, NEW.estagio_crm);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_stage ON public.leads_ads_attribution;
CREATE TRIGGER trg_log_stage
  AFTER UPDATE ON public.leads_ads_attribution
  FOR EACH ROW
  EXECUTE FUNCTION public.log_stage_change();


-- ========================
-- trigger-auto-leads-v2.sql
-- ========================

-- ============================================
-- TRIGGER: Auto-incrementar leads_totais
-- Executar no SQL Editor do Supabase
-- ============================================

-- Primeiro, verificar em qual schema a tabela está
DO $$
BEGIN
  RAISE NOTICE 'Verificando tabelas...';
END $$;

-- Tentar criar a function e o trigger no schema public
CREATE OR REPLACE FUNCTION public.increment_leads_totais()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.config_mensal (mes_referencia, leads_totais, investimento)
  VALUES (NEW.mes_referencia, 1, 0)
  ON CONFLICT (mes_referencia)
  DO UPDATE SET leads_totais = public.config_mensal.leads_totais + 1,
                updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_leads ON public.leads_crm;
CREATE TRIGGER trg_increment_leads
  AFTER INSERT ON public.leads_crm
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_leads_totais();


-- ========================
-- migration-add-columns.sql
-- ========================

-- ============================================
-- MIGRATION: Adicionar colunas faltantes
-- Executar no SQL Editor do Supabase
-- ============================================

-- 1. Adicionar meta_reunioes_feitas na tabela metas_sdr
ALTER TABLE metas_sdr ADD COLUMN IF NOT EXISTS meta_reunioes_feitas int DEFAULT 0;

-- 2. Trigger para auto-incrementar leads_totais quando um lead é inserido
CREATE OR REPLACE FUNCTION increment_leads_totais()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO config_mensal (mes_referencia, leads_totais, investimento)
  VALUES (NEW.mes_referencia, 1, 0)
  ON CONFLICT (mes_referencia)
  DO UPDATE SET leads_totais = config_mensal.leads_totais + 1,
                updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_leads ON leads_crm;
CREATE TRIGGER trg_increment_leads
  AFTER INSERT ON leads_crm
  FOR EACH ROW
  EXECUTE FUNCTION increment_leads_totais();


