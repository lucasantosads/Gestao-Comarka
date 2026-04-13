"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type {
  Sdr,
  Closer,
  LancamentoSdr,
  MetaSdr,
  ReuniaoSdr,
  LeadCrm,
} from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MonthSelector } from "@/components/month-selector";
import { KpiCard } from "@/components/kpi-card";
import {
  formatPercent,
  formatNumber,
  getCurrentMonth,
  isWeekend,
} from "@/lib/format";
import { toast } from "sonner";
import { Plus, RefreshCw, Pencil, Trash2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ============ TYPES ============
interface LancForm {
  data: string;
  leads_recebidos: number;
  contatos_realizados: number;
  conexoes_feitas: number;
  reunioes_agendadas: number;
  no_show: number;
  follow_ups_feitos: number;
  obs: string;
}

interface ReuniaoForm {
  closer_id: string;
  lead_nome: string;
  data_reuniao: string;
  status: string;
  obs: string;
}

const emptyLanc: LancForm = {
  data: new Date().toISOString().split("T")[0],
  leads_recebidos: 0,
  contatos_realizados: 0,
  conexoes_feitas: 0,
  reunioes_agendadas: 0,
  no_show: 0,
  follow_ups_feitos: 0,
  obs: "",
};

const emptyReuniao: ReuniaoForm = {
  closer_id: "",
  lead_nome: "",
  data_reuniao: new Date().toISOString().split("T")[0],
  status: "agendada",
  obs: "",
};

const STATUS_OPTIONS = [
  { value: "agendada", label: "Agendada" },
  { value: "feita", label: "Feita" },
  { value: "no_show", label: "No Show" },
  { value: "reagendada", label: "Reagendada" },
  { value: "cancelada", label: "Cancelada" },
];



// ============ PROGRESS BAR ============
function ProgressBar({
  label,
  current,
  target,
  format = "number",
  inverse = false,
}: {
  label: string;
  current: number;
  target: number;
  format?: "number" | "percent";
  inverse?: boolean;
}) {
  const pct = target > 0 ? (current / target) * 100 : 0;
  const displayPct = Math.min(pct, 100);
  const color = inverse ? "bg-red-500" : "bg-green-500";

  const fmt = (v: number) => (format === "percent" ? formatPercent(v) : String(Math.round(v)));

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {fmt(current)} / {fmt(target)}{" "}
          <span className="text-xs text-muted-foreground">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${displayPct}%` }} />
      </div>
    </div>
  );
}

// ============ PAGE ============
export default function SdrPage() {
  const [mes, setMes] = useState(getCurrentMonth);
  const [sdrs, setSdrs] = useState<Sdr[]>([]);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [sdrId, setSdrId] = useState("");
  const [lancamentos, setLancamentos] = useState<LancamentoSdr[]>([]);
  const [meta, setMeta] = useState<MetaSdr | null>(null);
  const [reunioes, setReunioes] = useState<ReuniaoSdr[]>([]);
  const [loading, setLoading] = useState(true);

  const [allCrmLeads, setAllCrmLeads] = useState<LeadCrm[]>([]);
  const [leadsTotais, setLeadsTotais] = useState(0);
  const [dashMarcadas, setDashMarcadas] = useState(0);
  const [dashFeitas, setDashFeitas] = useState(0);

  // Modals
  const [lancModal, setLancModal] = useState(false);
  const [lancForm, setLancForm] = useState<LancForm>(emptyLanc);
  const [lancEditId, setLancEditId] = useState<string | null>(null);
  const [lancSaving, setLancSaving] = useState(false);

  const [reuniaoModal, setReuniaoModal] = useState(false);
  const [reuniaoForm, setReuniaoForm] = useState<ReuniaoForm>(emptyReuniao);
  const [reuniaoEditId, setReuniaoEditId] = useState<string | null>(null);
  const [reuniaoSaving, setReuniaoSaving] = useState(false);

  const [metaForm, setMetaForm] = useState({
    meta_contatos: 0,
    meta_reunioes_agendadas: 0,
    meta_reunioes_feitas: 0,
    meta_taxa_no_show: 20,
  });
  const [filtroStatus, setFiltroStatus] = useState("all");

  // Load SDRs initially — parallel
  useEffect(() => {
    Promise.all([
      supabase.from("sdrs").select("*").eq("ativo", true).order("nome"),
      supabase.from("closers").select("*").eq("ativo", true).order("nome"),
    ]).then(([{ data: sdrsData }, { data: closersData }]) => {
      const list = (sdrsData || []) as Sdr[];
      setSdrs(list);
      if (list.length > 0 && !sdrId) setSdrId(list[0].id);
      setClosers((closersData || []) as Closer[]);
    });
  }, []);

  // GHL SDR funnel
  const [ghlFunnel, setGhlFunnel] = useState<{ stages: { name: string; count: number; pct: number }[]; total: number; taxaQualificacao: number; taxaDesqualificacao: number } | null>(null);
  const [ghlAlerts, setGhlAlerts] = useState<{ msg: string }[]>([]);
  useEffect(() => {
    fetch("/api/ghl-funnel")
      .then((r) => r.json())
      .then((data) => {
        if (data.sdr) setGhlFunnel(data.sdr);
        if (data.sdrAlerts) setGhlAlerts(data.sdrAlerts);
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    if (!sdrId) return;
    setLoading(true);

    const hoje = new Date().toISOString().split("T")[0];
    const lastDay = new Date(parseInt(mes.split("-")[0]), parseInt(mes.split("-")[1]), 0);
    const until = `${mes}-${String(lastDay.getDate()).padStart(2, "0")}`;
    const adsUntil = mes === hoje.slice(0, 7) ? hoje : until;

    const [{ data: lancs }, { data: metaData }, { data: reuns }, { data: crmData }, { data: closerLancs }, { data: adsPerf }] =
      await Promise.all([
        supabase.from("lancamentos_sdr").select("*").eq("sdr_id", sdrId).eq("mes_referencia", mes).order("data", { ascending: false }),
        supabase.from("metas_sdr").select("*").eq("sdr_id", sdrId).eq("mes_referencia", mes).single(),
        supabase.from("reunioes_sdr").select("*").eq("sdr_id", sdrId).eq("mes_referencia", mes).order("data_reuniao", { ascending: false }),
        supabase.from("leads_crm").select("*").eq("mes_referencia", mes).limit(1000),
        supabase.from("lancamentos_diarios").select("reunioes_marcadas,reunioes_feitas").eq("mes_referencia", mes),
        supabase.from("ads_performance").select("leads").gte("data_ref", mes + "-01").lte("data_ref", adsUntil),
      ]);

    setLancamentos((lancs || []) as LancamentoSdr[]);
    setReunioes((reuns || []) as ReuniaoSdr[]);
    setAllCrmLeads((crmData || []) as LeadCrm[]);
    // Use Meta leads when available
    const metaLeadsTotal = (adsPerf || []).reduce((s: number, r: { leads: number }) => s + Number(r.leads), 0);
    setLeadsTotais(metaLeadsTotal > 0 ? metaLeadsTotal : (crmData || []).length);
    const clLancs = (closerLancs || []) as { reunioes_marcadas: number; reunioes_feitas: number }[];
    setDashMarcadas(clLancs.reduce((s, l) => s + l.reunioes_marcadas, 0));
    setDashFeitas(clLancs.reduce((s, l) => s + l.reunioes_feitas, 0));

    if (metaData) {
      setMeta(metaData as MetaSdr);
      setMetaForm({
        meta_contatos: metaData.meta_contatos,
        meta_reunioes_agendadas: metaData.meta_reunioes_agendadas,
        meta_reunioes_feitas: Number((metaData as Record<string, unknown>).meta_reunioes_feitas ?? 0),
        meta_taxa_no_show: Number(metaData.meta_taxa_no_show),
      });
    } else {
      setMeta(null);
      setMetaForm({ meta_contatos: 0, meta_reunioes_agendadas: 0, meta_reunioes_feitas: 0, meta_taxa_no_show: 20 });
    }

    setLoading(false);
  }, [sdrId, mes]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ============ AGGREGATES ============
  const totals = lancamentos.reduce(
    (acc, l) => ({
      leads: acc.leads + l.leads_recebidos,
      contatos: acc.contatos + l.contatos_realizados,
      conexoes: acc.conexoes + l.conexoes_feitas,
      reunioes: acc.reunioes + l.reunioes_agendadas,
      noShow: acc.noShow + l.no_show,
      followUps: acc.followUps + l.follow_ups_feitos,
    }),
    { leads: 0, contatos: 0, conexoes: 0, reunioes: 0, noShow: 0, followUps: 0 }
  );

  // Taxas usando dados da dashboard (fontes únicas de verdade)
  const reunioesAgendadas = dashMarcadas;
  const reunioesFeitas = dashFeitas;
  const noShow = reunioesAgendadas - reunioesFeitas;
  const taxaAgendamento = leadsTotais > 0 ? (reunioesAgendadas / leadsTotais) * 100 : 0;
  const taxaNoShow = reunioesAgendadas > 0 ? (noShow / reunioesAgendadas) * 100 : 0;
  const percentLeadsReuniao = leadsTotais > 0 ? (reunioesFeitas / leadsTotais) * 100 : 0;

  // ============ LANCAMENTO HANDLERS ============
  function openNewLanc() {
    setLancForm(emptyLanc);
    setLancEditId(null);
    setLancModal(true);
  }

  function openEditLanc(l: LancamentoSdr) {
    setLancForm({
      data: l.data,
      leads_recebidos: l.leads_recebidos,
      contatos_realizados: l.contatos_realizados,
      conexoes_feitas: l.conexoes_feitas,
      reunioes_agendadas: l.reunioes_agendadas,
      no_show: l.no_show,
      follow_ups_feitos: l.follow_ups_feitos,
      obs: l.obs || "",
    });
    setLancEditId(l.id);
    setLancModal(true);
  }

  async function saveLanc() {
    if (lancForm.conexoes_feitas > lancForm.contatos_realizados) {
      toast.error("Conexoes nao pode ser maior que contatos");
      return;
    }
    if (lancForm.reunioes_agendadas > lancForm.conexoes_feitas) {
      toast.error("Reuniões não pode ser maior que conexões");
      return;
    }
    if (lancForm.no_show > lancForm.reunioes_agendadas) {
      toast.error("No show nao pode ser maior que reunioes");
      return;
    }

    setLancSaving(true);
    const payload = {
      sdr_id: sdrId,
      mes_referencia: mes,
      ...lancForm,
      obs: lancForm.obs || null,
    };

    if (lancEditId) {
      const { error } = await supabase.from("lancamentos_sdr").update(payload).eq("id", lancEditId);
      if (error) toast.error("Erro: " + error.message);
      else toast.success("Atualizado!");
    } else {
      const { error } = await supabase.from("lancamentos_sdr").insert(payload);
      if (error) {
        if (error.message.includes("duplicate")) toast.error("Ja existe lancamento para esta data");
        else toast.error("Erro: " + error.message);
      } else toast.success("Lançamento salvo!");
    }

    setLancSaving(false);
    setLancModal(false);
    loadData();
  }

  // ============ REUNIAO HANDLERS ============
  function openNewReuniao() {
    setReuniaoForm(emptyReuniao);
    setReuniaoEditId(null);
    setReuniaoModal(true);
  }

  async function saveReuniao() {
    if (!reuniaoForm.lead_nome.trim()) {
      toast.error("Preencha o nome do lead");
      return;
    }
    if (!reuniaoForm.closer_id) {
      toast.error("Selecione o closer");
      return;
    }

    setReuniaoSaving(true);
    const payload = {
      sdr_id: sdrId,
      mes_referencia: mes,
      closer_id: reuniaoForm.closer_id,
      lead_nome: reuniaoForm.lead_nome.trim(),
      data_reuniao: reuniaoForm.data_reuniao,
      status: reuniaoForm.status,
      obs: reuniaoForm.obs || null,
    };

    if (reuniaoEditId) {
      const { error } = await supabase.from("reunioes_sdr").update(payload).eq("id", reuniaoEditId);
      if (error) toast.error("Erro: " + error.message);
      else toast.success("Atualizada!");
    } else {
      const { error } = await supabase.from("reunioes_sdr").insert(payload);
      if (error) toast.error("Erro: " + error.message);
      else toast.success("Reunião registrada!");
    }

    setReuniaoSaving(false);
    setReuniaoModal(false);
    loadData();
  }

  async function deleteReuniao(id: string) {
    if (!confirm("Excluir reunião?")) return;
    await supabase.from("reunioes_sdr").delete().eq("id", id);
    toast.success("Excluída!");
    loadData();
  }

  // ============ CHART DATA ============
  // Funil SDR alimentado pelo CRM (etapas relevantes para o SDR)
  const crmOportunidade = allCrmLeads.filter((l) => l.etapa === "oportunidade").length;
  const crmPropostaEnviada = allCrmLeads.filter((l) => l.etapa === "proposta_enviada").length;
  const crmFollowUp = allCrmLeads.filter((l) => l.etapa === "follow_up").length;
  const crmReuniaoAgendada = allCrmLeads.filter((l) => l.etapa === "reuniao_agendada").length;
  const funnelData = [
    { etapa: "Oportunidade", valor: crmOportunidade },
    { etapa: "Proposta Enviada", valor: crmPropostaEnviada },
    { etapa: "Follow Up", valor: crmFollowUp },
    { etapa: "Reunião Agendada", valor: crmReuniaoAgendada },
  ];

  const compData = [
    { nome: "Leads", realizado: leadsTotais, meta: metaForm.meta_contatos },
    { nome: "Reu. Agend.", realizado: reunioesAgendadas, meta: metaForm.meta_reunioes_agendadas },
    { nome: "Reu. Feitas", realizado: reunioesFeitas, meta: metaForm.meta_reunioes_feitas },
  ];

  const closerName = (id: string) => closers.find((c) => c.id === id)?.nome || "-";
  const filteredReunioes = filtroStatus === "all" ? reunioes : reunioes.filter((r) => r.status === filtroStatus);

  if (loading && sdrs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {sdrs.length === 1 ? `Acompanhamento — ${sdrs[0].nome}` : sdrs.find((s) => s.id === sdrId)?.nome ? `Acompanhamento — ${sdrs.find((s) => s.id === sdrId)?.nome}` : "Acompanhamento SDR"}
          </h1>
          <p className="text-sm text-muted-foreground">Mes atual</p>
        </div>
        <div className="flex items-center gap-3">
          {sdrs.length > 1 && (
            <Select value={sdrId} onValueChange={setSdrId}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="SDR" />
              </SelectTrigger>
              <SelectContent>
                {sdrs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <MonthSelector value={mes} onChange={setMes} />
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw size={14} />
          </Button>
          <Button onClick={openNewLanc}>
            <Plus size={16} className="mr-1" />
            Lancar dia
          </Button>
        </div>
      </div>

      {/* Alerta lançamento — só em dia útil */}
      {(() => {
        const now = new Date();
        const isDiaUtil = now.getDay() >= 1 && now.getDay() <= 5;
        if (!isDiaUtil) return null;

        const hoje = now.toISOString().split("T")[0];
        const temLancHoje = lancamentos.some((l) => l.data === hoje);
        if (!temLancHoje) return (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-400">
            Nenhum lancamento registrado hoje. Lembre o SDR de registrar o dia antes das 18h.
          </div>
        );
        return null;
      })()}

      {/* KPIs do SDR — mesma fonte da dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Leads" value={formatNumber(leadsTotais)} />
        <KpiCard title="Reuniões Agendadas" value={formatNumber(reunioesAgendadas)} />
        <KpiCard title="Reuniões Feitas" value={formatNumber(reunioesFeitas)} />
        <KpiCard title="No-Show" value={`${formatNumber(noShow)} (${formatPercent(taxaNoShow)})`} />
        <KpiCard title="% Leads → Reunião" value={formatPercent(percentLeadsReuniao)} />
        <KpiCard title="Taxa Agendamento" value={formatPercent(taxaAgendamento)} />
      </div>

      {/* Leads do CRM — etapas do SDR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads no Pipeline — {mes} ({crmOportunidade + crmPropostaEnviada + crmFollowUp + crmReuniaoAgendada} ativos)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {funnelData.map((step) => (
              <div key={step.etapa} className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{step.valor}</p>
                <p className="text-xs text-muted-foreground">{step.etapa}</p>
              </div>
            ))}
          </div>

          {/* Lista de leads ativos */}
          {(() => {
            const leadsAtivos = allCrmLeads.filter((l) => ["oportunidade", "proposta_enviada", "follow_up", "reuniao_agendada"].includes(l.etapa));
            if (leadsAtivos.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead ativo no pipeline</p>;
            return (
              <div className="border rounded-lg overflow-auto max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Closer</TableHead>
                      <TableHead>Telefone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadsAtivos.map((l) => {
                      const etapaColors: Record<string, string> = { oportunidade: "border-slate-500 text-slate-400", reuniao_agendada: "border-blue-500 text-blue-500", proposta_enviada: "border-purple-500 text-purple-500", follow_up: "border-yellow-500 text-yellow-500" };
                      const etapaLabels: Record<string, string> = { oportunidade: "Oportunidade", reuniao_agendada: "Reunião Agendada", proposta_enviada: "Proposta Enviada", follow_up: "Follow Up" };
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium text-sm">{l.nome || "—"}</TableCell>
                          <TableCell><Badge variant="outline" className={`text-xs ${etapaColors[l.etapa] || ""}`}>{etapaLabels[l.etapa] || l.etapa}</Badge></TableCell>
                          <TableCell className="text-xs">{closers.find((c) => c.id === l.closer_id)?.nome || "—"}</TableCell>
                          <TableCell className="text-xs">{l.telefone || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Historico Diario */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico Diário</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Reuniões</TableHead>
                  <TableHead className="text-right">No Show</TableHead>
                  <TableHead className="text-right">Follow-ups</TableHead>
                  <TableHead>OBS</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lancamentos.map((l) => {
                  const d = new Date(l.data + "T12:00:00");
                  const wknd = isWeekend(d);
                  return (
                    <TableRow key={l.id} className={wknd ? "opacity-50" : ""}>
                      <TableCell>
                        {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        {wknd && <Badge variant="outline" className="ml-1 text-xs">FDS</Badge>}
                      </TableCell>
                      <TableCell className="text-right">{l.leads_recebidos}</TableCell>
                      <TableCell className="text-right">{l.reunioes_agendadas}</TableCell>
                      <TableCell className="text-right">{l.no_show}</TableCell>
                      <TableCell className="text-right">{l.follow_ups_feitos}</TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">{l.obs || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditLanc(l)}>
                          <Pencil size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Total Row */}
                {lancamentos.length > 0 && (
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{leadsTotais > 0 ? leadsTotais : totals.leads}</TableCell>
                    <TableCell className="text-right">{totals.reunioes}</TableCell>
                    <TableCell className="text-right">{totals.noShow}</TableCell>
                    <TableCell className="text-right">{totals.followUps}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                )}
                {lancamentos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      Nenhum lancamento neste mes
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Atingimento */}
      {meta && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atingimento de Metas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgressBar label="Leads" current={leadsTotais} target={metaForm.meta_contatos} />
            <ProgressBar label="Reuniões Agendadas" current={reunioesAgendadas} target={metaForm.meta_reunioes_agendadas} />
            <ProgressBar label="Reuniões Feitas" current={reunioesFeitas} target={metaForm.meta_reunioes_feitas} />
            <ProgressBar label="No Show" current={taxaNoShow} target={Number(metaForm.meta_taxa_no_show)} format="percent" inverse />
            <ProgressBar label="No Show" current={taxaNoShow} target={Number(metaForm.meta_taxa_no_show)} format="percent" inverse />
          </CardContent>
        </Card>
      )}

      {/* Comparativo Realizado vs Meta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Realizado vs Meta</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={compData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="realizado" fill="#6366f1" name="Realizado" />
              <Bar dataKey="meta" fill="#94a3b8" name="Meta" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Removido: Leads do CRM duplicado */}

      {/* Reunioes Agendadas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Reunioes Agendadas</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={openNewReuniao}>
              <Plus size={14} className="mr-1" />
              Registrar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>OBS</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReunioes.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {new Date(r.data_reuniao + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </TableCell>
                    <TableCell className="font-medium">{r.lead_nome}</TableCell>
                    <TableCell>{closerName(r.closer_id)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          r.status === "feita" ? "border-green-500 text-green-500" :
                          r.status === "no_show" ? "border-red-500 text-red-500" :
                          r.status === "cancelada" ? "border-muted-foreground" :
                          "border-blue-500 text-blue-500"
                        }
                      >
                        {STATUS_OPTIONS.find((s) => s.value === r.status)?.label || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">{r.obs || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => deleteReuniao(r.id)} className="text-destructive">
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredReunioes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma reuniao registrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ===== MODAIS ===== */}

      {/* Lancamento Modal */}
      <Dialog open={lancModal} onOpenChange={setLancModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{lancEditId ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={lancForm.data} max={new Date().toISOString().split("T")[0]} onChange={(e) => setLancForm({ ...lancForm, data: e.target.value })} />
            </div>
            {[
              { label: "Leads recebidos", key: "leads_recebidos" as const },
              { label: "Contatos realizados", key: "contatos_realizados" as const },
              { label: "Conexoes feitas", key: "conexoes_feitas" as const },
              { label: "Reuniões agendadas", key: "reunioes_agendadas" as const },
              { label: "No Show", key: "no_show" as const },
              { label: "Follow-ups feitos", key: "follow_ups_feitos" as const },
            ].map((f) => (
              <div key={f.key} className="space-y-1">
                <Label>{f.label}</Label>
                <Input type="number" min={0} value={lancForm[f.key]} onChange={(e) => setLancForm({ ...lancForm, [f.key]: Number(e.target.value) })} />
              </div>
            ))}

            {/* Real-time calcs */}
            <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxa conexao</span>
                <span className="font-medium">{lancForm.contatos_realizados > 0 ? formatPercent((lancForm.conexoes_feitas / lancForm.contatos_realizados) * 100) : "0%"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxa agendamento</span>
                <span className="font-medium">{lancForm.conexoes_feitas > 0 ? formatPercent((lancForm.reunioes_agendadas / lancForm.conexoes_feitas) * 100) : "0%"}</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label>OBS</Label>
              <Textarea value={lancForm.obs} onChange={(e) => setLancForm({ ...lancForm, obs: e.target.value })} placeholder="Observações..." />
            </div>
            <div className="flex gap-3">
              <Button onClick={saveLanc} disabled={lancSaving} className="flex-1">
                {lancSaving ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="outline" onClick={() => setLancModal(false)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reuniao Modal */}
      <Dialog open={reuniaoModal} onOpenChange={setReuniaoModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Reuniao</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome do Lead</Label>
              <Input value={reuniaoForm.lead_nome} onChange={(e) => setReuniaoForm({ ...reuniaoForm, lead_nome: e.target.value })} placeholder="Nome do lead" />
            </div>
            <div className="space-y-1">
              <Label>Closer</Label>
              <Select value={reuniaoForm.closer_id} onValueChange={(v) => setReuniaoForm({ ...reuniaoForm, closer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {closers.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data da Reuniao</Label>
              <Input type="date" value={reuniaoForm.data_reuniao} onChange={(e) => setReuniaoForm({ ...reuniaoForm, data_reuniao: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={reuniaoForm.status} onValueChange={(v) => setReuniaoForm({ ...reuniaoForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>OBS</Label>
              <Textarea value={reuniaoForm.obs} onChange={(e) => setReuniaoForm({ ...reuniaoForm, obs: e.target.value })} placeholder="Observações..." />
            </div>
            <div className="flex gap-3">
              <Button onClick={saveReuniao} disabled={reuniaoSaving} className="flex-1">
                {reuniaoSaving ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="outline" onClick={() => setReuniaoModal(false)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Funil GHL Real */}
      {ghlFunnel && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Funil SDR — GHL (tempo real)</CardTitle>
              <Badge variant="outline" className="text-[9px]">{ghlFunnel.total} leads</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {ghlFunnel.stages.map((s) => (
              <div key={s.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="font-medium">{s.count} <span className="text-muted-foreground">({s.pct.toFixed(1)}%)</span></span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.name.toLowerCase().includes("desqualificado") ? "bg-red-500" : s.name.toLowerCase().includes("qualificado") || s.name.toLowerCase().includes("agendou") ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${Math.min(s.pct, 100)}%` }} />
                </div>
              </div>
            ))}
            {ghlAlerts.length > 0 && (
              <div className="border-t pt-3 mt-3 space-y-2">
                {ghlAlerts.map((a, i) => (
                  <div key={i} className="text-xs p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                    ⚠️ {a.msg}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
