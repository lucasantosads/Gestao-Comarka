// Tabela de pontos por categoria do Comarka Pro.
// Valores positivos = ganho; negativos = penalização.
// tipo 'automatico' = lançado por job/cron; 'manual' = lançado por admin/head.

export type ComarkaProCategoria =
  | "cronometro"
  | "aula"
  | "implementacao"
  | "nps"
  | "orcamento"
  | "feedback_cliente"
  | "roteiro"
  | "reuniao_cliente"
  | "organizacao"
  | "penalizacao_atraso"
  | "penalizacao_aula"
  | "penalizacao_desorganizacao"
  | "penalizacao_erro_grave"
  | "penalizacao_erro_leve"
  | "penalizacao_grupo";

export interface PontosCategoriaInfo {
  pts: number;
  tipo: "automatico" | "manual";
  descricao: string;
}

export const PONTOS_CATEGORIA: Record<ComarkaProCategoria, PontosCategoriaInfo> = {
  cronometro:                 { pts: 5,   tipo: "automatico", descricao: "Cronômetro >95% no mês" },
  aula:                       { pts: 20,  tipo: "manual",     descricao: "Aula mensal entregue" },
  implementacao:              { pts: 15,  tipo: "manual",     descricao: "Implementação validada" },
  nps:                        { pts: 20,  tipo: "manual",     descricao: "NPS >95% preenchimento" },
  orcamento:                  { pts: 10,  tipo: "automatico", descricao: "Aumento de orçamento de cliente" },
  feedback_cliente:           { pts: 5,   tipo: "manual",     descricao: "Feedback positivo de cliente" },
  roteiro:                    { pts: 10,  tipo: "manual",     descricao: "Roteiro bom aprovado" },
  reuniao_cliente:            { pts: 5,   tipo: "automatico", descricao: "Reunião com cliente (max 1x/semana/cliente)" },
  organizacao:                { pts: 10,  tipo: "automatico", descricao: "Otimizações nas datas corretas" },
  penalizacao_atraso:         { pts: -10, tipo: "manual",     descricao: "Atraso em entrega importante" },
  penalizacao_aula:           { pts: -10, tipo: "manual",     descricao: "Aula não apresentada sem justificativa" },
  penalizacao_desorganizacao: { pts: -10, tipo: "manual",     descricao: "Desorganização em processos" },
  penalizacao_erro_grave:     { pts: -15, tipo: "manual",     descricao: "Erro grave em campanha" },
  penalizacao_erro_leve:      { pts: -5,  tipo: "manual",     descricao: "Erro leve em campanha" },
  penalizacao_grupo:          { pts: -5,  tipo: "manual",     descricao: "Grupo sem resposta após fim do dia útil" },
};

export const COMARKA_PRO_CATEGORIAS = Object.keys(PONTOS_CATEGORIA) as ComarkaProCategoria[];
