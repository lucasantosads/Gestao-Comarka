export interface Closer {
  id: string;
  nome: string;
  usuario: string | null;
  senha_hash: string | null;
  ativo: boolean;
  nivel: string;
  salario_fixo: number;
  meta_conversao_reuniao: number;
  meta_conversao_mql: number;
  meta_ticket_medio: number;
  created_at: string;
}

export interface Sdr {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export interface LancamentoDiario {
  id: string;
  closer_id: string;
  data: string;
  reunioes_marcadas: number;
  reunioes_feitas: number;
  no_show: number;
  ganhos: number;
  mrr_dia: number;
  ltv: number;
  comissao_dia: number;
  obs: string | null;
  mes_referencia: string;
  created_at: string;
}

export interface Contrato {
  id: string;
  mes_referencia: string;
  closer_id: string;
  sdr_id: string;
  cliente_nome: string;
  origem_lead: string;
  valor_entrada: number;
  meses_contrato: number;
  mrr: number;
  valor_total_projeto: number;
  data_fechamento: string;
  obs: string | null;
  created_at: string;
}

export interface ConfigMensal {
  id: string;
  mes_referencia: string;
  leads_totais: number;
  investimento: number;
  created_at: string;
  updated_at: string;
}

export interface MetaMensal {
  id: string;
  mes_referencia: string;
  meta_entrada_valor: number;
  meta_faturamento_total: number;
  meta_contratos_fechados: number;
  meta_reunioes_agendadas: number;
  meta_reunioes_feitas: number;
  meta_taxa_no_show: number;
  leads_totais: number;
  valor_investido_anuncios: number;
  custo_por_reuniao: number;
  meses_padrao_contrato: number;
  created_at: string;
}

export interface MetaCloser {
  id: string;
  mes_referencia: string;
  closer_id: string;
  meta_contratos: number;
  meta_mrr: number;
  meta_ltv: number;
  meta_reunioes_feitas: number;
  meta_taxa_no_show: number;
}

export interface LancamentoSdr {
  id: string;
  sdr_id: string;
  data: string;
  mes_referencia: string;
  leads_recebidos: number;
  contatos_realizados: number;
  conexoes_feitas: number;
  reunioes_agendadas: number;
  no_show: number;
  follow_ups_feitos: number;
  obs: string | null;
}

export interface MetaSdr {
  id: string;
  sdr_id: string;
  mes_referencia: string;
  meta_contatos: number;
  meta_conexoes: number;
  meta_reunioes_agendadas: number;
  meta_taxa_no_show: number;
  meta_taxa_conexao: number;
  meta_taxa_agendamento: number;
}

export interface LeadCrm {
  id: string;
  ghl_contact_id: string | null;
  ghl_pipeline_id: string | null;
  ghl_opportunity_id: string | null;
  ad_id: string | null;
  ad_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  closer_id: string | null;
  sdr_id: string | null;
  mes_referencia: string | null;
  etapa: "oportunidade" | "lead_qualificado" | "reuniao_agendada" | "proposta_enviada" | "negociacao" | "follow_up" | "no_show" | "assinatura_contrato" | "comprou" | "desistiu";
  data_reuniao_agendada: string | null;
  data_proposta_enviada: string | null;
  data_follow_up: string | null;
  data_assinatura: string | null;
  data_comprou: string | null;
  data_desistiu: string | null;
  motivo_desistencia: string | null;
  resumo_reuniao: string | null;
  pontos_positivos: string | null;
  objecoes: string | null;
  proximo_passo: string | null;
  contrato_id: string | null;
  canal_aquisicao: string | null;
  valor_entrada: number;
  mensalidade: number;
  fidelidade_meses: number;
  valor_total_projeto: number;
  data_venda: string | null;
  notion_page_id: string | null;
  agendamento: string | null;
  area_atuacao: string | null;
  instagram: string | null;
  site: string | null;
  link_proposta: string | null;
  faturamento: number;
  qualidade_lead: string | null;
  funil: string | null;
  origem_utm: string | null;
  primeiro_contato: string | null;
  follow_up_1: string | null;
  follow_up_2: string | null;
  preenchido_em: string | null;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadCrmHistorico {
  id: string;
  lead_id: string;
  etapa_anterior: string | null;
  etapa_nova: string;
  changed_at: string;
  obs: string | null;
}

export interface Recebimento {
  id: string;
  contrato_id: string | null;
  closer_id: string | null;
  cliente_nome: string;
  data_prevista: string;
  data_recebida: string | null;
  valor: number;
  tipo: "entrada" | "mensalidade" | "parcela";
  status: "pendente" | "recebido" | "atrasado";
  mes_referencia: string;
  obs: string | null;
  created_at: string;
}

export interface Alerta {
  id: string;
  tipo: string;
  severidade: "info" | "atencao" | "critico";
  titulo: string;
  descricao: string | null;
  closer_id: string | null;
  resolvido: boolean;
  criado_em: string;
  resolvido_em: string | null;
}

export interface ReuniaoSdr {
  id: string;
  sdr_id: string;
  closer_id: string;
  lead_nome: string;
  data_reuniao: string;
  mes_referencia: string;
  status: "agendada" | "feita" | "no_show" | "reagendada" | "cancelada";
  contrato_id: string | null;
  obs: string | null;
  created_at: string;
}

// ============ TRÁFEGO PAGO ============

export interface AdsMetadata {
  ad_id: string;
  ad_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  objetivo: string | null;
  status: string;
  updated_at: string;
}

export interface AdsPerformance {
  id: string;
  ad_id: string;
  data_ref: string;
  impressoes: number;
  cliques: number;
  spend: number;
  leads: number;
  cpl: number;
  ctr: number;
  cpc: number;
  frequencia: number;
  created_at: string;
}

export interface LeadAdsAttribution {
  id: string;
  lead_id: string;
  ad_id: string | null;
  adset_id: string | null;
  campaign_id: string | null;
  nome_lead: string | null;
  telefone: string | null;
  email: string | null;
  created_at: string;
  hora_chegada: number;
  dia_semana: number;
  estagio_crm: string;
  estagio_atualizado_em: string;
  receita_gerada: number;
  gestor_id: string | null;
}

export interface LeadStageHistory {
  id: string;
  lead_id: string;
  estagio_anterior: string | null;
  estagio_novo: string;
  alterado_em: string;
}
