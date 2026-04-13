"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Closer, LancamentoDiario, MetaCloser } from "@/types/database";
import { calcularScore, type ScoreDetalhe } from "@/lib/calculos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MonthSelector } from "@/components/month-selector";
import {
  formatCurrency,
  formatPercent,
  getCurrentMonth,
} from "@/lib/format";
import { ArrowLeft, Sparkles, ChevronDown, ChevronUp, Save, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/currency-input";
import { toast } from "sonner";

const ORIGENS = ["Tráfego Pago", "Orgânico", "Social Selling", "Indicação", "Workshop"];

interface ContratoForm {
  cliente_nome: string; origem_lead: string; sdr_id: string;
  valor_entrada: number; mrr: number; meses_contrato: number;
  valor_variavel: boolean; valores_mensais: number[]; obs: string;
}
const emptyContrato: ContratoForm = {
  cliente_nome: "", origem_lead: "", sdr_id: "",
  valor_entrada: 0, mrr: 0, meses_contrato: 6,
  valor_variavel: false, valores_mensais: [], obs: "",
};

// --- Diagnóstico por regras fixas ---
interface Diagnostico {
  tipo: "critico" | "atencao" | "info";
  titulo: string;
  descricao: string;
  sugestao: string;
}

function gerarDiagnosticos(
  detalhes: ScoreDetalhe[],
  score: number,
  metaContratos: number
): Diagnostico[] {
  const diags: Diagnostico[] = [];
  const get = (label: string) => detalhes.find((d) => d.label.toLowerCase().includes(label))?.pontos ?? 100;

  const convPts = get("conversao");
  const metaPts = get("meta");
  const aprovPts = get("aproveitamento");
  const ticketPts = get("ticket");

  if (convPts < 65) {
    diags.push({
      tipo: "critico",
      titulo: "Conversão Baixa",
      descricao:
        "Taxa de conversão abaixo do esperado. Possíveis causas: objeções não tratadas na reunião, falta de urgência na oferta, ou perfil de lead inadequado.",
      sugestao:
        "Revisar gravações de reuniões. Mapear as 3 principais objeções recebidas e criar respostas padrão.",
    });
  }

  if (convPts >= 65 && metaPts > 0 && metaPts < 70) {
    diags.push({
      tipo: "atencao",
      titulo: "Boa Conversão, Volume Baixo",
      descricao:
        "Boa taxa de conversão, mas volume insuficiente de reuniões realizadas. O problema não é técnica — é pipeline.",
      sugestao:
        "Aumentar volume de agendamentos com o SDR. Verificar se há gargalo na qualificação ou no agendamento.",
    });
  }

  if (aprovPts < 65) {
    diags.push({
      tipo: "atencao",
      titulo: "Aproveitamento Baixo",
      descricao:
        "Muitos agendamentos recebidos não estão sendo convertidos em reuniões realizadas. Possíveis causas: confirmação fraca, leads frios chegando para o closer, ou falta de follow-up pré-reunião.",
      sugestao:
        "Implementar sequência de confirmação 24h e 1h antes. Verificar qualidade dos leads entregues pelo SDR.",
    });
  }

  if (ticketPts < 65) {
    diags.push({
      tipo: "atencao",
      titulo: "Ticket Abaixo da Meta",
      descricao:
        "Ticket médio abaixo da meta. Possível causa: closer aceitando negociações fora do padrão ou não apresentando o valor corretamente antes do preço.",
      sugestao:
        "Revisar o script de apresentação de proposta. Reforçar ancoragem de valor antes de mencionar o investimento.",
    });
  }

  if (metaContratos === 0) {
    diags.push({
      tipo: "info",
      titulo: "Meta Não Configurada",
      descricao:
        "Meta de contratos não configurada para este closer. O critério de atingimento está sendo ignorado no cálculo. Configure a meta para uma avaliação completa.",
      sugestao: "Acesse a página de configuração e defina a meta mensal de contratos.",
    });
  }

  if (score >= 70 && diags.length === 0) {
    diags.push({
      tipo: "info",
      titulo: "Closer Saudável",
      descricao:
        "Closer dentro dos parâmetros esperados. Manter acompanhamento semanal e monitorar consistência ao longo do mês.",
      sugestao: "Manter o ritmo atual e buscar oportunidades de melhoria incremental.",
    });
  }

  return diags;
}

// --- Prompt padrão ---
const PROMPT_PADRAO = `Você é um especialista em performance comercial de agências de marketing digital focadas no nicho jurídico. Analise os dados de performance do closer abaixo e forneça:

1. DIAGNÓSTICO: 2-3 parágrafos explicando o padrão de performance, cruzando os critérios entre si (ex: conversão alta mas aproveitamento baixo indica problema diferente de conversão baixa com aproveitamento alto)

2. CAUSAS PROVÁVEIS: Lista de 3-5 causas específicas e realistas para os números apresentados

3. PLANO DE AÇÃO: 3 ações práticas e executáveis para a próxima semana, em ordem de prioridade, com prazo sugerido

Seja direto, específico e orientado a resultado. Evite genericidades. Responda em português brasileiro.`;

export default function CloserAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const [mes, setMes] = useState(getCurrentMonth);
  const [closer, setCloser] = useState<Closer | null>(null);
  const [loading, setLoading] = useState(true);

  // Score data
  const [scoreData, setScoreData] = useState<{
    score: number;
    status: "saudavel" | "atencao" | "critico";
    detalhes: ScoreDetalhe[];
  } | null>(null);
  const [rawStats, setRawStats] = useState<{
    marcadas: number; feitas: number; ganhos: number; mrr: number;
    ticketMedio: number; ticketMeta: number; metaContratos: number;
  } | null>(null);

  // Lançamento diário
  const [lancData, setLancData] = useState(() => new Date().toISOString().split("T")[0]);
  const [lancReunAgend, setLancReunAgend] = useState(0);
  const [lancReunFeitas, setLancReunFeitas] = useState(0);
  const [lancContratos, setLancContratos] = useState<ContratoForm[]>([]);
  const [lancSaving, setLancSaving] = useState(false);
  const [lancExistingId, setLancExistingId] = useState<string | null>(null);
  const [lancExistingCtIds, setLancExistingCtIds] = useState<string[]>([]);
  const [sdrs, setSdrs] = useState<{ id: string; nome: string }[]>([]);
  const lancNoShow = Math.max(0, lancReunAgend - lancReunFeitas);

  function getLancMrr(c: ContratoForm) {
    return c.valor_variavel && c.valores_mensais.length > 0
      ? c.valores_mensais.reduce((s, v) => s + v, 0) / c.valores_mensais.length : c.mrr;
  }
  const lancTotalMrr = lancContratos.reduce((s, c) => s + getLancMrr(c), 0);
  const lancTotalEntrada = lancContratos.reduce((s, c) => s + c.valor_entrada, 0);

  // IA
  const [iaLoading, setIaLoading] = useState(false);
  const [iaResult, setIaResult] = useState<string | null>(null);
  const [iaError, setIaError] = useState<string | null>(null);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("closer-analysis-prompt") || PROMPT_PADRAO;
    }
    return PROMPT_PADRAO;
  });
  const [promptSaved, setPromptSaved] = useState(false);

  useEffect(() => { loadData(); setIaResult(null); setIaError(null); }, [id, mes]);
  useEffect(() => { supabase.from("sdrs").select("id,nome").eq("ativo", true).order("nome").then(({ data: s }) => setSdrs((s || []) as { id: string; nome: string }[])); }, []);
  useEffect(() => { if (id && lancData) loadLancExisting(); }, [id, lancData]);

  async function loadLancExisting() {
    const { data: lanc } = await supabase.from("lancamentos_diarios").select("*").eq("closer_id", id).eq("data", lancData).single();
    if (lanc) {
      setLancExistingId(lanc.id);
      setLancReunAgend(lanc.reunioes_marcadas);
      setLancReunFeitas(lanc.reunioes_feitas);
      const mesRef = lancData.slice(0, 7);
      const { data: cts } = await supabase.from("contratos").select("*").eq("closer_id", id).eq("data_fechamento", lancData).eq("mes_referencia", mesRef);
      if (cts && cts.length > 0) {
        setLancExistingCtIds(cts.map((c: { id: string }) => c.id));
        setLancContratos(cts.map((c: { cliente_nome: string; origem_lead: string; sdr_id: string | null; valor_entrada: number; mrr: number; meses_contrato: number; obs: string | null }) => ({
          cliente_nome: c.cliente_nome, origem_lead: c.origem_lead, sdr_id: c.sdr_id || "",
          valor_entrada: Number(c.valor_entrada), mrr: Number(c.mrr), meses_contrato: c.meses_contrato,
          valor_variavel: false, valores_mensais: [], obs: c.obs || "",
        })));
      } else { setLancExistingCtIds([]); setLancContratos([]); }
    } else { setLancExistingId(null); setLancReunAgend(0); setLancReunFeitas(0); setLancContratos([]); setLancExistingCtIds([]); }
  }

  async function salvarLancamento() {
    if (!id) return;
    setLancSaving(true);
    const mesRef = lancData.slice(0, 7);
    // Calculate LTV from contracts
    const lancTotalLtv = lancContratos.reduce((s, c) => {
      if (c.valor_variavel && c.valores_mensais.length > 0) {
        return s + c.valores_mensais.reduce((ss, v) => ss + v, 0);
      }
      return s + c.mrr * c.meses_contrato;
    }, 0);

    const lancPayload = {
      closer_id: id, data: lancData, mes_referencia: mesRef,
      reunioes_marcadas: lancReunAgend, reunioes_feitas: lancReunFeitas,
      no_show: lancNoShow, ganhos: lancContratos.length, mrr_dia: lancTotalMrr, ltv: lancTotalLtv,
    };
    let lancId = lancExistingId;
    if (lancId) {
      const { error } = await supabase.from("lancamentos_diarios").update(lancPayload).eq("id", lancId);
      if (error) { toast.error("Erro: " + error.message); setLancSaving(false); return; }
    } else {
      const { data: d, error } = await supabase.from("lancamentos_diarios").insert(lancPayload).select("id").single();
      if (error) { toast.error("Erro: " + error.message); setLancSaving(false); return; }
      lancId = d.id;
      setLancExistingId(lancId);
    }
    // Contratos
    for (let i = 0; i < lancContratos.length; i++) {
      const c = lancContratos[i];
      const ctPayload = {
        closer_id: id, cliente_nome: c.cliente_nome, origem_lead: c.origem_lead,
        sdr_id: c.sdr_id || null, data_fechamento: lancData, mes_referencia: mesRef,
        valor_entrada: c.valor_entrada, mrr: c.mrr, meses_contrato: c.meses_contrato, obs: c.obs,
      };
      if (lancExistingCtIds[i]) {
        await supabase.from("contratos").update(ctPayload).eq("id", lancExistingCtIds[i]);
      } else {
        await supabase.from("contratos").insert(ctPayload);
      }
    }
    // Delete removed contracts
    for (let i = lancContratos.length; i < lancExistingCtIds.length; i++) {
      await supabase.from("contratos").delete().eq("id", lancExistingCtIds[i]);
    }
    toast.success("Lançamento salvo!");
    setLancSaving(false);
    loadData(); // refresh score
  }

  async function loadData() {
    setLoading(true);

    const [closerRes, lancesRes, metaRes] = await Promise.all([
      supabase.from("closers").select("*").eq("id", id).single(),
      supabase.from("lancamentos_diarios").select("*").eq("closer_id", id).eq("mes_referencia", mes),
      supabase.from("metas_closers").select("*").eq("closer_id", id).eq("mes_referencia", mes).single(),
    ]);

    const c = closerRes.data as Closer | null;
    setCloser(c);
    const lanc = (lancesRes.data || []) as LancamentoDiario[];
    const mc = metaRes.data as MetaCloser | null;

    const marcadas = lanc.reduce((s, l) => s + l.reunioes_marcadas, 0);
    const feitas = lanc.reduce((s, l) => s + l.reunioes_feitas, 0);
    const ganhos = lanc.reduce((s, l) => s + l.ganhos, 0);
    const mrr = lanc.reduce((s, l) => s + Number(l.mrr_dia), 0);
    const ticketMedio = ganhos > 0 ? mrr / ganhos : 0;
    const ticketMeta = c?.meta_ticket_medio ?? 0;
    const metaContratos = mc?.meta_contratos ?? 0;

    const sr = calcularScore({
      reunioes_marcadas: marcadas, reunioes_feitas: feitas,
      contratos: ganhos, meta_contratos: metaContratos,
      ticket_medio: ticketMedio, ticket_meta: ticketMeta,
    });

    setScoreData(sr);
    setRawStats({ marcadas, feitas, ganhos, mrr, ticketMedio, ticketMeta, metaContratos });
    setLoading(false);
  }

  async function gerarAnaliseIA() {
    if (!scoreData || !rawStats || !closer) return;
    setIaLoading(true);
    setIaError(null);

    const diagnosticos = gerarDiagnosticos(scoreData.detalhes, scoreData.score, rawStats.metaContratos);

    const closerDataStr = `
Closer: ${closer.nome}
Periodo: ${mes}
Score: ${scoreData.score}/100 (${scoreData.status})

Dados:
- Reunioes recebidas (agendadas): ${rawStats.marcadas}
- Reunioes realizadas: ${rawStats.feitas}
- Taxa de aproveitamento: ${rawStats.marcadas > 0 ? ((rawStats.feitas / rawStats.marcadas) * 100).toFixed(1) : 0}%
- Contratos fechados: ${rawStats.ganhos}
- Taxa de conversao: ${rawStats.feitas > 0 ? ((rawStats.ganhos / rawStats.feitas) * 100).toFixed(1) : 0}%
- Meta de contratos: ${rawStats.metaContratos || "nao configurada"}
- MRR gerado: R$ ${rawStats.mrr.toFixed(2)}
- Ticket medio: R$ ${rawStats.ticketMedio.toFixed(2)}
- Ticket meta: R$ ${rawStats.ticketMeta.toFixed(2)}

Criterios do score:
${scoreData.detalhes.map((d) => `- ${d.label}: ${d.pontos}/100`).join("\n")}

Diagnosticos identificados:
${diagnosticos.map((d) => `- [${d.tipo.toUpperCase()}] ${d.titulo}: ${d.descricao}`).join("\n")}
`.trim();

    try {
      const res = await fetch("/api/closer-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closerData: closerDataStr, customPrompt }),
      });
      const data = await res.json();
      if (data.error) {
        setIaError(data.error);
      } else {
        setIaResult(data.analysis);
      }
    } catch {
      setIaError("Não foi possível gerar a análise. Tente novamente.");
    }
    setIaLoading(false);
  }

  function salvarPrompt() {
    localStorage.setItem("closer-analysis-prompt", customPrompt);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
  }

  function resetarPrompt() {
    setCustomPrompt(PROMPT_PADRAO);
    localStorage.setItem("closer-analysis-prompt", PROMPT_PADRAO);
  }

  if (loading || !scoreData || !closer || !rawStats) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  const diagnosticos = gerarDiagnosticos(scoreData.detalhes, scoreData.score, rawStats.metaContratos);
  const color = scoreData.status === "saudavel" ? "#22c55e" : scoreData.status === "atencao" ? "#f59e0b" : "#ef4444";
  const cx = 60, cy = 55, r = 45;
  const halfCirc = Math.PI * r;
  const filled = (Math.min(scoreData.score, 100) / 100) * halfCirc;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Navigation */}
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={14} /> Voltar ao dashboard
      </Link>

      {/* A) Header */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex justify-center">
              <svg width="120" height="70" viewBox="0 0 120 70">
                <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#374151" strokeWidth={10} strokeLinecap="round" opacity={0.3} />
                <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${filled} ${halfCirc - filled}`} />
                <text x={cx} y={cy - 5} textAnchor="middle" className="fill-current font-bold" fontSize="20">{scoreData.score}</text>
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{closer.nome}</h1>
                <Badge className={`${scoreData.status === "saudavel" ? "bg-green-500/20 text-green-500" : scoreData.status === "atencao" ? "bg-yellow-500/20 text-yellow-500" : "bg-red-500/20 text-red-500"}`}>
                  {scoreData.status === "saudavel" ? "Saudável" : scoreData.status === "atencao" ? "Atenção" : "Crítico"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">Análise individual de performance</p>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-muted-foreground">Contratos: <strong className="text-foreground">{rawStats.ganhos}</strong></span>
                <span className="text-muted-foreground">MRR: <strong className="text-foreground">{formatCurrency(rawStats.mrr)}</strong></span>
                <span className="text-muted-foreground">Ticket: <strong className="text-foreground">{formatCurrency(rawStats.ticketMedio)}</strong></span>
              </div>
            </div>
            <MonthSelector value={mes} onChange={setMes} />
          </div>
        </CardContent>
      </Card>

      {/* B) Breakdown dos Critérios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Breakdown do Score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scoreData.detalhes.map((d) => {
            const isLow = d.pontos < 65;
            const isHigh = d.pontos >= 80;
            const barColor = isLow ? "bg-red-500" : isHigh ? "bg-green-500" : "bg-yellow-500";
            const textColor = isLow ? "text-red-400" : isHigh ? "text-green-400" : "text-yellow-400";

            // Valor real para cada critério
            let realValue = "";
            if (d.label.toLowerCase().includes("conversao")) {
              realValue = rawStats.feitas > 0 ? formatPercent((rawStats.ganhos / rawStats.feitas) * 100) : "0%";
            } else if (d.label.toLowerCase().includes("meta")) {
              realValue = rawStats.metaContratos > 0 ? `${rawStats.ganhos}/${rawStats.metaContratos}` : "sem meta";
            } else if (d.label.toLowerCase().includes("ticket")) {
              realValue = rawStats.ticketMeta > 0 ? `${formatCurrency(rawStats.ticketMedio)} / ${formatCurrency(rawStats.ticketMeta)}` : "sem meta";
            } else if (d.label.toLowerCase().includes("aproveitamento")) {
              realValue = rawStats.marcadas > 0 ? `${rawStats.feitas}/${rawStats.marcadas} (${formatPercent((rawStats.feitas / rawStats.marcadas) * 100)})` : "0";
            }

            return (
              <div key={d.label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${barColor}`} />
                    <span className="text-sm font-medium">{d.label}</span>
                    <span className="text-xs text-muted-foreground">({d.peso})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{realValue}</span>
                    <span className={`text-sm font-bold font-mono ${textColor}`}>{d.pontos}</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${d.pontos}%` }} />
                </div>
              </div>
            );
          })}

          <div className="pt-2 border-t flex justify-between items-center">
            <span className="text-sm font-medium">Score Final</span>
            <span className="text-lg font-bold font-mono" style={{ color }}>{scoreData.score}/100</span>
          </div>
        </CardContent>
      </Card>

      {/* C) Análise Diagnóstica (regras fixas) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diagnóstico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {diagnosticos.map((d, i) => (
            <div
              key={i}
              className={`rounded-lg p-4 border-l-4 ${
                d.tipo === "critico"
                  ? "bg-red-500/5 border-red-500"
                  : d.tipo === "atencao"
                  ? "bg-yellow-500/5 border-yellow-500"
                  : "bg-blue-500/5 border-blue-500"
              }`}
            >
              <p className="text-sm font-semibold mb-1">{d.titulo}</p>
              <p className="text-sm text-muted-foreground mb-2">{d.descricao}</p>
              <div className="flex items-start gap-1.5">
                <span className="text-xs font-medium text-primary shrink-0 mt-0.5">Sugestão:</span>
                <p className="text-xs text-muted-foreground">{d.sugestao}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* D) Lançamento Diário */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Lançamento Diário</CardTitle>
            <input type="date" value={lancData} onChange={(e) => setLancData(e.target.value)} max={new Date().toISOString().split("T")[0]}
              className="text-xs bg-transparent border rounded px-2 py-1.5 w-[140px]" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Reuniões agendadas</Label>
              <Input type="number" min={0} value={lancReunAgend} onChange={(e) => setLancReunAgend(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reuniões feitas</Label>
              <Input type="number" min={0} value={lancReunFeitas} onChange={(e) => setLancReunFeitas(Number(e.target.value))} />
            </div>
          </div>
          {lancNoShow > 0 && <p className="text-xs text-red-400">No-show: {lancNoShow}</p>}

          <div className="border-t pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Contratos ({lancContratos.length})</p>
              <Button size="sm" variant="outline" onClick={() => setLancContratos([...lancContratos, { ...emptyContrato }])} className="text-xs">
                <Plus size={12} className="mr-1" /> Contrato
              </Button>
            </div>
            {lancContratos.map((c, i) => (
              <div key={i} className="p-3 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Contrato {i + 1}</span>
                  <Button size="sm" variant="ghost" onClick={() => setLancContratos(lancContratos.filter((_, j) => j !== i))} className="text-xs text-red-400 h-6 px-2">
                    <Trash2 size={12} />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Cliente</Label>
                    <Input value={c.cliente_nome} onChange={(e) => { const arr = [...lancContratos]; arr[i] = { ...arr[i], cliente_nome: e.target.value }; setLancContratos(arr); }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Origem</Label>
                    <Select value={c.origem_lead} onValueChange={(v) => { const arr = [...lancContratos]; arr[i] = { ...arr[i], origem_lead: v }; setLancContratos(arr); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{ORIGENS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Entrada</Label>
                    <CurrencyInput value={c.valor_entrada} onChange={(v) => { const arr = [...lancContratos]; arr[i] = { ...arr[i], valor_entrada: v }; setLancContratos(arr); }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">MRR</Label>
                    <CurrencyInput value={c.mrr} onChange={(v) => { const arr = [...lancContratos]; arr[i] = { ...arr[i], mrr: v }; setLancContratos(arr); }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Meses</Label>
                    <Input type="number" min={1} value={c.meses_contrato} onChange={(e) => { const arr = [...lancContratos]; arr[i] = { ...arr[i], meses_contrato: Number(e.target.value) }; setLancContratos(arr); }} />
                  </div>
                </div>
                {sdrs.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">SDR (opcional)</Label>
                    <Select value={c.sdr_id || ""} onValueChange={(v) => { const arr = [...lancContratos]; arr[i] = { ...arr[i], sdr_id: v }; setLancContratos(arr); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{sdrs.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}
          </div>

          {(lancContratos.length > 0) && (
            <div className="p-3 bg-muted/50 rounded-lg flex justify-between text-sm">
              <span className="text-muted-foreground">Totais:</span>
              <span>MRR: <strong>{formatCurrency(lancTotalMrr)}</strong> · Entrada: <strong>{formatCurrency(lancTotalEntrada)}</strong></span>
            </div>
          )}

          <Button onClick={salvarLancamento} disabled={lancSaving} className="w-full">
            <Save size={14} className="mr-2" />
            {lancSaving ? "Salvando..." : lancExistingId ? "Atualizar Lançamento" : "Salvar Lançamento"}
          </Button>
        </CardContent>
      </Card>

      {/* E) Análise por IA */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles size={16} className="text-purple-400" />
              Análise por IA
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPromptEditor(!showPromptEditor)}
              className="text-xs text-muted-foreground"
            >
              {showPromptEditor ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span className="ml-1">Configurar prompt</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Editor de prompt */}
          {showPromptEditor && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/30 border">
              <label className="text-xs font-medium text-muted-foreground">System Prompt</label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={8}
                className="w-full text-xs bg-transparent border rounded-md p-2 resize-y focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={salvarPrompt} className="text-xs">
                  <Save size={12} className="mr-1" />
                  {promptSaved ? "Salvo!" : "Salvar prompt"}
                </Button>
                <Button size="sm" variant="ghost" onClick={resetarPrompt} className="text-xs text-muted-foreground">
                  Resetar padrao
                </Button>
              </div>
            </div>
          )}

          {/* Botão de gerar */}
          {!iaResult && !iaLoading && (
            <Button onClick={gerarAnaliseIA} className="w-full" variant="outline">
              <Sparkles size={14} className="mr-2" />
              Gerar análise detalhada com IA
            </Button>
          )}

          {/* Loading */}
          {iaLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mr-3" />
              <span className="text-sm text-muted-foreground">Analisando performance...</span>
            </div>
          )}

          {/* Erro */}
          {iaError && (
            <div className="rounded-lg p-4 bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{iaError}</p>
              <Button size="sm" variant="outline" onClick={gerarAnaliseIA} className="mt-2 text-xs">
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Resultado */}
          {iaResult && (
            <div className="space-y-4">
              {iaResult.split(/\n(?=\d\.\s|#{1,3}\s)/).map((block, i) => {
                const lines = block.trim();
                if (!lines) return null;
                return (
                  <div key={i} className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {lines}
                  </div>
                );
              })}
              <div className="pt-2 border-t">
                <Button size="sm" variant="ghost" onClick={() => { setIaResult(null); setIaError(null); }} className="text-xs text-muted-foreground">
                  Gerar nova analise
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
