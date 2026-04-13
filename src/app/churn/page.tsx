"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatPercent } from "@/lib/format";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { TrendingDown, DollarSign, Users, AlertTriangle, ExternalLink, ChevronDown, ChevronRight, Plus, Info, Trash2, Download, ShieldAlert, History, CheckCircle } from "lucide-react";
import Link from "next/link";

interface ChurnRecord {
  id: string; nome: string; status: string; motivo: string;
  valor: number; data: string; totalClientes: number; source: "notion" | "supabase";
}
// ChurnRate calculado localmente a partir dos registros

const STATUS_COLORS: Record<string, string> = {
  "Aviso de saída recebido": "bg-red-500/15 text-red-400",
  "cancelado": "bg-red-500/15 text-red-400",
  "Jurídico": "bg-muted text-muted-foreground",
  "No prazo do aviso": "bg-yellow-500/15 text-yellow-400",
  "pausado": "bg-yellow-500/15 text-yellow-400",
  "Procedimentos finais": "bg-blue-500/15 text-blue-400",
  "Finalizado": "bg-green-500/15 text-green-400",
  "ativo": "bg-green-500/15 text-green-400",
};
const MOTIVOS = ["Falta de resultados", "Financeiro da empresa", "Problema de atendimento", "Não precisa mais do serviço", "Desistência da empresa", "Problemas pessoais", "Concorrente", "Fechou o negócio", "Não Sabemos", "Outro"];
const MOTIVO_COLORS: Record<string, string> = {
  "Financeiro da empresa": "bg-blue-500", "Problema de atendimento": "bg-pink-500",
  "Não precisa mais do serviço": "bg-orange-500", "Desistência da empresa": "bg-green-500",
  "Falta de resultados": "bg-red-500", "Problemas pessoais": "bg-yellow-500",
  "Concorrente": "bg-purple-500", "Fechou o negócio": "bg-cyan-500",
  "Não Sabemos": "bg-muted-foreground", "Outro": "bg-muted-foreground",
};

type Periodo = "este_mes" | "3m" | "6m" | "12m" | "custom" | "all";

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <Info size={12} className="text-muted-foreground cursor-help" />
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-56 p-2 bg-card border rounded-lg shadow-lg text-[10px] text-muted-foreground z-50">
          {text}
        </span>
      )}
    </span>
  );
}

interface ClienteReceita {
  id: string; nome: string; valor_mensal: number; status: string; status_financeiro: string;
}

export default function ChurnPage() {
  const [allChurns, setAllChurns] = useState<ChurnRecord[]>([]);
  const [notionRates, setNotionRates] = useState<{ mes: string; saidas: number; totalClientes: number; churnRate: number }[]>([]);
  const [supabaseResumo, setSupabaseResumo] = useState<{ totalAtivos: number; mrrAtivos: number } | null>(null);
  const [clientesAtivos, setClientesAtivos] = useState<ClienteReceita[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("6m");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ clienteId: "", nome: "", valor: 0, motivo: MOTIVOS[0], data: new Date().toISOString().split("T")[0], observacao: "" });
  const [saving, setSaving] = useState(false);
  // Consistência e histórico (T6)
  const [consistencia, setConsistencia] = useState<{ status: string; criado_em: string; divergencia: number; resolvido?: boolean } | null>(null);
  const [histModal, setHistModal] = useState<{ nome: string; clienteId: string } | null>(null);
  const [histData, setHistData] = useState<{ id: string; status_anterior: string | null; status_novo: string; motivo: string | null; criado_em: string }[]>([]);

  const loadData = async () => {
    setLoading(true);
    // Atualizar total_clientes do mês atual com base em clientes_receita
    await fetch("/api/churn-summary", { method: "PATCH" }).catch(() => null);
    const { supabase: sb } = await import("@/lib/supabase");
    const [notionRes, sbRes, { data: clReceita }, summaryRes] = await Promise.all([
      fetch("/api/notion-churn").then((r) => r.json()).catch(() => ({ churns: [] })),
      fetch("/api/churn").then((r) => r.json()).catch(() => ({ clientes: [], resumo: null })),
      // Consistência com /api/financeiro/entradas: usa (status_financeiro || status)
      // para classificar como churned. Se status_financeiro="churned" (independente
      // do status base), o cliente NÃO é ativo.
      sb.from("clientes_receita").select("id, nome, valor_mensal, status, status_financeiro, mes_fechamento").order("nome"),
      fetch("/api/churn-summary").then((r) => r.json()).catch(() => []),
    ]);
    // Mesmo critério do /api/financeiro/entradas (todosAtivos):
    // status_financeiro (ou status como fallback) diferente de "churned".
    const ativosFiltrados = ((clReceita || []) as ClienteReceita[]).filter((c) => {
      const sf = c.status_financeiro || (c.status === "churned" ? "churned" : "ativo");
      return sf !== "churned";
    });
    setClientesAtivos(ativosFiltrados);

    // Sobrescrever notion rates com churn_monthly_summary (fonte mais confiável + histórica)
    if (Array.isArray(summaryRes) && summaryRes.length > 0) {
      const fromSummary = summaryRes.map((s: { ano_mes: string; num_saidas: number; total_clientes: number; churn_rate: number }) => ({
        mes: s.ano_mes,
        saidas: s.num_saidas,
        totalClientes: s.total_clientes,
        churnRate: Number(s.churn_rate),
      }));
      // Será setado depois — guardar em variável intermediária
      (notionRes as { rates: typeof fromSummary }).rates = fromSummary;
    }

    // Merge Notion + Supabase, deduplicado por nome
    const seen = new Set<string>();
    const merged: ChurnRecord[] = [];

    // Notion primeiro
    for (const c of (notionRes.churns || [])) {
      const key = c.nome?.toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push({ ...c, source: "notion" as const });
      }
    }

    // Supabase (só adiciona se não veio do Notion)
    for (const c of (sbRes.clientes || [])) {
      if (c.status !== "cancelado") continue;
      const key = c.nome?.toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push({
          id: c.id, nome: c.nome, status: c.etapa_churn || c.status,
          motivo: c.motivo_cancelamento || "Não Sabemos",
          valor: Number(c.mrr), data: c.data_cancelamento || "",
          totalClientes: 0, source: "supabase" as const,
        });
      }
    }

    setAllChurns(merged.sort((a, b) => b.data.localeCompare(a.data)));
    setNotionRates((notionRes.rates || []).map((r: { mes: string; saidas: number; totalClientes: number; churnRate: number }) => ({
      ...r, mes: r.mes.replace("-", "/"),
    })));
    setSupabaseResumo(sbRes.resumo || null);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Carregar dados de consistência
  useEffect(() => {
    fetch("/api/clientes/consistencia-log").then((r) => r.json()).then((d) => {
      const ultimo = (d.registros || [])[0];
      if (ultimo) setConsistencia(ultimo);
    }).catch(() => {});
  }, []);

  // Calcular saídas por mês — merge Notion rates + registros individuais
  const churnPorMes = useMemo(() => {
    const mesMap = new Map<string, { saidas: number; mrrPerdido: number; totalClientes: number; churnRate: number; clientes: ChurnRecord[] }>();

    // 1. Popular com dados mensais do Notion (rates) — dados históricos consolidados
    for (const r of notionRates) {
      mesMap.set(r.mes, {
        saidas: r.saidas,
        mrrPerdido: 0,
        totalClientes: r.totalClientes,
        churnRate: r.churnRate,
        clientes: [],
      });
    }

    // 2. Garantir que o mês atual existe no mapa (mesmo sem registros)
    const hojeStr = new Date();
    const mesAtualKey = `${hojeStr.getFullYear()}/${String(hojeStr.getMonth() + 1).padStart(2, "0")}`;
    if (!mesMap.has(mesAtualKey) && supabaseResumo?.totalAtivos) {
      mesMap.set(mesAtualKey, {
        saidas: 0, mrrPerdido: 0,
        totalClientes: supabaseResumo.totalAtivos,
        churnRate: 0, clientes: [],
      });
    }

    // 3. Enriquecer com registros individuais (clientes com nome, valor, motivo)
    for (const c of allChurns) {
      if (!c.data) continue;
      const mes = c.data.slice(0, 7).replace("-", "/");
      const ex = mesMap.get(mes) || { saidas: 0, mrrPerdido: 0, totalClientes: 0, churnRate: 0, clientes: [] };
      ex.mrrPerdido += c.valor;
      ex.clientes.push(c);
      // Sempre usar o maior entre saídas do Notion e contagem de registros individuais
      ex.saidas = Math.max(ex.saidas, ex.clientes.length);
      if (!notionRates.find((r) => r.mes === mes)) {
        const totalClientes = supabaseResumo?.totalAtivos || 0;
        // Usar total de ativos como base — fonte única (Entradas)
        ex.churnRate = totalClientes > 0 ? (ex.saidas / totalClientes) * 100 : 0;
        ex.totalClientes = totalClientes;
      }
      mesMap.set(mes, ex);
    }

    return Array.from(mesMap.entries())
      .map(([mes, data]) => ({ mes, ...data }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }, [allChurns, notionRates, supabaseResumo]);

  const mesAtual = new Date().toISOString().slice(0, 7).replace("-", "/");

  const filteredMeses = useMemo(() => {
    if (periodo === "all") return churnPorMes;
    if (periodo === "este_mes") return churnPorMes.filter((m) => m.mes === mesAtual);
    if (periodo === "custom" && customStart && customEnd) {
      const s = customStart.replace("-", "/"); const e = customEnd.replace("-", "/");
      return churnPorMes.filter((m) => m.mes >= s && m.mes <= e);
    }
    const n = periodo === "3m" ? 3 : periodo === "6m" ? 6 : 12;
    return churnPorMes.slice(-n);
  }, [churnPorMes, periodo, mesAtual, customStart, customEnd]);

  // KPIs
  const totalSaidas = filteredMeses.reduce((s, m) => s + m.saidas, 0);
  const totalMrrPerdido = filteredMeses.reduce((s, m) => s + m.mrrPerdido, 0);
  const avgChurnRate = filteredMeses.filter((m) => m.churnRate > 0).length > 0
    ? filteredMeses.filter((m) => m.churnRate > 0).reduce((s, m) => s + m.churnRate, 0) / filteredMeses.filter((m) => m.churnRate > 0).length : 0;
  const churnsAtivos = allChurns.filter((c) => c.status !== "Finalizado" && c.status !== "cancelado");
  const mrrEmRisco = churnsAtivos.reduce((s, c) => s + c.valor, 0);

  // Top motivos
  const motivoCount = useMemo(() => {
    const periodChurns = filteredMeses.flatMap((m) => m.clientes);
    const map = new Map<string, { count: number; valor: number }>();
    periodChurns.forEach((c) => {
      const m = c.motivo || "Nao informado";
      const ex = map.get(m) || { count: 0, valor: 0 };
      ex.count++; ex.valor += c.valor; map.set(m, ex);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [filteredMeses]);

  // Salvar cancelamento via churnar-cliente (reflete em Entradas + Pipeline)
  const salvarCancelamento = async () => {
    if (!form.clienteId) { toast.error("Selecione um cliente"); return; }
    setSaving(true);
    const res = await fetch("/api/financeiro/churnar-cliente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente_receita_id: form.clienteId,
        motivo: form.motivo,
        observacao: form.observacao || undefined,
      }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); }
    else {
      toast.success(`${form.nome} registrado como churn`);
      setForm({ clienteId: "", nome: "", valor: 0, motivo: MOTIVOS[0], data: new Date().toISOString().split("T")[0], observacao: "" });
      setShowForm(false);
      loadData();
    }
    setSaving(false);
  };

  const deletarChurn = async (c: ChurnRecord) => {
    if (!confirm(`Remover "${c.nome}" do churn?`)) return;
    if (c.source === "supabase") {
      // Reativar em clientes_receita
      await fetch("/api/financeiro/custos-fixos"); // just to warm up
      const supabaseClient = (await import("@/lib/supabase")).supabase;
      await supabaseClient.from("clientes_receita").update({ status: "ativo", status_financeiro: "ativo" }).eq("nome", c.nome);
      await supabaseClient.from("clientes").delete().eq("id", c.id);
    }
    toast.success(`${c.nome} removido`);
    loadData();
  };

  const exportarCSV = () => {
    const headers = ["Cliente", "Data", "Status", "Motivo", "MRR Perdido"];
    const rows = allChurns.map((c) => [
      c.nome, c.data, c.status, c.motivo || "", c.valor || 0,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `churn-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  // Gráfico churn rate + MRR churn
  const chartData = churnPorMes.slice(-12).map((m) => ({
    mes: m.mes,
    "Churn Rate (%)": Math.round(m.churnRate * 10) / 10,
    "MRR Perdido": m.mrrPerdido,
    "Saidas": m.saidas,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Churn e Retenção</h1>
          {consistencia?.status === "divergencia_detectada" && !consistencia?.resolvido && (
            <Link href="/dashboard/clientes">
              <Badge className="bg-red-500/15 text-red-400 text-[10px] cursor-pointer hover:bg-red-500/25">
                <ShieldAlert size={10} className="mr-1" />
                Divergência com Entrada ({consistencia.divergencia})
              </Badge>
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-0.5">
            {(["este_mes", "3m", "6m", "12m", "custom", "all"] as Periodo[]).map((p) => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${periodo === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                {p === "all" ? "Tudo" : p === "este_mes" ? "Este mes" : p === "custom" ? "Periodo" : p.toUpperCase()}
              </button>
            ))}
          </div>
          {periodo === "custom" && (
            <div className="flex items-center gap-1">
              <input type="month" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="text-[10px] bg-transparent border rounded px-1.5 py-1" />
              <span className="text-[10px] text-muted-foreground">a</span>
              <input type="month" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="text-[10px] bg-transparent border rounded px-1.5 py-1" />
            </div>
          )}
          <Button size="sm" variant="outline" onClick={exportarCSV}><Download size={14} className="mr-1" />CSV</Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus size={14} className="mr-1" />Registrar</Button>
          <a href="https://www.notion.so/fffb5b1a3b98811c8597f4bbe1234070" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground">
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Formulário de cancelamento */}
      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-medium">Registrar Cancelamento</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Cliente (da base de Entradas)</Label>
                <select value={form.clienteId} onChange={(e) => {
                  const cl = clientesAtivos.find((c) => c.id === e.target.value);
                  setForm({ ...form, clienteId: e.target.value, nome: cl?.nome || "", valor: Number(cl?.valor_mensal || 0) });
                }} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">
                  <option value="">Selecione um cliente...</option>
                  {clientesAtivos.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome} — {formatCurrency(Number(c.valor_mensal))}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Motivo</Label>
                <select value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">
                  {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Obs</Label>
                <Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Opcional" />
              </div>
            </div>
            {form.clienteId && (
              <p className="text-xs text-muted-foreground">MRR que será perdido: <strong className="text-red-400">{formatCurrency(form.valor)}</strong></p>
            )}
            <div className="flex gap-2">
              <Button onClick={salvarCancelamento} disabled={saving || !form.clienteId}>{saving ? "Salvando..." : "Registrar Churn"}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingDown size={16} className="text-red-400" />
              <InfoTooltip text="Churn Rate = (cancelados no periodo / clientes ativos no inicio) x 100. Benchmark saudavel: abaixo de 5%." />
            </div>
            <p className="text-xs text-muted-foreground">Churn Rate</p>
            <p className={`text-xl font-bold ${avgChurnRate > 7 ? "text-red-400" : avgChurnRate > 4 ? "text-yellow-400" : "text-green-400"}`}>{formatPercent(avgChurnRate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign size={16} className="text-red-400" />
              <InfoTooltip text="MRR Churn = soma do MRR dos clientes cancelados no periodo. Diferente do churn de clientes, mede o impacto financeiro." />
            </div>
            <p className="text-xs text-muted-foreground">MRR Perdido</p>
            <p className="text-xl font-bold text-red-400">{formatCurrency(totalMrrPerdido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Users size={16} className="mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Clientes Ativos</p>
            <p className="text-xl font-bold">{supabaseResumo?.totalAtivos ?? "—"}</p>
            <p className="text-[9px] text-muted-foreground">MRR: {formatCurrency(supabaseResumo?.mrrAtivos ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => window.location.href = '/churn/pipeline'}>
          <CardContent className="pt-4 pb-3 text-center">
            <AlertTriangle size={16} className="mx-auto mb-1 text-yellow-400" />
            <p className="text-xs text-muted-foreground">Em Risco</p>
            <p className="text-xl font-bold text-yellow-400">{formatCurrency(mrrEmRisco)}</p>
            <p className="text-[9px] text-muted-foreground">{churnsAtivos.length} em andamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      {chartData.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Churn Rate (%)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis unit="%" />
                  <Tooltip />
                  <Line type="monotone" dataKey="Churn Rate (%)" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Saidas e MRR Perdido</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="l" />
                  <YAxis yAxisId="r" orientation="right" />
                  <Tooltip formatter={(v, name) => name === "MRR Perdido" ? formatCurrency(Number(v)) : v} />
                  <Legend />
                  <Bar yAxisId="l" dataKey="Saidas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="r" dataKey="MRR Perdido" fill="#f59e0b" radius={[3, 3, 0, 0]} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Motivos */}
      {motivoCount.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Motivos de Cancelamento</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              {motivoCount.map(([motivo, data]) => {
                const pct = totalSaidas > 0 ? (data.count / totalSaidas) * 100 : 0;
                return (
                  <div key={motivo} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${MOTIVO_COLORS[motivo] || "bg-muted-foreground"}`} />
                        {motivo}
                      </span>
                      <span className="font-mono">{data.count} · {formatCurrency(data.valor)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${MOTIVO_COLORS[motivo] || "bg-muted-foreground"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detalhamento por mês — colapsável */}
      <Card>
        <CardHeader><CardTitle className="text-base">Por Mes ({filteredMeses.reduce((s, m) => s + m.saidas, 0)} saidas)</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {filteredMeses.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum cancelamento no periodo selecionado</p>}
          {filteredMeses.slice().reverse().map((m) => {
            const isOpen = expandedMonth === m.mes;
            return (
              <div key={m.mes}>
                <button onClick={() => setExpandedMonth(isOpen ? null : m.mes)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                    <span className="text-sm font-medium">{m.mes}</span>
                    <Badge variant="outline" className="text-[9px]">{m.saidas} saída{m.saidas !== 1 ? "s" : ""}</Badge>
                    {m.totalClientes > 0 && (
                      <span className="text-[9px] text-muted-foreground">de {m.totalClientes} clientes</span>
                    )}
                    {m.churnRate > 0 && (
                      <Badge className={`text-[9px] ${m.churnRate > 7 ? "bg-red-500/15 text-red-400" : m.churnRate > 4 ? "bg-yellow-500/15 text-yellow-400" : "bg-green-500/15 text-green-400"}`}>
                        {formatPercent(m.churnRate)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {m.mrrPerdido > 0 && <span className="text-sm font-mono text-red-400">{formatCurrency(m.mrrPerdido)}</span>}
                    {m.clientes.length === 0 && m.saidas > 0 && <span className="text-[9px] text-muted-foreground italic">Notion</span>}
                  </div>
                </button>
                {isOpen && m.clientes.length > 0 && (
                  <div className="ml-8 mb-3 space-y-1.5">
                    {m.clientes.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-2.5 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <span>☹️</span>
                          <span className="text-sm">{c.nome}</span>
                          <Badge className={`text-[8px] ${STATUS_COLORS[c.status] || "bg-muted"}`}>{c.status}</Badge>
                          {c.source === "supabase" && <Badge variant="outline" className="text-[7px]">DB</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground">{c.motivo}</span>
                          <span className="font-mono text-red-400">{formatCurrency(c.valor)}</span>
                          <button onClick={async (e) => {
                            e.stopPropagation();
                            // Buscar cliente no pipeline por nome para obter o id
                            const { supabase: sb2 } = await import("@/lib/supabase");
                            const { data: cl } = await sb2.from("clientes").select("id").ilike("nome", c.nome).limit(1).maybeSingle();
                            if (cl?.id) {
                              const histRes = await fetch(`/api/clientes/status-historico?cliente_id=${cl.id}`).then((r) => r.json());
                              setHistData(histRes.historico || []);
                              setHistModal({ nome: c.nome, clienteId: cl.id });
                            } else {
                              setHistData([]);
                              setHistModal({ nome: c.nome, clienteId: "" });
                            }
                          }} className="text-muted-foreground hover:text-primary transition-colors" title="Histórico de status">
                            <History size={12} />
                          </button>
                          {c.source === "supabase" && (
                            <button onClick={(e) => { e.stopPropagation(); deletarChurn(c); }} className="text-muted-foreground hover:text-red-400 transition-colors" title="Remover churn">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 6c. Indicador de consistência no rodapé */}
      <div className="flex items-center justify-center gap-2 py-2 text-[10px] text-muted-foreground">
        {consistencia ? (
          <>
            {consistencia.status === "ok" ? (
              <CheckCircle size={12} className="text-green-400" />
            ) : (
              <ShieldAlert size={12} className="text-red-400" />
            )}
            <span className={consistencia.status === "ok" ? "text-green-400" : "text-red-400"}>
              {consistencia.status === "ok" ? "Sincronizado com Entrada" : "Divergência pendente"}
            </span>
            <span>em {new Date(consistencia.criado_em).toLocaleString("pt-BR")}</span>
          </>
        ) : (
          <span>Consistência não verificada</span>
        )}
      </div>

      {/* 6b. Modal histórico de status */}
      {histModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setHistModal(null)}>
          <div className="bg-background border rounded-lg max-w-md w-full max-h-[60vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <History size={14} />
                Histórico — {histModal.nome}
              </h2>
              <button onClick={() => setHistModal(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {histData.length > 0 ? histData.map((h) => (
                <div key={h.id} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${h.status_novo === "cancelado" ? "bg-red-400" : "bg-primary"}`} />
                  <div className="flex-1 border-l pl-3 pb-2 border-border/30">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground line-through">{h.status_anterior || "—"}</span>
                      <span className="text-xs">→</span>
                      <span className={`text-xs font-medium ${h.status_novo === "cancelado" ? "text-red-400" : ""}`}>{h.status_novo}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{new Date(h.criado_em).toLocaleString("pt-BR")}</p>
                    {h.motivo && <p className="text-[10px] italic text-muted-foreground">{h.motivo}</p>}
                  </div>
                </div>
              )) : (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum histórico registrado</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
