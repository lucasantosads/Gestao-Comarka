"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { Sdr, LancamentoSdr, MetaSdr, LeadCrm } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthSelector } from "@/components/month-selector";
import { formatPercent, formatNumber, getCurrentMonth, isWeekend, formatMonthLabel } from "@/lib/format";
import { toast } from "sonner";
import { Copy, Printer, Trophy, TrendingDown, AlertTriangle } from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ============ HELPERS ============
const safe = (n: number, d: number) => (d > 0 ? n / d : 0);

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getDaysInMonth(mesRef: string) {
  const [y, m] = mesRef.split("-").map(Number);
  const days: string[] = [];
  const d = new Date(y, m - 1, 1);
  while (d.getMonth() === m - 1) {
    days.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function EtapaBadge({ etapa }: { etapa: string }) {
  const colors: Record<string, string> = {
    reuniao_agendada: "bg-blue-500/20 text-blue-400",
    proposta_enviada: "bg-purple-500/20 text-purple-400",
    follow_up: "bg-yellow-500/20 text-yellow-400",
    assinatura_contrato: "bg-orange-500/20 text-orange-400",
    comprou: "bg-green-500/20 text-green-400",
    desistiu: "bg-red-500/20 text-red-400",
    no_show: "bg-red-500/20 text-red-400",
    oportunidade: "bg-gray-500/20 text-gray-400",
    lead_qualificado: "bg-cyan-500/20 text-cyan-400",
    negociacao: "bg-amber-500/20 text-amber-400",
  };
  const labels: Record<string, string> = {
    reuniao_agendada: "Reunião", proposta_enviada: "Proposta", follow_up: "Follow Up",
    assinatura_contrato: "Contrato", comprou: "Comprou", desistiu: "Desistiu",
    no_show: "No Show", oportunidade: "Oportunidade", lead_qualificado: "Qualificado",
    negociacao: "Negociação",
  };
  return <Badge className={`text-[10px] ${colors[etapa] || "bg-muted text-muted-foreground"}`}>{labels[etapa] || etapa}</Badge>;
}

// ============ PAGE ============
export default function RelatorioSdrPage() {
  const [mes, setMes] = useState(getCurrentMonth);
  const [sdrs, setSdrs] = useState<Sdr[]>([]);
  const [sdrId, setSdrId] = useState("");
  const [lancamentos, setLancamentos] = useState<LancamentoSdr[]>([]);
  const [meta, setMeta] = useState<MetaSdr | null>(null);
  const [crmLeads, setCrmLeads] = useState<LeadCrm[]>([]);
  const [loading, setLoading] = useState(true);
  const [diaExpandido, setDiaExpandido] = useState<string | null>(null);
  const [apenasAtivos, setApenasAtivos] = useState(false);

  useEffect(() => {
    supabase.from("sdrs").select("*").eq("ativo", true).order("nome").then(({ data }) => {
      const list = (data || []) as Sdr[];
      setSdrs(list);
      if (list.length > 0 && !sdrId) setSdrId(list[0].id);
    });
  }, []);

  const loadData = useCallback(async () => {
    if (!sdrId) return;
    setLoading(true);
    const [{ data: l }, { data: m }, { data: crm }] = await Promise.all([
      supabase.from("lancamentos_sdr").select("*").eq("sdr_id", sdrId).eq("mes_referencia", mes).order("data"),
      supabase.from("metas_sdr").select("*").eq("sdr_id", sdrId).eq("mes_referencia", mes).single(),
      supabase.from("leads_crm").select("*").eq("mes_referencia", mes).order("ghl_created_at", { nullsFirst: false }),
    ]);
    setLancamentos((l || []) as LancamentoSdr[]);
    setMeta((m as MetaSdr) || null);
    setCrmLeads((crm || []) as LeadCrm[]);
    setDiaExpandido(null);
    setLoading(false);
  }, [sdrId, mes]);

  useEffect(() => { loadData(); }, [loadData]);

  // ============ COMPUTED DATA ============
  const allDays = useMemo(() => getDaysInMonth(mes), [mes]);
  const lancMap = useMemo(() => {
    const m = new Map<string, LancamentoSdr>();
    lancamentos.forEach((l) => m.set(l.data, l));
    return m;
  }, [lancamentos]);

  const totals = useMemo(() => lancamentos.reduce((a, l) => ({
    leads: a.leads + l.leads_recebidos,
    contatos: a.contatos + l.contatos_realizados,
    conexoes: a.conexoes + l.conexoes_feitas,
    reunioes: a.reunioes + l.reunioes_agendadas,
    noShow: a.noShow + l.no_show,
    followUps: a.followUps + l.follow_ups_feitos,
  }), { leads: 0, contatos: 0, conexoes: 0, reunioes: 0, noShow: 0, followUps: 0 }), [lancamentos]);

  const diasComLanc = lancamentos.length;
  const taxaConexao = safe(totals.conexoes, totals.contatos) * 100;
  const taxaAgend = safe(totals.reunioes, totals.conexoes) * 100;
  const taxaNoShow = safe(totals.noShow, totals.reunioes) * 100;
  const leadsComprou = crmLeads.filter((l) => l.etapa === "comprou");

  // Daily data for chart
  const dadosDiarios = useMemo(() => {
    return allDays
      .filter((d) => !isWeekend(new Date(d + "T12:00:00")))
      .map((d) => {
        const l = lancMap.get(d);
        return {
          dia: d,
          leads_recebidos: l?.leads_recebidos || 0,
          contatos_realizados: l?.contatos_realizados || 0,
          reunioes_agendadas: l?.reunioes_agendadas || 0,
          taxa_agendamento: l && l.conexoes_feitas > 0 ? (l.reunioes_agendadas / l.conexoes_feitas) * 100 : 0,
        };
      })
      .filter((d) => !apenasAtivos || d.contatos_realizados > 0 || d.reunioes_agendadas > 0);
  }, [allDays, lancMap, apenasAtivos]);

  // Best/worst days
  const melhorDia = useMemo(() =>
    dadosDiarios.filter((d) => d.reunioes_agendadas > 0).sort((a, b) => b.reunioes_agendadas - a.reunioes_agendadas)[0],
    [dadosDiarios]);
  const piorDia = useMemo(() =>
    dadosDiarios.filter((d) => d.contatos_realizados > 0).sort((a, b) => a.taxa_agendamento - b.taxa_agendamento)[0],
    [dadosDiarios]);
  const diaMaisNoShow = useMemo(() => {
    const dias = allDays.map((d) => ({ dia: d, noShow: lancMap.get(d)?.no_show || 0 })).filter((d) => d.noShow > 0);
    return dias.sort((a, b) => b.noShow - a.noShow)[0];
  }, [allDays, lancMap]);

  // Funnel data
  const funilEtapas = [
    { label: "Leads recebidos", valor: totals.leads, cor: "#6366f1" },
    { label: "Contatos", valor: totals.contatos, cor: "#8b5cf6" },
    { label: "Conexões", valor: totals.conexoes, cor: "#a78bfa" },
    { label: "Reuniões agendadas", valor: totals.reunioes, cor: "#f59e0b" },
    { label: "Contratos", valor: leadsComprou.length, cor: "#22c55e" },
  ];

  // Dias sem lançamento
  const diasSemLanc = allDays.filter((d) => {
    const dt = new Date(d + "T12:00:00");
    return !isWeekend(dt) && !lancMap.has(d) && new Date(d) <= new Date();
  });

  // SDR name
  const sdrNome = sdrs.find((s) => s.id === sdrId)?.nome || "SDR";

  // ============ ACTIONS ============
  const fmtDia = (d: string) => {
    const dt = new Date(d + "T12:00:00");
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
  };
  const fmtDiaSemana = (d: string) => DIAS_SEMANA[new Date(d + "T12:00:00").getDay()];

  const copiarResumo = () => {
    const txt = `📊 *Relatório SDR — ${sdrNome}*\n📅 Período: ${formatMonthLabel(mes)}\n\n📥 Leads recebidos: *${totals.leads}*\n📞 Contatos realizados: *${totals.contatos}*\n🤝 Conexões feitas: *${totals.conexoes}* (${taxaConexao.toFixed(0)}%)\n📅 Reuniões agendadas: *${totals.reunioes}* (${taxaAgend.toFixed(0)}%)\n❌ No-Show: *${totals.noShow}* (${taxaNoShow.toFixed(0)}%)\n\n🎯 Fechamentos: *${leadsComprou.length}*\n${melhorDia ? `🏆 Melhor dia: ${fmtDia(melhorDia.dia)} (${fmtDiaSemana(melhorDia.dia)}) — ${melhorDia.reunioes_agendadas} reuniões` : ""}${meta ? `\n📊 Meta de reuniões: *${Math.round(safe(totals.reunioes, meta.meta_reunioes_agendadas) * 100)}%* atingida` : ""}`;
    navigator.clipboard.writeText(txt);
    toast.success("Resumo copiado!");
  };

  const leadsDodia = (data: string) => crmLeads.filter((l) => {
    const d = l.preenchido_em?.split("T")[0] || l.created_at?.split("T")[0];
    return d === data;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6 relatorio-container">
      {/* Print header */}
      <div className="print-only relatorio-header hidden print:flex justify-between border-b-2 border-foreground pb-3 mb-5">
        <div>
          <strong className="text-lg">RELATÓRIO SDR</strong>
          <div className="text-xs">{formatMonthLabel(mes)}</div>
        </div>
        <div className="text-right text-xs">
          <div>SDR: {sdrNome}</div>
          <div>Gerado em: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <h1 className="text-2xl font-bold">Relatório SDR</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {sdrs.length > 1 && (
            <Select value={sdrId} onValueChange={setSdrId}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>{sdrs.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <MonthSelector value={mes} onChange={setMes} />
          <Button variant="outline" size="sm" onClick={copiarResumo}><Copy size={14} className="mr-1" />Copiar</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer size={14} className="mr-1" />PDF</Button>
        </div>
      </div>

      {/* Seção 1 — KPIs resumidos */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Leads Recebidos" value={formatNumber(totals.leads)} />
        <KpiCard title="Contatos" value={formatNumber(totals.contatos)} />
        <KpiCard title="Conexões" value={`${formatNumber(totals.conexoes)} (${formatPercent(taxaConexao)})`} />
        <KpiCard title="Reuniões Agend." value={`${formatNumber(totals.reunioes)} (${formatPercent(taxaAgend)})`} />
        <KpiCard title="No-Show" value={`${formatNumber(totals.noShow)} (${formatPercent(taxaNoShow)})`} />
        <KpiCard title="Contratos" value={String(leadsComprou.length)} />
      </div>

      {/* Seção 2 — Destaques do período */}
      {(melhorDia || piorDia || diaMaisNoShow) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {melhorDia && (
            <Card className="border-green-500/30">
              <CardContent className="pt-4 pb-3 flex items-start gap-3">
                <Trophy size={18} className="text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Melhor dia</p>
                  <p className="text-sm font-semibold">{fmtDia(melhorDia.dia)} ({fmtDiaSemana(melhorDia.dia)})</p>
                  <p className="text-xs text-green-400">{melhorDia.reunioes_agendadas} reuniões agendadas</p>
                </div>
              </CardContent>
            </Card>
          )}
          {piorDia && (
            <Card className="border-yellow-500/30">
              <CardContent className="pt-4 pb-3 flex items-start gap-3">
                <TrendingDown size={18} className="text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Menor conversão</p>
                  <p className="text-sm font-semibold">{fmtDia(piorDia.dia)} ({fmtDiaSemana(piorDia.dia)})</p>
                  <p className="text-xs text-yellow-400">{formatPercent(piorDia.taxa_agendamento)} de taxa</p>
                </div>
              </CardContent>
            </Card>
          )}
          {diaMaisNoShow && (
            <Card className="border-red-500/30">
              <CardContent className="pt-4 pb-3 flex items-start gap-3">
                <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Mais no-show</p>
                  <p className="text-sm font-semibold">{fmtDia(diaMaisNoShow.dia)} ({fmtDiaSemana(diaMaisNoShow.dia)})</p>
                  <p className="text-xs text-red-400">{diaMaisNoShow.noShow} no-shows</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Dias sem lançamento */}
      {diasSemLanc.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/5 rounded-lg p-3 no-print">
          <AlertTriangle size={14} />
          <span><strong>{diasSemLanc.length} dia{diasSemLanc.length > 1 ? "s" : ""} útil{diasSemLanc.length > 1 ? "eis" : ""}</strong> sem lançamento no período: {diasSemLanc.slice(0, 5).map(fmtDia).join(", ")}{diasSemLanc.length > 5 ? ` (+${diasSemLanc.length - 5})` : ""}</span>
        </div>
      )}

      {/* Seção 3 — Tabela diária */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Histórico Diário</CardTitle>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer no-print">
            <input type="checkbox" checked={apenasAtivos} onChange={(e) => setApenasAtivos(e.target.checked)} className="rounded" />
            Apenas dias com atividade
          </label>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Dia</th>
                  <th className="text-right px-3 py-2 font-medium">Leads</th>
                  <th className="text-right px-3 py-2 font-medium">Contatos</th>
                  <th className="text-right px-3 py-2 font-medium">Conexões</th>
                  <th className="text-right px-3 py-2 font-medium">Reuniões</th>
                  <th className="text-right px-3 py-2 font-medium">No-Show</th>
                  <th className="text-right px-3 py-2 font-medium">Follow-Up</th>
                  <th className="text-right px-3 py-2 font-medium">Conv%</th>
                </tr>
              </thead>
              <tbody>
                {allDays.map((dia) => {
                  const dt = new Date(dia + "T12:00:00");
                  const fds = isWeekend(dt);
                  const l = lancMap.get(dia);
                  const futuro = new Date(dia) > new Date();

                  if (fds && apenasAtivos) return null;
                  if (apenasAtivos && !l) return null;

                  const conv = l && l.conexoes_feitas > 0 ? (l.reunioes_agendadas / l.conexoes_feitas) * 100 : 0;
                  const noShowAlto = l && l.reunioes_agendadas > 0 && (l.no_show / l.reunioes_agendadas) > 0.2;
                  const convColor = conv >= 60 ? "text-green-400" : conv >= 40 ? "text-yellow-400" : conv > 0 ? "text-red-400" : "text-muted-foreground";
                  const semLanc = !fds && !l && !futuro;
                  const expanded = diaExpandido === dia;
                  const leads = leadsDodia(dia);

                  return (
                    <tbody key={dia}>
                      <tr
                        className={`border-b transition-colors ${fds ? "bg-muted/30" : semLanc ? "bg-red-500/5" : "hover:bg-muted/30 cursor-pointer"}`}
                        onClick={() => !fds && setDiaExpandido(expanded ? null : dia)}
                      >
                        <td className="px-4 py-2 font-medium whitespace-nowrap">
                          <span>{fmtDia(dia)}</span>
                          <span className="text-muted-foreground ml-1 text-xs">({fmtDiaSemana(dia)})</span>
                          {fds && <Badge variant="outline" className="ml-2 text-[10px]">FDS</Badge>}
                          {semLanc && <span className="ml-2 text-[10px] text-red-400">⚠ Sem lançamento</span>}
                        </td>
                        <td className="text-right px-3 py-2">{fds ? "—" : l?.leads_recebidos ?? (futuro ? "" : "0")}</td>
                        <td className="text-right px-3 py-2">{fds ? "—" : l?.contatos_realizados ?? (futuro ? "" : "0")}</td>
                        <td className="text-right px-3 py-2">{fds ? "—" : l?.conexoes_feitas ?? (futuro ? "" : "0")}</td>
                        <td className="text-right px-3 py-2">{fds ? "—" : l?.reunioes_agendadas ?? (futuro ? "" : "0")}</td>
                        <td className={`text-right px-3 py-2 ${noShowAlto ? "text-red-400 font-medium" : ""}`}>{fds ? "—" : l?.no_show ?? (futuro ? "" : "0")}</td>
                        <td className="text-right px-3 py-2">{fds ? "—" : l?.follow_ups_feitos ?? (futuro ? "" : "0")}</td>
                        <td className={`text-right px-3 py-2 font-medium ${convColor}`}>{fds || !l ? "—" : formatPercent(conv)}</td>
                      </tr>
                      {expanded && leads.length > 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 pb-3 pt-1 bg-muted/20">
                            <p className="text-[11px] text-muted-foreground mb-2">Leads do dia {fmtDia(dia)}:</p>
                            <div className="flex flex-col gap-1.5">
                              {leads.map((lead) => (
                                <div key={lead.id} className="flex items-center gap-3 text-xs">
                                  <span className="font-medium min-w-[140px] truncate">{lead.nome || "Sem nome"}</span>
                                  <EtapaBadge etapa={lead.etapa} />
                                  {lead.canal_aquisicao && <span className="text-muted-foreground">{lead.canal_aquisicao}</span>}
                                  {lead.origem_utm && <span className="text-muted-foreground">{lead.origem_utm}</span>}
                                  {Number(lead.mensalidade) > 0 && <span className="text-green-400">R$ {Number(lead.mensalidade).toLocaleString("pt-BR")}</span>}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      {expanded && leads.length === 0 && (
                        <tr><td colSpan={8} className="px-4 pb-3 pt-1 bg-muted/20 text-xs text-muted-foreground">Nenhum lead registrado neste dia</td></tr>
                      )}
                    </tbody>
                  );
                })}
                {/* TOTAL */}
                <tr className="bg-muted/50 font-bold border-t-2">
                  <td className="px-4 py-2">TOTAL</td>
                  <td className="text-right px-3 py-2">{totals.leads}</td>
                  <td className="text-right px-3 py-2">{totals.contatos}</td>
                  <td className="text-right px-3 py-2">{totals.conexoes}</td>
                  <td className="text-right px-3 py-2">{totals.reunioes}</td>
                  <td className="text-right px-3 py-2">{totals.noShow}</td>
                  <td className="text-right px-3 py-2">{totals.followUps}</td>
                  <td className="text-right px-3 py-2">{formatPercent(taxaAgend)}</td>
                </tr>
                {/* MÉDIA/DIA */}
                <tr className="text-muted-foreground italic text-xs">
                  <td className="px-4 py-2">MÉDIA/DIA</td>
                  <td className="text-right px-3 py-2">{diasComLanc > 0 ? (totals.leads / diasComLanc).toFixed(1) : "—"}</td>
                  <td className="text-right px-3 py-2">{diasComLanc > 0 ? (totals.contatos / diasComLanc).toFixed(1) : "—"}</td>
                  <td className="text-right px-3 py-2">{diasComLanc > 0 ? (totals.conexoes / diasComLanc).toFixed(1) : "—"}</td>
                  <td className="text-right px-3 py-2">{diasComLanc > 0 ? (totals.reunioes / diasComLanc).toFixed(1) : "—"}</td>
                  <td className="text-right px-3 py-2">{diasComLanc > 0 ? (totals.noShow / diasComLanc).toFixed(1) : "—"}</td>
                  <td className="text-right px-3 py-2">{diasComLanc > 0 ? (totals.followUps / diasComLanc).toFixed(1) : "—"}</td>
                  <td className="text-right px-3 py-2">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Seção 4 — Gráfico de barras: volume diário */}
      <Card className="chart-container">
        <CardHeader><CardTitle className="text-base">Volume Diário</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={dadosDiarios}>
              <XAxis dataKey="dia" tickFormatter={(d) => fmtDia(d)} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => v + "%"} tick={{ fontSize: 10 }} />
              <Tooltip
                labelFormatter={(d) => `${fmtDia(d as string)} (${fmtDiaSemana(d as string)})`}
                formatter={(value, name) => {
                  if (name === "Taxa Conv.") return [Number(value).toFixed(1) + "%", name];
                  return [value, name];
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="leads_recebidos" name="Leads" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="left" dataKey="contatos_realizados" name="Contatos" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="left" dataKey="reunioes_agendadas" name="Reuniões" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="taxa_agendamento" name="Taxa Conv." stroke="#a78bfa" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Seção 5 — Funil do período */}
      <Card>
        <CardHeader><CardTitle className="text-base">Funil do Período</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {funilEtapas.map((etapa, i) => {
              const maxVal = funilEtapas[0].valor || 1;
              const w = Math.max(8, (etapa.valor / maxVal) * 100);
              const prev = i > 0 ? funilEtapas[i - 1].valor : 0;
              const pct = prev > 0 ? (etapa.valor / prev) * 100 : 0;
              return (
                <div key={etapa.label} className="flex items-center gap-3">
                  <span className="text-xs w-32 text-right text-muted-foreground truncate">{etapa.label}</span>
                  <div className="flex-1">
                    <div
                      className="h-8 rounded flex items-center px-3 text-white text-xs font-medium transition-all"
                      style={{ width: `${w}%`, backgroundColor: etapa.cor }}
                    >
                      {etapa.valor}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground w-12">{i > 0 ? `${pct.toFixed(0)}%` : ""}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Seção 7 — Comparativo com metas */}
      {meta && (
        <Card>
          <CardHeader><CardTitle className="text-base">Metas vs Realizado</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { ind: "Contatos", real: totals.contatos, meta: meta.meta_contatos },
                { ind: "Conexões", real: totals.conexoes, meta: meta.meta_conexoes },
                { ind: "Reuniões Agendadas", real: totals.reunioes, meta: meta.meta_reunioes_agendadas },
                { ind: "Taxa Conexão", real: taxaConexao, meta: Number(meta.meta_taxa_conexao), pct: true },
                { ind: "Taxa Agendamento", real: taxaAgend, meta: Number(meta.meta_taxa_agendamento), pct: true },
                { ind: "Taxa No-Show", real: taxaNoShow, meta: Number(meta.meta_taxa_no_show), pct: true, inv: true },
              ].map((m) => {
                const ating = m.meta > 0 ? (m.real / m.meta) * 100 : 0;
                const ok = m.inv ? m.real <= m.meta : m.real >= m.meta;
                return (
                  <div key={m.ind} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{m.ind}</span>
                      <span className={`font-medium ${ok ? "text-green-400" : "text-red-400"}`}>
                        {m.pct ? formatPercent(m.real) : m.real} / {m.pct ? formatPercent(m.meta) : m.meta}
                        <span className="text-xs text-muted-foreground ml-1">({ating.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${Math.min(ating, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
