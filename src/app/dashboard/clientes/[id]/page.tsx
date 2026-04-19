"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Plus, ChevronDown, ChevronRight, Activity, MessageCircle, Megaphone, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import type { Cliente, NotionBlock } from "@/lib/data";
import { NichoTesesSection } from "@/components/nicho-teses-section";

const STATUS_OPTS = ["Ativo", "Pausado", "Inadimplente", "Aviso 30 dias", "Finalizado"];
const CHURN_BLOCKED_FROM = ["Inadimplente", "Aviso 30 dias", "Finalizado"]; // Status que não podem virar Finalizado (churn)
const SITUACAO_OPTS = ["Melhorando", "Estável", "Piorando"];
const RESULTADOS_OPTS = ["Ótimos", "Bons", "Médios", "Ruins", "Péssimos"];
const ATENCAO_OPTS = ["Ouro", "Prata", "Bronze"];
const DIA_OPTS = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA"];

const ATENCAO_COLORS: Record<string, string> = {
  "Ouro": "bg-yellow-500/15 text-yellow-400", "Prata": "bg-slate-400/15 text-slate-300", "Bronze": "bg-orange-500/15 text-orange-400",
};
const RESULTADOS_COLORS: Record<string, string> = {
  "Ótimos": "bg-green-500/15 text-green-400", "Bons": "bg-blue-500/15 text-blue-400",
  "Médios": "bg-yellow-500/15 text-yellow-400", "Ruins": "bg-orange-500/15 text-orange-400", "Péssimos": "bg-red-500/15 text-red-400",
};

interface OtimizacaoEntry { data: string; texto: string; id?: string; source?: "notion" | "dashboard" }

interface Tese {
  id: string;
  nome_tese: string;
  tese?: string; // legado
  tipo: string | null;
  publico_alvo: string | null;
  status: "Ativa" | "Pausada" | "Em Teste";
  data_ativacao: string | null;
  observacoes: string | null;
  orcamento: number;
}

const TIPOS_DIREITO = ["Trabalhista", "Previdenciário", "Criminal", "Civil", "Família", "Tributário", "Empresarial", "Consumidor", "Imobiliário", "Saúde", "Outros"];
const TESE_STATUS = ["Ativa", "Pausada", "Em Teste"] as const;
const TESE_STATUS_COLORS: Record<string, string> = {
  "Ativa": "bg-green-500/15 text-green-400 border-green-500/30",
  "Pausada": "bg-slate-500/15 text-slate-300 border-slate-500/30",
  "Em Teste": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

interface ClienteExtra {
  notion_id: string;
  meta_account_id: string | null; meta_account_name: string | null; meta_access_ativo: boolean;
  google_customer_id: string | null; google_account_name: string | null; google_access_ativo: boolean;
  whatsapp_group_url: string | null; whatsapp_resumo: string | null; whatsapp_ultima_atualizacao: string | null;
  saude_score: number; saude_observacao: string | null; saude_tendencia: string | null;
  ultima_analise_ia: string | null; ultima_analise_ia_em: string | null;
  ultima_verificacao?: string | null;
  briefing?: Record<string, string> | null;
  briefing_preenchido_em?: string | null;
}

interface SnapshotMetricas {
  cpl_atual: number | null;
  roas_atual: number | null;
  leads_periodo: number | null;
  spend_periodo: number | null;
  historico_ultima_mudanca: string | null;
  capturado_em: string;
}

interface OtimizacaoDB {
  id: string; notion_id: string; data: string;
  comentarios: string | null; feito: string | null; proxima_vez: string | null; solicitado: string | null;
  data_confirmacao?: string | null;
  snapshot_metricas?: SnapshotMetricas | null;
  deleted_at?: string | null;
}

function parseOtimizacoes(blocks: NotionBlock[]): OtimizacaoEntry[] {
  const entries: OtimizacaoEntry[] = [];
  for (const block of blocks) {
    if (block.type === "toggle") {
      const toggle = block.toggle as { rich_text: { plain_text: string }[]; children?: NotionBlock[] };
      const title = (toggle.rich_text || []).map((t) => t.plain_text).join("");
      let texto = "";
      if (block.has_children) {
        const children = (toggle as { children?: NotionBlock[] }).children || [];
        for (const child of children) {
          if (child.type === "paragraph") {
            const p = child.paragraph as { rich_text: { plain_text: string }[] };
            texto += (p.rich_text || []).map((t) => t.plain_text).join("") + "\n";
          }
        }
      }
      entries.push({ data: title, texto: texto.trim() });
    }
  }
  return entries;
}

export default function ClienteDetalhePage() {
  const { id } = useParams();
  const [cliente, setCliente] = useState<(Cliente & { blocks?: NotionBlock[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [otimizacoes, setOtimizacoes] = useState<OtimizacaoEntry[]>([]);
  const [expandedOtim, setExpandedOtim] = useState<number | null>(null);
  const [showNovaOtim, setShowNovaOtim] = useState(false);
  const [novaOtim, setNovaOtim] = useState({ data: new Date().toISOString().split("T")[0], comentarios: "", feito: "", proximaVez: "", solicitado: "" });
  const [savingOtim, setSavingOtim] = useState(false);
  const [iaResult, setIaResult] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [extra, setExtra] = useState<ClienteExtra | null>(null);
  const [otimizacoesDb, setOtimizacoesDb] = useState<OtimizacaoDB[]>([]);
  const [editingOtim, setEditingOtim] = useState<string | null>(null);
  const [editOtimForm, setEditOtimForm] = useState<{ data: string; comentarios: string; feito: string; proxima_vez: string; solicitado: string }>({ data: "", comentarios: "", feito: "", proxima_vez: "", solicitado: "" });
  const [expandedSnapshot, setExpandedSnapshot] = useState<string | null>(null);
  const [teses, setTeses] = useState<Tese[]>([]);
  const [activeTab, setActiveTab] = useState<"geral" | "teses" | "metricas" | "reunioes" | "contrato" | "resumos" | "crm">("geral");
  const [crmConfig, setCrmConfig] = useState<{ ghl_subaccount_id: string; ghl_pipeline_id: string; stage_mapping: Record<string, string>; conexao_ativa: boolean; last_sync_at: string | null; last_test_at: string | null; last_test_result: string | null } | null>(null);
  const [crmPipelines, setCrmPipelines] = useState<{ id: string; name: string }[]>([]);
  const [crmStages, setCrmStages] = useState<{ id: string; name: string; position: number }[]>([]);
  const [crmTesting, setCrmTesting] = useState(false);
  const STATUS_INTERNOS = ["Novo Lead", "Reunião Marcada", "Reunião Feita", "Proposta Enviada", "Follow-up", "Comprou", "Perdido"];
  const [periodoMetricas, setPeriodoMetricas] = useState<"7d" | "30d" | "mes">("30d");
  const [adsData, setAdsData] = useState<{ spend: number; leads: number; cpl: number; roas: number; byDay: { data: string; spend: number; leads: number; cpl: number }[] } | null>(null);
  const [contratoData, setContratoData] = useState<{ valor_mensal: number; tipo_contrato: string; dia_pagamento: number; mes_fechamento: string; forma_pagamento: string; parcelas_integral: number; valor_integral: number; fidelidade_meses: number; fidelidade_inicio: string; fidelidade_fim: string } | null>(null);
  const [reunioes, setReunioes] = useState<{ id: string; tipo: string; data_reuniao: string; status: string; link_gravacao: string | null; transcricao: string | null; resumo_ia: string | null; notas: string | null }[]>([]);
  const [resumos, setResumos] = useState<{ id: string; conteudo: string; created_at: string; periodo_inicio: string | null; periodo_fim: string | null }[]>([]);
  const [gerandoResumo, setGerandoResumo] = useState(false);
  const [showNovaReuniao, setShowNovaReuniao] = useState(false);
  const [novaReuniao, setNovaReuniao] = useState({ tipo: "revisao", data_reuniao: new Date().toISOString().slice(0, 16), status: "realizada", notas: "", link_gravacao: "", transcricao: "" });
  const [novaTese, setNovaTese] = useState<{ nome_tese: string; tipo: string; publico_alvo: string; status: "Ativa" | "Pausada" | "Em Teste"; data_ativacao: string; observacoes: string }>({ nome_tese: "", tipo: "", publico_alvo: "", status: "Ativa", data_ativacao: new Date().toISOString().slice(0, 10), observacoes: "" });
  const [gestores, setGestores] = useState<{ id: string; nome: string }[]>([]);
  const [fechamento, setFechamento] = useState<{ sdr_nome: string | null; closer_nome: string | null; data_fechamento: string | null } | null>(null);
  // Obs contrato (5b) + Status histórico (5d)
  const [obsContrato, setObsContrato] = useState("");
  const [obsContratoOriginal, setObsContratoOriginal] = useState("");
  const [obsContratoMeta, setObsContratoMeta] = useState<{ em: string; por: string } | null>(null);
  const [editingObs, setEditingObs] = useState(false);
  const [savingObs, setSavingObs] = useState(false);
  const [statusHistorico, setStatusHistorico] = useState<{ id: string; status_anterior: string | null; status_novo: string; alterado_por: string | null; motivo: string | null; criado_em: string }[]>([]);
  const [showHistorico, setShowHistorico] = useState(false);
  const [clientePipelineId, setClientePipelineId] = useState<string | null>(null);

  const [showBriefing, setShowBriefing] = useState(false);
  const [briefingForm, setBriefingForm] = useState<Record<string, string>>({
    area_atuacao: "", cidade: "", objetivo_principal: "", ticket_medio: "",
    orcamento_atual: "", historico_agencias: "", observacoes: "",
  });

  useEffect(() => {
    // Fonte única: team_notion_mirror via /api/dashboard/analistas (sem Notion direto)
    fetch("/api/dashboard/analistas").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setGestores(d.map((m: { id: string; nome: string }) => ({ id: m.id, nome: m.nome })));
    });
  }, []);

  // CRM: carrega config e pipelines quando a aba é ativada
  useEffect(() => {
    if (activeTab !== "crm" || !id) return;
    fetch(`/api/clientes/crm-config?cliente_id=${id}`).then((r) => r.json()).then((d) => {
      if (d && !d.error) {
        setCrmConfig({
          ghl_subaccount_id: d.ghl_subaccount_id || "",
          ghl_pipeline_id: d.ghl_pipeline_id || "",
          stage_mapping: d.stage_mapping || {},
          conexao_ativa: !!d.conexao_ativa,
          last_sync_at: d.last_sync_at || null,
          last_test_at: d.last_test_at || null,
          last_test_result: d.last_test_result || null,
        });
      } else {
        setCrmConfig({ ghl_subaccount_id: "", ghl_pipeline_id: "", stage_mapping: {}, conexao_ativa: false, last_sync_at: null, last_test_at: null, last_test_result: null });
      }
    });
    fetch("/api/ghl/pipelines").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setCrmPipelines(d);
    });
  }, [activeTab, id]);

  // Carrega stages quando pipeline muda
  useEffect(() => {
    if (!crmConfig?.ghl_pipeline_id) { setCrmStages([]); return; }
    fetch(`/api/ghl/pipelines?pipeline_id=${crmConfig.ghl_pipeline_id}`).then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setCrmStages(d);
    });
  }, [crmConfig?.ghl_pipeline_id]);

  const load = useCallback(async () => {
    setLoading(true);
    const [res1, res2, res3] = await Promise.all([
      fetch(`/api/notion/clientes/${id}`).then((r) => r.json()),
      fetch(`/api/clientes-extra/${id}`).then((r) => r.json()),
      fetch(`/api/clientes/teses?notion_id=${id}`).then((r) => r.json()),
    ]);
    if (Array.isArray(res3)) setTeses(res3);

    // Load reunioes + resumos em paralelo
    const [reuniRes, resumoRes] = await Promise.all([
      fetch(`/api/clientes/reunioes?notion_id=${id}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/clientes/resumos?notion_id=${id}`).then((r) => r.json()).catch(() => []),
    ]);
    if (Array.isArray(reuniRes)) setReunioes(reuniRes);
    if (Array.isArray(resumoRes)) setResumos(resumoRes);

    // SDR/Closer que fechou — cruza por nome com tabela contratos
    if (res1?.nome) {
      fetch(`/api/dashboard/fechamento?nome=${encodeURIComponent(res1.nome as string)}`)
        .then((r) => r.json())
        .then((d) => setFechamento(d))
        .catch(() => setFechamento(null));
    }

    // Métricas de campanha — buscar ads_performance pelos ads do cliente
    // Estratégia simples: quando houver meta_account_id no clientes_extra, buscar Meta API
    // Caso contrário, buscar ads_metadata filtrado por campaign_name contendo o nome do cliente
    if (res1?.nome) {
      const { supabase } = await import("@/lib/supabase");
      const dias = periodoMetricas === "7d" ? 7 : periodoMetricas === "30d" ? 30 : 30;
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);
      const desdeStr = desde.toISOString().split("T")[0];
      // Buscar ads do cliente por campaign_name LIKE
      const { data: adsRows } = await supabase
        .from("ads_performance")
        .select("ad_id, data_ref, spend, leads, cpl, ads_metadata(campaign_name, ad_name)")
        .gte("data_ref", desdeStr)
        .limit(500);
      const filtered = (adsRows || []).filter((r) => {
        const meta = Array.isArray(r.ads_metadata) ? r.ads_metadata[0] : r.ads_metadata;
        const n = (meta?.campaign_name || "").toLowerCase();
        return n.includes((res1.nome as string).toLowerCase());
      });
      if (filtered.length > 0) {
        const spend = filtered.reduce((s: number, r: { spend: number }) => s + Number(r.spend || 0), 0);
        const leads = filtered.reduce((s: number, r: { leads: number }) => s + Number(r.leads || 0), 0);
        const cpl = leads > 0 ? spend / leads : 0;
        const byDayMap = new Map<string, { data: string; spend: number; leads: number; cpl: number }>();
        for (const r of filtered as { data_ref: string; spend: number; leads: number }[]) {
          const ex = byDayMap.get(r.data_ref) || { data: r.data_ref, spend: 0, leads: 0, cpl: 0 };
          ex.spend += Number(r.spend || 0);
          ex.leads += Number(r.leads || 0);
          ex.cpl = ex.leads > 0 ? ex.spend / ex.leads : 0;
          byDayMap.set(r.data_ref, ex);
        }
        setAdsData({ spend, leads, cpl, roas: 0, byDay: Array.from(byDayMap.values()).sort((a, b) => a.data.localeCompare(b.data)) });
      } else {
        setAdsData(null);
      }
    }

    // Contrato — buscar em clientes_receita por nome
    if (res1?.nome) {
      const { supabase } = await import("@/lib/supabase");
      const { data: cr } = await supabase.from("clientes_receita").select("*").ilike("nome", res1.nome).maybeSingle();
      if (cr) setContratoData(cr as typeof contratoData);
    }
    if (!res1.error) {
      setCliente(res1);
      setOtimizacoes(parseOtimizacoes(res1.blocks || []));
    }
    const extraData = res2.extra || {
      notion_id: String(id),
      meta_account_id: null, meta_account_name: null, meta_access_ativo: false,
      google_customer_id: null, google_account_name: null, google_access_ativo: false,
      whatsapp_group_url: null, whatsapp_resumo: null, whatsapp_ultima_atualizacao: null,
      saude_score: 50, saude_observacao: null, saude_tendencia: null,
      ultima_analise_ia: null, ultima_analise_ia_em: null,
    };
    setExtra(extraData);
    if (extraData.briefing) {
      setBriefingForm((prev) => ({ ...prev, ...(extraData.briefing as Record<string, string>) }));
    }
    if (extraData.ultima_analise_ia) setIaResult(extraData.ultima_analise_ia);
    setOtimizacoesDb(res2.otimizacoes || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Carregar obs_contrato e status_historico do pipeline clientes
  useEffect(() => {
    if (!cliente?.nome) return;
    const { supabase } = require("@/lib/supabase");
    // Buscar cliente no pipeline por nome
    supabase.from("clientes").select("id,obs_contrato,obs_contrato_atualizada_em,risco_churn,risco_churn_motivo")
      .ilike("nome", cliente.nome).limit(1).maybeSingle()
      .then(({ data }: { data: { id: string; obs_contrato: string | null; obs_contrato_atualizada_em: string | null; risco_churn: string | null } | null }) => {
        if (data) {
          setClientePipelineId(data.id);
          setObsContrato(data.obs_contrato || "");
          setObsContratoOriginal(data.obs_contrato || "");
          if (data.obs_contrato_atualizada_em) {
            setObsContratoMeta({ em: data.obs_contrato_atualizada_em, por: "" });
          }
          // Carregar histórico de status
          fetch(`/api/clientes/status-historico?cliente_id=${data.id}`)
            .then((r) => r.json())
            .then((d) => { if (d.historico) setStatusHistorico(d.historico); })
            .catch(() => {});
        }
      });
  }, [cliente?.nome]);

  const update = async (field: string, value: string) => {
    if (!cliente) return;
    setCliente((prev) => prev ? { ...prev, [field]: value } : prev);
    const res = await fetch("/api/notion/update", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notion_id: cliente.notion_id, field, value }),
    });
    const data = await res.json();
    if (!data.success) { toast.error(data.error || "Erro"); load(); }
  };

  // Captura snapshot atual de métricas para registrar no momento da confirmação
  const capturarSnapshot = useCallback(async (historicoUltimaMudanca: string | null = null): Promise<SnapshotMetricas> => {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
    const fim = hoje.toISOString().slice(0, 10);
    let spend: number | null = null;
    let leads: number | null = null;
    let cpl: number | null = null;
    try {
      const r = await fetch(`/api/meta-spend?since=${inicio}&until=${fim}`);
      const j = await r.json();
      if (!j.error) {
        spend = Number(j.spend ?? j.total_spend ?? 0);
        leads = Number(j.leads ?? j.total_leads ?? 0);
        cpl = leads > 0 ? spend / leads : null;
      }
    } catch { /* noop */ }
    // ROAS: LTV (valor_mensal * ltv_meses) / spend — calcula se tiver dados de contrato
    let roas: number | null = null;
    if (contratoData && spend && spend > 0) {
      const ltv = Number(contratoData.valor_mensal || 0) * Number(contratoData.fidelidade_meses || contratoData.parcelas_integral || 1);
      if (ltv > 0) roas = ltv / spend;
    }
    return {
      cpl_atual: cpl,
      roas_atual: roas,
      leads_periodo: leads,
      spend_periodo: spend,
      historico_ultima_mudanca: historicoUltimaMudanca,
      capturado_em: new Date().toISOString(),
    };
  }, [contratoData]);

  const iniciarEdicaoOtim = (o: OtimizacaoDB) => {
    setEditingOtim(o.id);
    setEditOtimForm({
      data: o.data,
      comentarios: o.comentarios || "",
      feito: o.feito || "",
      proxima_vez: o.proxima_vez || "",
      solicitado: o.solicitado || "",
    });
  };

  const confirmarEdicaoOtim = async (o: OtimizacaoDB) => {
    const historico = o.comentarios || o.feito || o.proxima_vez || o.solicitado
      ? `Anterior: 💬${o.comentarios || ""} | ✅${o.feito || ""} | 🔄${o.proxima_vez || ""} | 📋${o.solicitado || ""}`
      : null;
    const snapshot = await capturarSnapshot(historico);
    const res = await fetch("/api/clientes-extra/otimizacoes", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: o.id, ...editOtimForm, snapshot_metricas: snapshot, confirm: true }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    setOtimizacoesDb((prev) => prev.map((x) => x.id === o.id ? { ...x, ...editOtimForm, snapshot_metricas: snapshot, data_confirmacao: new Date().toISOString() } : x));
    setEditingOtim(null);
    toast.success("Otimização atualizada");
  };

  const salvarOtimizacao = async () => {
    if (!cliente) return;
    setSavingOtim(true);
    // Captura snapshot de métricas no momento da confirmação
    const snapshot = await capturarSnapshot(null);
    const [notionRes, sbRes] = await Promise.all([
      fetch("/api/notion/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notion_id: cliente.notion_id, field: "otimizacao_entry", value: JSON.stringify(novaOtim) }),
      }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/clientes-extra/otimizacoes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notion_id: cliente.notion_id, data: novaOtim.data,
          comentarios: novaOtim.comentarios, feito: novaOtim.feito,
          proxima_vez: novaOtim.proximaVez, solicitado: novaOtim.solicitado,
          snapshot_metricas: snapshot,
        }),
      }).then((r) => r.json()),
    ]);
    if (notionRes.success || sbRes.id) {
      toast.success("Otimização registrada");
      if (sbRes.id) setOtimizacoesDb((prev) => [sbRes, ...prev]);
      setNovaOtim({ data: new Date().toISOString().split("T")[0], comentarios: "", feito: "", proximaVez: "", solicitado: "" });
      setShowNovaOtim(false);
    } else toast.error("Erro ao salvar");
    setSavingOtim(false);
  };

  const salvarExtra = async (fields: Partial<ClienteExtra>) => {
    if (!cliente) return;
    setExtra((prev) => prev ? { ...prev, ...fields } : prev);
    const res = await fetch(`/api/clientes-extra/${cliente.notion_id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
  };

  const adicionarTese = async () => {
    if (!cliente || !novaTese.nome_tese.trim()) return;
    const res = await fetch("/api/clientes/teses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notion_id: cliente.notion_id, ...novaTese }),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else {
      setTeses((p) => [...p, data as Tese]);
      setNovaTese({ nome_tese: "", tipo: "", publico_alvo: "", status: "Ativa", data_ativacao: new Date().toISOString().slice(0, 10), observacoes: "" });
      toast.success("Tese adicionada");
    }
  };

  const atualizarTese = async (id: string, fields: Partial<Tese>) => {
    setTeses((p) => p.map((t) => t.id === id ? { ...t, ...fields } : t));
    await fetch("/api/clientes/teses", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
  };

  const deletarTese = async (id: string) => {
    if (!confirm("Remover esta tese? (soft delete — recuperável)")) return;
    await fetch(`/api/clientes/teses?id=${id}`, { method: "DELETE" });
    setTeses((p) => p.filter((t) => t.id !== id));
    toast.success("Removida");
  };

  const totalTeses = teses.reduce((s, t) => s + Number(t.orcamento || 0), 0);

  const criarReuniao = async () => {
    if (!cliente || !novaReuniao.data_reuniao) return;
    const res = await fetch("/api/clientes/reunioes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente_notion_id: cliente.notion_id, ...novaReuniao }),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else {
      setReunioes((p) => [data, ...p]);
      toast.success("Reunião registrada");
      setNovaReuniao({ tipo: "revisao", data_reuniao: new Date().toISOString().slice(0, 16), status: "realizada", notas: "", link_gravacao: "", transcricao: "" });
      setShowNovaReuniao(false);
    }
  };

  const gerarResumoReuniao = async (reuniaoId: string) => {
    const res = await fetch("/api/clientes/resumo-reuniao", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reuniao_id: reuniaoId }),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else {
      setReunioes((p) => p.map((r) => r.id === reuniaoId ? data : r));
      toast.success("Resumo gerado");
    }
  };

  const gerarResumoSemanal = async () => {
    if (!cliente) return;
    setGerandoResumo(true);
    const res = await fetch("/api/clientes/resumo-semanal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notion_id: cliente.notion_id }),
    });
    const data = await res.json();
    if (data.error) toast.error(data.error);
    else {
      setResumos((p) => [data, ...p]);
      toast.success("Resumo semanal gerado");
    }
    setGerandoResumo(false);
  };

  const registrarVerificacao = async () => {
    await salvarExtra({ ultima_verificacao: new Date().toISOString() } as Partial<ClienteExtra>);
    toast.success("Verificação registrada");
  };

  const deletarOtimizacaoDb = async (otId: string) => {
    if (!confirm("Remover esta otimização?")) return;
    await fetch(`/api/clientes-extra/otimizacoes?id=${otId}`, { method: "DELETE" });
    setOtimizacoesDb((prev) => prev.filter((o) => o.id !== otId));
    toast.success("Removido");
  };

  const gerarAnalise = async () => {
    if (!cliente) return;
    setIaLoading(true);

    // Otimizações (Notion + DB)
    const otimTxt = [
      ...otimizacoesDb.slice(0, 5).map((o) => `${o.data}: 💬 ${o.comentarios || ""} | ✅ ${o.feito || ""} | 🔄 ${o.proxima_vez || ""} | 📋 ${o.solicitado || ""}`),
      ...otimizacoes.slice(0, 5).map((o) => `${o.data}: ${o.texto}`),
    ].join("\n\n");

    const prompt = `Analise o cliente ${cliente.nome} da agência Comarka Ads cruzando dados de otimização, tráfego pago e comercial.

=== DADOS COMERCIAIS ===
Nicho: ${cliente.nicho || "Não informado"}
Status: ${cliente.status} | Situação: ${cliente.situacao} | Resultados: ${cliente.resultados}
Atenção: ${cliente.atencao} | Orçamento: R$${cliente.orcamento || "N/A"}
Último Feedback: ${cliente.ultimo_feedback || "N/A"}
Última Otimização: ${cliente.ultima_otimizacao || "N/A"}
Plataformas: ${cliente.plataformas || "N/A"}

=== CONTAS DE MÍDIA ===
Meta Ads: ${extra?.meta_account_name || "Não conectado"} (${extra?.meta_account_id || "sem ID"}) — ${extra?.meta_access_ativo ? "ACESSO OK" : "sem acesso"}
Google Ads: ${extra?.google_account_name || "Não conectado"} (${extra?.google_customer_id || "sem ID"}) — ${extra?.google_access_ativo ? "ACESSO OK" : "sem acesso"}

=== SAÚDE DO CLIENTE ===
Score: ${extra?.saude_score ?? 50}/100 | Tendência: ${extra?.saude_tendencia || "não avaliado"}
Observação: ${extra?.saude_observacao || "sem observações"}

=== RESUMO WHATSAPP (grupo) ===
${extra?.whatsapp_resumo || "Nenhum resumo disponível"}

=== OTIMIZAÇÕES RECENTES ===
${otimTxt || "Nenhuma otimização registrada"}

Em português BR, forneça uma análise estratégica cruzando TODOS os dados acima:
1. **Diagnóstico geral** — correlacione otimizações recentes com resultados
2. **Alinhamento comercial vs operacional** — o que o WhatsApp diz vs o que a operação está fazendo
3. **Ponto crítico principal** — o gargalo mais urgente
4. **3 ações imediatas recomendadas** — específicas e práticas
5. **Score de saúde recomendado** (0-100) com justificativa
6. **Previsão de churn** — risco de perder o cliente se manter tendência atual`;

    try {
      const res = await fetch("/api/closer-analysis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closerData: prompt, customPrompt: "Análise estratégica cruzada. Direto e prático. Português BR." }),
      });
      const data = await res.json();
      const analysis = data.analysis || "Erro ao gerar";
      setIaResult(analysis);
      // Persiste análise no banco
      if (analysis && !data.error) {
        salvarExtra({ ultima_analise_ia: analysis, ultima_analise_ia_em: new Date().toISOString() });
      }
    } catch { setIaResult("Erro de conexão"); }
    setIaLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!cliente) return <div className="text-center py-12"><p className="text-muted-foreground">Cliente não encontrado</p></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/clientes"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{cliente.nome}</h1>
            <Badge className={`text-xs ${cliente.status === "Ativo" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>{cliente.status}</Badge>
            {cliente.atencao && <Badge className={`text-xs ${ATENCAO_COLORS[cliente.atencao] || "bg-muted"}`}>{cliente.atencao}</Badge>}
            {extra?.ultima_verificacao && (() => {
              const dias = Math.floor((Date.now() - new Date(extra.ultima_verificacao!).getTime()) / 86400000);
              return dias > 7 ? <Badge className="text-xs bg-yellow-500/15 text-yellow-400">⚠️ Verificação {dias}d</Badge> : null;
            })()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowBriefing(true)}>
            📋 Briefing {extra?.briefing ? "✓" : ""}
          </Button>
          <Button size="sm" variant="outline" onClick={registrarVerificacao}>
            <Activity size={14} className="mr-1" />Registrar Verificação
          </Button>
        </div>
      </div>

      {/* Briefing Modal */}
      {showBriefing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowBriefing(false)}>
          <div className="bg-card border rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Briefing do Cliente</h3>
              <button onClick={() => setShowBriefing(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            {extra?.briefing_preenchido_em && (
              <p className="text-[10px] text-muted-foreground">Última atualização: {new Date(extra.briefing_preenchido_em).toLocaleString("pt-BR")}</p>
            )}
            <div className="space-y-3">
              {[
                { key: "area_atuacao", label: "Área de atuação", placeholder: "Ex: Direito Tributário" },
                { key: "cidade", label: "Cidade / região", placeholder: "Ex: São Paulo - SP" },
                { key: "objetivo_principal", label: "Objetivo principal", placeholder: "Ex: Captar 10 novos clientes/mês" },
                { key: "ticket_medio", label: "Ticket médio do cliente final", placeholder: "Ex: R$ 5.000" },
                { key: "orcamento_atual", label: "Orçamento atual em ads", placeholder: "Ex: R$ 3.000/mês" },
                { key: "historico_agencias", label: "Histórico anterior com agências", placeholder: "Ex: 2 agências, sem retorno" },
                { key: "observacoes", label: "Observações", placeholder: "Outras informações relevantes" },
              ].map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  {f.key === "observacoes" || f.key === "historico_agencias" ? (
                    <textarea value={briefingForm[f.key] || ""} onChange={(e) => setBriefingForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full text-sm bg-transparent border rounded-lg px-3 py-2 min-h-[60px]" />
                  ) : (
                    <Input value={briefingForm[f.key] || ""} onChange={(e) => setBriefingForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowBriefing(false)}>Cancelar</Button>
              <Button size="sm" onClick={async () => {
                await salvarExtra({ briefing: briefingForm, briefing_preenchido_em: new Date().toISOString() } as Partial<ClienteExtra>);
                toast.success("Briefing salvo");
                setShowBriefing(false);
              }}>Salvar Briefing</Button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { key: "geral", label: "Visão Geral" },
          { key: "teses", label: `Teses (${teses.length})` },
          { key: "metricas", label: "Métricas" },
          { key: "reunioes", label: `Reuniões (${reunioes.length})` },
          { key: "contrato", label: "Contrato" },
          { key: "resumos", label: "Resumos" },
          { key: "crm", label: "CRM" },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-[1px] ${activeTab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "geral" && (<>
      {/* Propriedades editáveis */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Status</Label>
              <select value={cliente.status} onChange={(e) => {
                const v = e.target.value;
                if (v === "Finalizado" && !["Ativo", "Pausado"].includes(cliente.status)) {
                  toast.error("Churn só pode ser registrado para clientes ativos ou pausados.");
                  return;
                }
                update("status", v);
              }} className="w-full text-xs bg-transparent border rounded-lg px-2 py-1.5">
                {STATUS_OPTS.map((o) => (
                  <option key={o} disabled={o === "Finalizado" && CHURN_BLOCKED_FROM.includes(cliente.status)}
                    title={o === "Finalizado" && CHURN_BLOCKED_FROM.includes(cliente.status) ? "Churn só pode ser registrado para clientes ativos" : ""}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Situação</Label>
              <select value={cliente.situacao} onChange={(e) => update("situacao", e.target.value)} className="w-full text-xs bg-transparent border rounded-lg px-2 py-1.5">
                {SITUACAO_OPTS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Resultados</Label>
              <select value={cliente.resultados} onChange={(e) => update("resultados", e.target.value)}
                className={`w-full text-xs rounded-lg px-2 py-1.5 border-0 ${RESULTADOS_COLORS[cliente.resultados] || "bg-transparent border"}`}>
                {RESULTADOS_OPTS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Atenção</Label>
              <select value={cliente.atencao} onChange={(e) => update("atencao", e.target.value)}
                className={`w-full text-xs rounded-lg px-2 py-1.5 border-0 ${ATENCAO_COLORS[cliente.atencao] || "bg-transparent border"}`}>
                {ATENCAO_OPTS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Dia Otimizar</Label>
              <select value={cliente.dia_otimizacao} onChange={(e) => update("dia_otimizacao", e.target.value)} className="w-full text-xs bg-transparent border rounded-lg px-2 py-1.5">
                <option value="">—</option>
                {DIA_OPTS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Orçamento</Label>
              <p className="text-sm font-mono">{cliente.orcamento ? formatCurrency(Number(cliente.orcamento)) : "—"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Último Feedback</Label>
              <input type="date" value={cliente.ultimo_feedback} onChange={(e) => update("ultimo_feedback", e.target.value)}
                className="w-full text-xs bg-transparent border rounded-lg px-2 py-1.5" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Data Otimização</Label>
              <input type="date" value={cliente.ultima_otimizacao} onChange={(e) => update("ultima_otimizacao", e.target.value)}
                className="w-full text-xs bg-transparent border rounded-lg px-2 py-1.5" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Analista (Gestor de Tráfego)</Label>
              <select
                value={gestores.find((g) => g.nome === cliente.analista)?.id || ""}
                onChange={(e) => {
                  const g = gestores.find((x) => x.id === e.target.value);
                  if (g) {
                    update("analista", g.nome);
                    setCliente((p) => p ? Object.assign({}, p, { analista: g.nome }) : p);
                  }
                }}
                className="w-full text-xs bg-transparent border rounded-lg px-2 py-1.5">
                <option value="">— selecionar —</option>
                {gestores.map((g) => (
                  <option key={g.id} value={g.id}>{g.nome}</option>
                ))}
              </select>
              {cliente.analista && !gestores.find((g) => g.nome === cliente.analista) && (
                <p className="text-[9px] text-muted-foreground">Atual: {cliente.analista}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Plataformas</Label>
              <p className="text-sm">{cliente.plataformas || "—"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Nicho</Label>
              <p className="text-sm">{cliente.nicho || "—"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">SDR responsável</Label>
              {fechamento?.sdr_nome ? (
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold flex items-center justify-center">
                    {fechamento.sdr_nome.charAt(0).toUpperCase()}
                  </span>
                  <p className="text-sm">{fechamento.sdr_nome}</p>
                </div>
              ) : <p className="text-sm text-muted-foreground">—</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Closer que fechou</Label>
              {fechamento?.closer_nome ? (
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-300 text-[10px] font-bold flex items-center justify-center">
                    {fechamento.closer_nome.charAt(0).toUpperCase()}
                  </span>
                  <p className="text-sm">{fechamento.closer_nome}</p>
                </div>
              ) : <p className="text-sm text-muted-foreground">—</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Níveis de Atenção */}
      <details className="border rounded-lg">
        <summary className="px-4 py-3 cursor-pointer text-sm font-medium hover:bg-muted/20">Níveis de Atenção</summary>
        <div className="px-4 py-3 border-t space-y-2 text-xs">
          <div className="p-2 rounded bg-orange-500/5 border border-orange-500/20">
            <strong className="text-orange-400">🥉 Bronze</strong> — Maior atenção. Resultados ruins/péssimos. Prioridade máxima de otimização.
          </div>
          <div className="p-2 rounded bg-slate-400/5 border border-slate-400/20">
            <strong className="text-slate-300">🥈 Prata</strong> — Atenção moderada. Resultados médios. Monitorar evolução.
          </div>
          <div className="p-2 rounded bg-yellow-500/5 border border-yellow-500/20">
            <strong className="text-yellow-400">🥇 Ouro</strong> — Resultados bons/ótimos. Foco em escala e retenção.
          </div>
        </div>
      </details>

      {/* Observações do Closer (5b) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Observações do Closer</CardTitle>
            {!editingObs && clientePipelineId && (
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditingObs(true)}>Editar</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {clientePipelineId ? (
            editingObs ? (
              <div className="space-y-2">
                <textarea value={obsContrato} onChange={(e) => setObsContrato(e.target.value)}
                  className="w-full text-sm bg-transparent border rounded-lg px-3 py-2 min-h-[80px]"
                  placeholder="Anotações do closer sobre este contrato..." />
                <div className="flex items-center gap-2">
                  <Button size="sm" disabled={savingObs} onClick={async () => {
                    setSavingObs(true);
                    const res = await fetch("/api/clientes/obs-contrato", {
                      method: "PATCH", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ cliente_id: clientePipelineId, obs_contrato: obsContrato }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      toast.success("Observação salva");
                      setObsContratoOriginal(obsContrato);
                      setObsContratoMeta({ em: new Date().toISOString(), por: "" });
                      setEditingObs(false);
                    } else toast.error(data.error || "Erro ao salvar");
                    setSavingObs(false);
                  }}>{savingObs ? "Salvando..." : "Salvar"}</Button>
                  <Button size="sm" variant="outline" onClick={() => { setObsContrato(obsContratoOriginal); setEditingObs(false); }}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm whitespace-pre-wrap">{obsContratoOriginal || <span className="text-muted-foreground italic">Sem observações</span>}</p>
                {obsContratoMeta && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Atualizado em {new Date(obsContratoMeta.em).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground italic">Cliente não encontrado no pipeline de churn</p>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Status (5d) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Histórico de Status</CardTitle>
            {statusHistorico.length > 0 && (
              <span className="text-[10px] text-muted-foreground">{statusHistorico.length} mudança(s)</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {statusHistorico.length > 0 ? (
            <div className="space-y-3">
              {statusHistorico.slice(0, showHistorico ? undefined : 5).map((h) => (
                <div key={h.id} className="flex items-start gap-3 relative">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 border-l pl-3 pb-3 border-border/30">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground line-through">{h.status_anterior || "—"}</span>
                      <span className="text-xs">→</span>
                      <span className="text-xs font-medium">{h.status_novo}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(h.criado_em).toLocaleString("pt-BR")}
                    </p>
                    {h.motivo && <p className="text-[10px] text-muted-foreground mt-0.5 italic">{h.motivo}</p>}
                  </div>
                </div>
              ))}
              {statusHistorico.length > 5 && !showHistorico && (
                <button onClick={() => setShowHistorico(true)} className="text-xs text-primary hover:underline">
                  Ver todas ({statusHistorico.length})
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma mudança de status registrada</p>
          )}
        </CardContent>
      </Card>

      </>)}

      {activeTab === "teses" && (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Teses</CardTitle>
            {totalTeses > 0 && (
              <span className="text-xs font-mono">Orçamento total: <strong className="text-primary">{formatCurrency(totalTeses)}</strong></span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {teses.map((t) => (
            <div key={t.id} className={`p-3 border rounded-lg space-y-2 ${TESE_STATUS_COLORS[t.status] || "border-border"}`}>
              <div className="flex items-center gap-2">
                <Input value={t.nome_tese || ""} onChange={(e) => setTeses((p) => p.map((x) => x.id === t.id ? { ...x, nome_tese: e.target.value } : x))}
                  onBlur={(e) => atualizarTese(t.id, { nome_tese: e.target.value })}
                  className="flex-1 h-8 text-xs font-medium" placeholder="Nome da tese..." />
                <select value={t.status} onChange={(e) => atualizarTese(t.id, { status: e.target.value as Tese["status"] })}
                  className={`text-[10px] rounded-full px-2 py-0.5 border ${TESE_STATUS_COLORS[t.status]}`}>
                  {TESE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => deletarTese(t.id)} className="text-muted-foreground hover:text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] text-muted-foreground">Tipo (Área do Direito)</Label>
                  <select value={t.tipo || ""} onChange={(e) => atualizarTese(t.id, { tipo: e.target.value })}
                    className="w-full text-[10px] bg-transparent border rounded px-1.5 py-1">
                    <option value="">—</option>
                    {TIPOS_DIREITO.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] text-muted-foreground">Público-alvo</Label>
                  <Input value={t.publico_alvo || ""}
                    onChange={(e) => setTeses((p) => p.map((x) => x.id === t.id ? { ...x, publico_alvo: e.target.value } : x))}
                    onBlur={(e) => atualizarTese(t.id, { publico_alvo: e.target.value })}
                    className="h-7 text-[10px]" placeholder="ex: mães em licença" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] text-muted-foreground">Data ativação</Label>
                  <input type="date" value={t.data_ativacao || ""}
                    onChange={(e) => atualizarTese(t.id, { data_ativacao: e.target.value })}
                    className="w-full h-7 text-[10px] bg-transparent border rounded px-1.5" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] text-muted-foreground">Orçamento</Label>
                  <input type="number" value={t.orcamento || 0}
                    onChange={(e) => setTeses((p) => p.map((x) => x.id === t.id ? { ...x, orcamento: Number(e.target.value) } : x))}
                    onBlur={(e) => atualizarTese(t.id, { orcamento: Number(e.target.value) })}
                    className="w-full h-7 text-[10px] bg-transparent border rounded px-1.5 text-right font-mono" placeholder="0" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] text-muted-foreground">Observações</Label>
                <Input value={t.observacoes || ""}
                  onChange={(e) => setTeses((p) => p.map((x) => x.id === t.id ? { ...x, observacoes: e.target.value } : x))}
                  onBlur={(e) => atualizarTese(t.id, { observacoes: e.target.value })}
                  className="h-7 text-[10px]" placeholder="notas livres..." />
              </div>
            </div>
          ))}

          {/* Nova tese */}
          <div className="p-3 border border-dashed rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Input value={novaTese.nome_tese} onChange={(e) => setNovaTese({ ...novaTese, nome_tese: e.target.value })}
                placeholder="Nome da nova tese..." className="flex-1 h-8 text-xs"
                onKeyDown={(e) => { if (e.key === "Enter") adicionarTese(); }} />
              <select value={novaTese.status} onChange={(e) => setNovaTese({ ...novaTese, status: e.target.value as Tese["status"] })}
                className="text-[10px] bg-transparent border rounded px-2 py-1">
                {TESE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <Button size="sm" onClick={adicionarTese}><Plus size={12} /></Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select value={novaTese.tipo} onChange={(e) => setNovaTese({ ...novaTese, tipo: e.target.value })}
                className="text-[10px] bg-transparent border rounded px-1.5 py-1">
                <option value="">Tipo (Área)</option>
                {TIPOS_DIREITO.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
              </select>
              <Input value={novaTese.publico_alvo} onChange={(e) => setNovaTese({ ...novaTese, publico_alvo: e.target.value })}
                className="h-7 text-[10px]" placeholder="Público-alvo" />
              <input type="date" value={novaTese.data_ativacao}
                onChange={(e) => setNovaTese({ ...novaTese, data_ativacao: e.target.value })}
                className="h-7 text-[10px] bg-transparent border rounded px-1.5" />
            </div>
          </div>
          {teses.length > 0 && (
            <p className="text-[10px] text-muted-foreground">A soma dos orçamentos das teses substitui o orçamento principal do cliente automaticamente.</p>
          )}
        </CardContent>
      </Card>
      )}

      {activeTab === "geral" && (<>
      {/* Nicho & Teses (catálogo global) */}
      <NichoTesesSection clienteId={String(id)} />

      {/* Teses (substitui a antiga seção Saúde do Cliente) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Activity size={16} className="text-green-400" />Teses</CardTitle>
            <button onClick={() => setActiveTab("teses")} className="text-[10px] text-primary hover:underline">Gerenciar →</button>
          </div>
        </CardHeader>
        <CardContent>
          {teses.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma tese cadastrada. Vá em <button onClick={() => setActiveTab("teses")} className="text-primary hover:underline">Teses</button> para adicionar.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {teses.map((t) => (
                <div key={t.id} className={`p-2 border rounded-lg ${TESE_STATUS_COLORS[t.status] || ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium truncate">{t.nome_tese || "(sem nome)"}</p>
                    <Badge className={`text-[8px] ${TESE_STATUS_COLORS[t.status] || ""}`}>{t.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                    {t.tipo && <span>{t.tipo}</span>}
                    {t.publico_alvo && <span>· {t.publico_alvo}</span>}
                    {t.data_ativacao && <span>· desde {new Date(t.data_ativacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contas de Mídia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Megaphone size={16} className="text-blue-400" />Contas de Mídia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Meta Ads */}
          <div className="p-3 rounded-lg border bg-blue-500/5 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">Meta Ads <Badge className={`text-[8px] ${extra?.meta_access_ativo ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>{extra?.meta_access_ativo ? "Conectado" : "Desconectado"}</Badge></h4>
              <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                <input type="checkbox" checked={extra?.meta_access_ativo || false}
                  onChange={(e) => salvarExtra({ meta_access_ativo: e.target.checked })} />
                Acesso ativo
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Ad Account ID</Label>
                <Input value={extra?.meta_account_id || ""}
                  onChange={(e) => setExtra((p) => p ? { ...p, meta_account_id: e.target.value } : p)}
                  onBlur={(e) => salvarExtra({ meta_account_id: e.target.value })}
                  placeholder="act_1234567890" className="h-8 text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Nome da conta</Label>
                <Input value={extra?.meta_account_name || ""}
                  onChange={(e) => setExtra((p) => p ? { ...p, meta_account_name: e.target.value } : p)}
                  onBlur={(e) => salvarExtra({ meta_account_name: e.target.value })}
                  placeholder="Nome do anunciante" className="h-8 text-xs" />
              </div>
            </div>
            {extra?.meta_account_id && (
              <a href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${extra.meta_account_id.replace("act_", "")}`}
                target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-blue-400 hover:underline flex items-center gap-1">
                Abrir no Business Manager <ExternalLink size={10} />
              </a>
            )}
          </div>

          {/* Google Ads */}
          <div className="p-3 rounded-lg border bg-emerald-500/5 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">Google Ads <Badge className={`text-[8px] ${extra?.google_access_ativo ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>{extra?.google_access_ativo ? "Conectado" : "Desconectado"}</Badge></h4>
              <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                <input type="checkbox" checked={extra?.google_access_ativo || false}
                  onChange={(e) => salvarExtra({ google_access_ativo: e.target.checked })} />
                Acesso ativo
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Customer ID</Label>
                <Input value={extra?.google_customer_id || ""}
                  onChange={(e) => setExtra((p) => p ? { ...p, google_customer_id: e.target.value } : p)}
                  onBlur={(e) => salvarExtra({ google_customer_id: e.target.value })}
                  placeholder="123-456-7890" className="h-8 text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Nome da conta</Label>
                <Input value={extra?.google_account_name || ""}
                  onChange={(e) => setExtra((p) => p ? { ...p, google_account_name: e.target.value } : p)}
                  onBlur={(e) => salvarExtra({ google_account_name: e.target.value })}
                  placeholder="Nome do anunciante" className="h-8 text-xs" />
              </div>
            </div>
            {extra?.google_customer_id && (
              <a href={`https://ads.google.com/aw/overview?ocid=${extra.google_customer_id.replace(/-/g, "")}`}
                target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1">
                Abrir no Google Ads <ExternalLink size={10} />
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumo WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><MessageCircle size={16} className="text-green-400" />Resumo WhatsApp (grupo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[10px]">Link do grupo</Label>
            <Input value={extra?.whatsapp_group_url || ""}
              onChange={(e) => setExtra((p) => p ? { ...p, whatsapp_group_url: e.target.value } : p)}
              onBlur={(e) => salvarExtra({ whatsapp_group_url: e.target.value })}
              placeholder="https://chat.whatsapp.com/..." className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Resumo das últimas conversas (cole aqui)</Label>
            <textarea value={extra?.whatsapp_resumo || ""}
              onChange={(e) => setExtra((p) => p ? { ...p, whatsapp_resumo: e.target.value } : p)}
              onBlur={(e) => salvarExtra({ whatsapp_resumo: e.target.value, whatsapp_ultima_atualizacao: new Date().toISOString() })}
              placeholder="Cole o resumo das últimas conversas, reclamações, pedidos e feedbacks do cliente no grupo..."
              className="w-full min-h-[100px] text-xs bg-transparent border rounded-lg p-2 font-mono" />
            {extra?.whatsapp_ultima_atualizacao && (
              <p className="text-[9px] text-muted-foreground">
                Última atualização: {new Date(extra.whatsapp_ultima_atualizacao).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Otimizações */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Otimizações ({otimizacoesDb.length + otimizacoes.length})</CardTitle>
            <Button size="sm" onClick={() => setShowNovaOtim(!showNovaOtim)}>
              <Plus size={14} className="mr-1" />{showNovaOtim ? "Cancelar" : "Nova Otimização"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showNovaOtim && (
            <div className="p-3 border rounded-lg space-y-3 bg-muted/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Data</Label><Input type="date" value={novaOtim.data} onChange={(e) => setNovaOtim({ ...novaOtim, data: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Comentários</Label><Input value={novaOtim.comentarios} onChange={(e) => setNovaOtim({ ...novaOtim, comentarios: e.target.value })} placeholder="Observações gerais..." /></div>
                <div className="space-y-1"><Label className="text-xs">O que foi feito</Label><Input value={novaOtim.feito} onChange={(e) => setNovaOtim({ ...novaOtim, feito: e.target.value })} placeholder="Ações realizadas..." /></div>
                <div className="space-y-1"><Label className="text-xs">O que pode ser feito</Label><Input value={novaOtim.proximaVez} onChange={(e) => setNovaOtim({ ...novaOtim, proximaVez: e.target.value })} placeholder="Próximas ações..." /></div>
                <div className="space-y-1"><Label className="text-xs">O que foi solicitado</Label><Input value={novaOtim.solicitado} onChange={(e) => setNovaOtim({ ...novaOtim, solicitado: e.target.value })} placeholder="Pedidos do cliente..." /></div>
              </div>
              <Button onClick={salvarOtimizacao} disabled={savingOtim}>{savingOtim ? "Salvando..." : "Salvar Otimização"}</Button>
            </div>
          )}

          {otimizacoesDb.length === 0 && otimizacoes.length === 0 && !showNovaOtim && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma otimização registrada</p>
          )}

          {/* Otimizações editáveis do Supabase */}
          {otimizacoesDb.map((o) => (
            <div key={o.id} className="border rounded-lg">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-medium">{new Date(o.data + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                <div className="flex items-center gap-2">
                  <Badge className="text-[8px] bg-indigo-500/15 text-indigo-400">DB</Badge>
                  {editingOtim === o.id ? (
                    <button onClick={() => setEditingOtim(null)} className="text-[10px] text-muted-foreground hover:text-foreground">Cancelar</button>
                  ) : (
                    <button onClick={() => iniciarEdicaoOtim(o)} className="text-[10px] text-muted-foreground hover:text-primary">Editar</button>
                  )}
                  <button onClick={() => deletarOtimizacaoDb(o.id)} className="text-muted-foreground hover:text-red-400">
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
              {editingOtim === o.id ? (
                <div className="px-3 pb-3 border-t space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Input type="date" value={editOtimForm.data} onChange={(e) => setEditOtimForm({ ...editOtimForm, data: e.target.value })} className="h-8 text-xs" />
                    <Input value={editOtimForm.comentarios} onChange={(e) => setEditOtimForm({ ...editOtimForm, comentarios: e.target.value })} placeholder="Comentários" className="h-8 text-xs" />
                    <Input value={editOtimForm.feito} onChange={(e) => setEditOtimForm({ ...editOtimForm, feito: e.target.value })} placeholder="O que foi feito" className="h-8 text-xs" />
                    <Input value={editOtimForm.proxima_vez} onChange={(e) => setEditOtimForm({ ...editOtimForm, proxima_vez: e.target.value })} placeholder="Próxima vez" className="h-8 text-xs" />
                    <Input value={editOtimForm.solicitado} onChange={(e) => setEditOtimForm({ ...editOtimForm, solicitado: e.target.value })} placeholder="Solicitado" className="h-8 text-xs" />
                  </div>
                  <Button size="sm" onClick={() => confirmarEdicaoOtim(o)}>Confirmar</Button>
                </div>
              ) : (
                <div className="px-3 pb-3 border-t space-y-1 text-xs">
                  {o.comentarios && <p><strong>💬 Comentários:</strong> {o.comentarios}</p>}
                  {o.feito && <p><strong>✅ Feito:</strong> {o.feito}</p>}
                  {o.proxima_vez && <p><strong>🔄 Próxima vez:</strong> {o.proxima_vez}</p>}
                  {o.solicitado && <p><strong>📋 Solicitado:</strong> {o.solicitado}</p>}
                  {o.snapshot_metricas && (
                    <div className="mt-2 pt-2 border-t border-dashed">
                      <button onClick={() => setExpandedSnapshot(expandedSnapshot === o.id ? null : o.id)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                        {expandedSnapshot === o.id ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        Métricas no momento da confirmação
                      </button>
                      {expandedSnapshot === o.id && (
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                          <div><span className="text-muted-foreground">CPL:</span> <strong>{o.snapshot_metricas.cpl_atual != null ? formatCurrency(o.snapshot_metricas.cpl_atual) : "—"}</strong></div>
                          <div><span className="text-muted-foreground">ROAS:</span> <strong>{o.snapshot_metricas.roas_atual != null ? o.snapshot_metricas.roas_atual.toFixed(2) + "x" : "—"}</strong></div>
                          <div><span className="text-muted-foreground">Leads:</span> <strong>{o.snapshot_metricas.leads_periodo ?? "—"}</strong></div>
                          <div><span className="text-muted-foreground">Spend:</span> <strong>{o.snapshot_metricas.spend_periodo != null ? formatCurrency(o.snapshot_metricas.spend_periodo) : "—"}</strong></div>
                          {o.snapshot_metricas.historico_ultima_mudanca && (
                            <div className="col-span-2 md:col-span-4 text-[9px] text-muted-foreground italic pt-1 border-t border-dashed">
                              {o.snapshot_metricas.historico_ultima_mudanca}
                            </div>
                          )}
                          {o.data_confirmacao && (
                            <div className="col-span-2 md:col-span-4 text-[9px] text-muted-foreground">
                              Confirmado em {new Date(o.data_confirmacao).toLocaleString("pt-BR")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Otimizações do Notion (legado, apenas leitura) */}
          {otimizacoes.map((o, i) => (
            <div key={`notion-${i}`} className="border rounded-lg">
              <button onClick={() => setExpandedOtim(expandedOtim === i ? null : i)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/20 transition-colors">
                <span className="text-sm font-medium">{o.data}</span>
                <div className="flex items-center gap-2">
                  <Badge className="text-[8px] bg-slate-500/15 text-slate-400">Notion</Badge>
                  {expandedOtim === i ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </button>
              {expandedOtim === i && (
                <div className="px-3 pb-3 border-t">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap mt-2">{o.texto}</pre>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Análise IA */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Sparkles size={16} className="text-purple-400" />Análise IA</CardTitle>
            <Button size="sm" onClick={gerarAnalise} disabled={iaLoading}>
              <Sparkles size={14} className="mr-1" />{iaLoading ? "Gerando..." : "Gerar Análise"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {iaResult ? (
            <div className="prose prose-sm prose-invert max-w-none text-xs whitespace-pre-wrap">{iaResult}</div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Clique para gerar uma análise do cliente via IA</p>
          )}
        </CardContent>
      </Card>
      </>)}

      {/* TAB: Reuniões */}
      {activeTab === "reunioes" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Reuniões ({reunioes.length})</CardTitle>
              <Button size="sm" onClick={() => setShowNovaReuniao(!showNovaReuniao)}>
                <Plus size={14} className="mr-1" />{showNovaReuniao ? "Cancelar" : "Nova Reunião"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showNovaReuniao && (
              <div className="p-3 border rounded-lg space-y-3 bg-muted/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Tipo</Label>
                    <select value={novaReuniao.tipo} onChange={(e) => setNovaReuniao({ ...novaReuniao, tipo: e.target.value })}
                      className="w-full text-xs bg-transparent border rounded-lg px-3 py-2">
                      <option value="revisao">Revisão</option>
                      <option value="onboarding">Onboarding</option>
                      <option value="estrategia">Estratégia</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Data e hora</Label>
                    <Input type="datetime-local" value={novaReuniao.data_reuniao} onChange={(e) => setNovaReuniao({ ...novaReuniao, data_reuniao: e.target.value })} />
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Status</Label>
                    <select value={novaReuniao.status} onChange={(e) => setNovaReuniao({ ...novaReuniao, status: e.target.value })}
                      className="w-full text-xs bg-transparent border rounded-lg px-3 py-2">
                      <option value="agendada">Agendada</option>
                      <option value="realizada">Realizada</option>
                      <option value="cancelada">Cancelada</option>
                      <option value="no-show">No-show</option>
                    </select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Link da gravação</Label>
                    <Input value={novaReuniao.link_gravacao} onChange={(e) => setNovaReuniao({ ...novaReuniao, link_gravacao: e.target.value })} placeholder="https://..." />
                  </div>
                  <div className="col-span-2 space-y-1"><Label className="text-xs">Notas</Label>
                    <Input value={novaReuniao.notas} onChange={(e) => setNovaReuniao({ ...novaReuniao, notas: e.target.value })} />
                  </div>
                  <div className="col-span-2 space-y-1"><Label className="text-xs">Transcrição (cole aqui para gerar resumo com IA depois)</Label>
                    <textarea value={novaReuniao.transcricao} onChange={(e) => setNovaReuniao({ ...novaReuniao, transcricao: e.target.value })}
                      className="w-full min-h-[80px] text-xs bg-transparent border rounded-lg p-2 font-mono" />
                  </div>
                </div>
                <Button onClick={criarReuniao}>Salvar Reunião</Button>
              </div>
            )}

            {reunioes.length === 0 && !showNovaReuniao && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma reunião registrada</p>
            )}

            {reunioes.map((r) => (
              <div key={r.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="text-[9px] bg-blue-500/15 text-blue-400">{r.tipo}</Badge>
                    <Badge className={`text-[9px] ${r.status === "realizada" ? "bg-green-500/15 text-green-400" : r.status === "no-show" ? "bg-red-500/15 text-red-400" : "bg-yellow-500/15 text-yellow-400"}`}>{r.status}</Badge>
                    <span className="text-xs font-mono text-muted-foreground">{new Date(r.data_reuniao).toLocaleString("pt-BR")}</span>
                  </div>
                  {r.transcricao && !r.resumo_ia && (
                    <Button size="sm" variant="outline" onClick={() => gerarResumoReuniao(r.id)}>
                      <Sparkles size={12} className="mr-1" />Resumir IA
                    </Button>
                  )}
                </div>
                {r.notas && <p className="text-xs">{r.notas}</p>}
                {r.link_gravacao && <a href={r.link_gravacao} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline">Ver gravação</a>}
                {r.resumo_ia && (
                  <div className="p-2 rounded bg-purple-500/5 border border-purple-500/20 text-xs whitespace-pre-wrap">
                    <div className="flex items-center gap-1 mb-1 text-purple-400 text-[9px] font-medium"><Sparkles size={10} />RESUMO IA</div>
                    {r.resumo_ia}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* TAB: Métricas de Campanha */}
      {activeTab === "metricas" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Métricas de Campanha</CardTitle>
              <div className="flex bg-muted rounded-lg p-0.5">
                {(["7d", "30d", "mes"] as const).map((p) => (
                  <button key={p} onClick={() => setPeriodoMetricas(p)}
                    className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${periodoMetricas === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                    {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Este mês"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {adsData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/20 text-center">
                    <p className="text-[10px] text-muted-foreground">Investimento</p>
                    <p className="text-xl font-bold">{formatCurrency(adsData.spend)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 text-center">
                    <p className="text-[10px] text-muted-foreground">Leads</p>
                    <p className="text-xl font-bold">{adsData.leads}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 text-center">
                    <p className="text-[10px] text-muted-foreground">CPL Médio</p>
                    <p className="text-xl font-bold">{adsData.leads > 0 ? formatCurrency(adsData.cpl) : "—"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 text-center">
                    <p className="text-[10px] text-muted-foreground">Dias com dados</p>
                    <p className="text-xl font-bold">{adsData.byDay.length}</p>
                  </div>
                </div>

                {adsData.byDay.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2">Evolução diária</p>
                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                      {adsData.byDay.map((d) => (
                        <div key={d.data} className="flex items-center justify-between p-2 border rounded-lg text-xs">
                          <span className="font-mono">{new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                          <div className="flex items-center gap-4">
                            <span className="font-mono">{formatCurrency(d.spend)}</span>
                            <span className="font-mono">{d.leads} leads</span>
                            <span className="font-mono text-muted-foreground">{d.leads > 0 ? formatCurrency(d.cpl) : "—"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 space-y-2">
                <p className="text-sm text-muted-foreground">Nenhuma métrica de campanha encontrada</p>
                <p className="text-[10px] text-muted-foreground">As métricas são filtradas por nome do cliente em <strong>campaign_name</strong>. Certifique-se que as campanhas da Meta contêm o nome do cliente ou configure o <strong>Meta Account ID</strong> na aba Visão Geral.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB: Contrato */}
      {activeTab === "contrato" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Contrato</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {contratoData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/20">
                    <p className="text-[10px] text-muted-foreground">Mensalidade</p>
                    <p className="text-lg font-bold font-mono">{formatCurrency(Number(contratoData.valor_mensal || 0))}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20">
                    <p className="text-[10px] text-muted-foreground">Tipo</p>
                    <p className="text-sm font-medium">{contratoData.tipo_contrato || "—"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20">
                    <p className="text-[10px] text-muted-foreground">Dia Pagamento</p>
                    <p className="text-sm font-medium">{contratoData.dia_pagamento || "—"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20">
                    <p className="text-[10px] text-muted-foreground">Fechamento</p>
                    <p className="text-sm font-medium">{contratoData.mes_fechamento || "—"}</p>
                  </div>
                </div>

                {contratoData.valor_integral && (
                  <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                    <p className="text-xs font-medium text-blue-400 mb-2">Pagamento Integral</p>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div><span className="text-muted-foreground">Valor Total:</span> <strong>{formatCurrency(Number(contratoData.valor_integral))}</strong></div>
                      <div><span className="text-muted-foreground">Forma:</span> <strong>{contratoData.forma_pagamento || "—"}</strong></div>
                      <div><span className="text-muted-foreground">Parcelas:</span> <strong>{contratoData.parcelas_integral || "—"}x</strong></div>
                    </div>
                  </div>
                )}

                {contratoData.fidelidade_meses && (
                  <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                    <p className="text-xs font-medium text-purple-400 mb-2">Fidelidade</p>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div><span className="text-muted-foreground">Duração:</span> <strong>{contratoData.fidelidade_meses} meses</strong></div>
                      <div><span className="text-muted-foreground">Início:</span> <strong>{contratoData.fidelidade_inicio || "—"}</strong></div>
                      <div><span className="text-muted-foreground">Fim:</span> <strong>{contratoData.fidelidade_fim || "—"}</strong></div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum contrato vinculado em Entradas</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB: Resumos Semanais */}
      {activeTab === "resumos" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Resumos Semanais</CardTitle>
              <Button size="sm" onClick={gerarResumoSemanal} disabled={gerandoResumo}>
                <Sparkles size={14} className="mr-1" />{gerandoResumo ? "Gerando..." : "Gerar Resumo Semanal"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {resumos.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum resumo gerado ainda</p>}
            {resumos.map((r) => (
              <div key={r.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                  {r.periodo_inicio && r.periodo_fim && (
                    <span>{r.periodo_inicio} a {r.periodo_fim}</span>
                  )}
                </div>
                <div className="text-xs whitespace-pre-wrap">{r.conteudo}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* TAB: CRM (GHL) */}
      {activeTab === "crm" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Conexão CRM (GoHighLevel)</CardTitle>
              {crmConfig?.conexao_ativa ? (
                <Badge className="text-[9px] bg-green-500/15 text-green-400">Ativa</Badge>
              ) : (
                <Badge className="text-[9px] bg-slate-500/15 text-slate-400">Desconectado</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">GHL Subaccount ID</Label>
                <Input value={crmConfig?.ghl_subaccount_id || ""}
                  onChange={(e) => setCrmConfig((p) => ({
                    ghl_subaccount_id: e.target.value,
                    ghl_pipeline_id: p?.ghl_pipeline_id || "",
                    stage_mapping: p?.stage_mapping || {},
                    conexao_ativa: p?.conexao_ativa || false,
                    last_sync_at: p?.last_sync_at || null,
                    last_test_at: p?.last_test_at || null,
                    last_test_result: p?.last_test_result || null,
                  }))}
                  placeholder="locationId da GHL" className="h-8 text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Pipeline principal</Label>
                <select value={crmConfig?.ghl_pipeline_id || ""}
                  onChange={(e) => setCrmConfig((p) => ({
                    ghl_subaccount_id: p?.ghl_subaccount_id || "",
                    ghl_pipeline_id: e.target.value,
                    stage_mapping: p?.stage_mapping || {},
                    conexao_ativa: p?.conexao_ativa || false,
                    last_sync_at: p?.last_sync_at || null,
                    last_test_at: p?.last_test_at || null,
                    last_test_result: p?.last_test_result || null,
                  }))}
                  className="w-full h-8 text-xs bg-transparent border rounded px-2">
                  <option value="">— selecionar —</option>
                  {crmPipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={crmTesting || !crmConfig?.ghl_subaccount_id}
                onClick={async () => {
                  if (!cliente) return;
                  setCrmTesting(true);
                  const res = await fetch("/api/ghl/test-connection", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ cliente_id: cliente.notion_id, ghl_subaccount_id: crmConfig?.ghl_subaccount_id }),
                  });
                  const j = await res.json();
                  setCrmTesting(false);
                  if (j.ok) {
                    toast.success(`Conexão OK: ${j.message}`);
                    setCrmConfig((p) => p ? { ...p, conexao_ativa: true, last_test_at: new Date().toISOString(), last_test_result: "ok" } : p);
                  } else {
                    toast.error(`Falha: ${j.message || j.error}`);
                    setCrmConfig((p) => p ? { ...p, conexao_ativa: false, last_test_at: new Date().toISOString(), last_test_result: "erro" } : p);
                  }
                }}>
                {crmTesting ? "Testando..." : "Testar conexão"}
              </Button>
              <Button size="sm" disabled={!cliente}
                onClick={async () => {
                  if (!cliente || !crmConfig) return;
                  const res = await fetch("/api/clientes/crm-config", {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      cliente_id: cliente.notion_id,
                      ghl_subaccount_id: crmConfig.ghl_subaccount_id,
                      ghl_pipeline_id: crmConfig.ghl_pipeline_id,
                      stage_mapping: crmConfig.stage_mapping,
                    }),
                  });
                  const j = await res.json();
                  if (j.error) toast.error(j.error);
                  else toast.success("Configuração salva");
                }}>
                Salvar
              </Button>
              <div className="text-[10px] text-muted-foreground ml-auto">
                {crmConfig?.last_test_at && (
                  <span>Último teste: {new Date(crmConfig.last_test_at).toLocaleString("pt-BR")} ({crmConfig.last_test_result || "—"})</span>
                )}
              </div>
            </div>

            {/* Mapeamento de etapas */}
            {crmConfig?.ghl_pipeline_id && crmStages.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs text-muted-foreground">Mapeamento de etapas → status interno</Label>
                <div className="space-y-1.5">
                  {crmStages.map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className="text-[11px] w-1/2 truncate">{s.position}. {s.name}</span>
                      <select value={crmConfig.stage_mapping?.[s.id] || ""}
                        onChange={(e) => setCrmConfig((p) => p ? { ...p, stage_mapping: { ...(p.stage_mapping || {}), [s.id]: e.target.value } } : p)}
                        className="flex-1 h-7 text-[10px] bg-transparent border rounded px-2">
                        <option value="">— ignorar —</option>
                        {STATUS_INTERNOS.map((st) => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[10px] text-muted-foreground border-t pt-2">
              Última sincronização: {crmConfig?.last_sync_at ? new Date(crmConfig.last_sync_at).toLocaleString("pt-BR") : "—"}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
