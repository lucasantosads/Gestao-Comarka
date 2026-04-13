/**
 * Camada de abstração — todas as páginas importam daqui.
 * Fase 1: Notion. Fase 3: trocar para supabase-read/write.
 */

export { getTeam, getClientes, getClienteById, getClientesByAnalista, getOnboarding, getOnboardingById, getTarefas, getTarefasByPessoa, getReunioes, getReunioesByPessoa, getPageContent, DB_IDS } from "./notion";
export type { TeamMember, Cliente, OnboardingItem, NotionBlock, Tarefa, Reuniao } from "./notion";

export {
  updateClienteStatus, updateClienteSituacao, updateClienteResultados,
  updateClienteAtencao, updateClienteOrcamento, updateClienteAnalista,
  updateClienteUltimoFeedback, updateClienteOtimizacao, updateClienteDiaOtimizar,
  addOtimizacaoEntry,
  updateOnboardingEtapa, toggleChecklistItem, updateMembroFuncoes, forceSync,
} from "./notion-write";
