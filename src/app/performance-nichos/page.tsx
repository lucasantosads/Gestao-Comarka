"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, getCurrentMonth } from "@/lib/format";
import { toast } from "sonner";
import { RefreshCw, AlertTriangle, Tag, Check } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from "recharts";

type Tab = "global" | "nicho" | "tese" | "comparar";

interface NichoPerf {
  id: string; nome: string;
  investimento: number; metaLeads: number; leads: number; comprou: number;
  cpl: number; conversao: number;
  contratos_manual: number; faturamento_manual: number;
}
interface TesePerf extends NichoPerf { nicho_id: string; nicho_nome: string }
interface GlobalPerf {
  investimento: number; leads: number; metaLeads: number; cpl: number;
  reunioes: { feitas: number; agendadas: number; noShow: number };
  conversao: number; roas: number | null; ltv: number; contratos: number;
}
interface LeadNaoAtribuido { id: string; nome: string; etapa: string }

const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-4 rounded-xl border border-border/60 bg-card shadow-sm flex flex-col gap-1">
      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-black tracking-tight">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function PerformanceNichosPage() {
  const [tab, setTab] = useState<Tab>("global");
  const [mes, setMes] = useState(getCurrentMonth());
  const [loading, setLoading] = useState(true);
  const [global, setGlobal] = useState<GlobalPerf | null>(null);
  const [porNicho, setPorNicho] = useState<NichoPerf[]>([]);
  const [porTese, setPorTese] = useState<TesePerf[]>([]);
  const [naoAtribuidos, setNaoAtribuidos] = useState(0);
  const [leadsNA, setLeadsNA] = useState<LeadNaoAtribuido[]>([]);
  const [showNA, setShowNA] = useState(false);

  // Filtros
  const [selectedNicho, setSelectedNicho] = useState("");
  const [selectedTese, setSelectedTese] = useState("");
  const [compareTeses, setCompareTeses] = useState<string[]>([]);

  // Nichos/Teses catalogo para atribuição
  const [nichoCatalog, setNichoCatalog] = useState<{ id: string; nome: string }[]>([]);
  const [teseCatalog, setTeseCatalog] = useState<{ id: string; nome: string; nicho_id: string }[]>([]);

  // Manual edit
  const [editManual, setEditManual] = useState<{ id: string; contratos: number; faturamento: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [perfRes, catRes] = await Promise.all([
      fetch(`/api/performance-nichos?mes=${mes}`).then((r) => r.json()),
      fetch("/api/nichos-teses").then((r) => r.json()),
    ]);
    if (!perfRes.error) {
      setGlobal(perfRes.global);
      setPorNicho(perfRes.porNicho || []);
      setPorTese(perfRes.porTese || []);
      setNaoAtribuidos(perfRes.naoAtribuidos || 0);
      setLeadsNA(perfRes.leadsNaoAtribuidos || []);
    }
    setNichoCatalog(catRes.nichos || []);
    setTeseCatalog(catRes.teses || []);
    setLoading(false);
  }, [mes]);

  useEffect(() => { load(); }, [load]);

  const salvarManual = async (nichoId: string | null, teseId: string | null, contratos: number, faturamento: number) => {
    const res = await fetch("/api/performance-nichos", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nicho_id: nichoId, tese_id: teseId, mes_referencia: mes, contratos_fechados: contratos, faturamento_total: faturamento }),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    toast.success("Dados salvos");
    setEditManual(null);
    load();
  };

  const atribuirLead = async (leadId: string, nichoId: string, teseId: string) => {
    const res = await fetch("/api/leads/atribuir-nicho", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId, nicho_id: nichoId, tese_id: teseId }),
    });
    if (!(await res.json()).error) {
      setLeadsNA((prev) => prev.filter((l) => l.id !== leadId));
      setNaoAtribuidos((prev) => prev - 1);
      toast.success("Lead atribuído");
    }
  };

  const toggleCompare = (id: string) => {
    setCompareTeses((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= 5) { toast.error("Máximo 5 teses"); return prev; }
      return [...prev, id];
    });
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
      <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin" />
      <p className="text-muted-foreground animate-pulse text-sm">Carregando performance...</p>
    </div>
  );

  const nichoFiltrado = porNicho.find((n) => n.id === selectedNicho);
  const tesesDoNicho = porTese.filter((t) => !selectedNicho || t.nicho_id === selectedNicho);
  const teseFiltrada = porTese.find((t) => t.id === selectedTese);
  const compareData = porTese.filter((t) => compareTeses.includes(t.id));

  const tabs: { key: Tab; label: string }[] = [
    { key: "global", label: "Global" },
    { key: "nicho", label: "Por Nicho" },
    { key: "tese", label: "Por Tese" },
    { key: "comparar", label: "Comparar Teses" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-violet-500 rounded-full" />
          <h1 className="text-2xl font-bold tracking-tight">Performance por Nicho & Tese</h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={mes} onChange={(e) => setMes(e.target.value)} className="text-sm border rounded-lg px-3 py-2 bg-card font-medium shadow-sm outline-none focus:ring-1 focus:ring-primary">
            {["2026-04", "2026-03", "2026-02", "2026-01", "2025-12", "2025-11"].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={load} className="gap-1"><RefreshCw size={14} /> Atualizar</Button>
        </div>
      </div>

      {/* Alerta não atribuídos */}
      {naoAtribuidos > 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 shadow-sm">
          <span className="text-sm font-medium text-orange-600 dark:text-orange-400 flex items-center gap-2">
            <AlertTriangle size={16} /> {naoAtribuidos} leads sem nicho atribuído neste período
          </span>
          <Button size="sm" variant="outline" onClick={() => setShowNA(!showNA)} className="text-xs border-orange-500/30 text-orange-500">
            {showNA ? "Fechar" : "Atribuir manualmente"}
          </Button>
        </div>
      )}

      {/* Modal não atribuídos */}
      {showNA && leadsNA.length > 0 && (
        <Card className="border-orange-500/20">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Leads não atribuídos</p>
            {leadsNA.map((l) => <LeadAtribuirRow key={l.id} lead={l} nichos={nichoCatalog} teses={teseCatalog} onSave={atribuirLead} />)}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-all ${tab === t.key ? "bg-card border border-b-0 border-border text-foreground shadow-sm -mb-[1px]" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: Global */}
      {tab === "global" && global && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard label="Investimento" value={formatCurrency(global.investimento)} />
            <KpiCard label="Leads" value={String(global.leads)} sub={`${global.metaLeads} via Meta`} />
            <KpiCard label="CPL Médio" value={formatCurrency(global.cpl)} />
            <KpiCard label="Reuniões Feitas" value={String(global.reunioes.feitas)} sub={`${global.reunioes.agendadas} agendadas`} />
            <KpiCard label="Taxa Conversão" value={`${global.conversao.toFixed(1)}%`} sub={`${global.contratos} contratos`} />
            <KpiCard label="ROAS" value={global.roas != null ? global.roas.toFixed(2) : "—"} sub={global.roas != null ? `LTV ${formatCurrency(global.ltv)}` : "Sem LTV"} />
          </div>

          {/* Gráfico barras por nicho */}
          {porNicho.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Performance por Nicho</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={porNicho}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "#888" }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#888" }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#888" }} />
                    <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="investimento" fill="#8b5cf6" name="Investimento (R$)" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="leads" fill="#3b82f6" name="Leads" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tabela ranking teses */}
          {porTese.filter((t) => t.leads > 0 || t.investimento > 0).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Ranking de Teses por Conversão</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2">Tese</th><th className="text-left py-2 px-2">Nicho</th>
                    <th className="text-right py-2 px-2">Invest.</th><th className="text-right py-2 px-2">Leads</th>
                    <th className="text-right py-2 px-2">CPL</th><th className="text-right py-2 px-2">Conv.</th>
                  </tr></thead>
                  <tbody>
                    {[...porTese].filter((t) => t.leads > 0 || t.investimento > 0).sort((a, b) => b.conversao - a.conversao).map((t) => (
                      <tr key={t.id} className="border-b border-border/30 hover:bg-muted/10">
                        <td className="py-2 px-2 font-medium">{t.nome}</td>
                        <td className="py-2 px-2 text-muted-foreground">{t.nicho_nome}</td>
                        <td className="py-2 px-2 text-right font-mono">{formatCurrency(t.investimento)}</td>
                        <td className="py-2 px-2 text-right font-mono">{t.leads}</td>
                        <td className="py-2 px-2 text-right font-mono">{formatCurrency(t.cpl)}</td>
                        <td className="py-2 px-2 text-right font-mono">{t.conversao.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB: Por Nicho */}
      {tab === "nicho" && (
        <div className="space-y-6">
          <select value={selectedNicho} onChange={(e) => setSelectedNicho(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 bg-card font-medium shadow-sm outline-none focus:ring-1 focus:ring-primary min-w-[200px]">
            <option value="">Selecionar nicho...</option>
            {porNicho.map((n) => <option key={n.id} value={n.id}>{n.nome} ({n.leads} leads)</option>)}
          </select>

          {nichoFiltrado && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard label="Investimento" value={formatCurrency(nichoFiltrado.investimento)} />
                <KpiCard label="Leads" value={String(nichoFiltrado.leads)} />
                <KpiCard label="CPL" value={formatCurrency(nichoFiltrado.cpl)} />
                <KpiCard label="Conversão" value={`${nichoFiltrado.conversao.toFixed(1)}%`} />
                <KpiCard label="Contratos (manual)" value={String(nichoFiltrado.contratos_manual)} />
                <KpiCard label="Faturamento (manual)" value={formatCurrency(nichoFiltrado.faturamento_manual)} />
              </div>

              {/* Teses do nicho */}
              <Card>
                <CardHeader><CardTitle className="text-base">Teses do nicho "{nichoFiltrado.nome}"</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-xs">
                    <thead><tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-2">Tese</th><th className="text-right py-2 px-2">Invest.</th>
                      <th className="text-right py-2 px-2">Leads</th><th className="text-right py-2 px-2">CPL</th>
                      <th className="text-right py-2 px-2">Conv.</th><th className="text-right py-2 px-2">Contratos</th>
                      <th className="text-right py-2 px-2">Faturamento</th><th className="py-2 px-2" />
                    </tr></thead>
                    <tbody>
                      {tesesDoNicho.map((t) => (
                        <tr key={t.id} className="border-b border-border/30 hover:bg-muted/10">
                          <td className="py-2 px-2 font-medium">{t.nome}</td>
                          <td className="py-2 px-2 text-right font-mono">{formatCurrency(t.investimento)}</td>
                          <td className="py-2 px-2 text-right font-mono">{t.leads}</td>
                          <td className="py-2 px-2 text-right font-mono">{formatCurrency(t.cpl)}</td>
                          <td className="py-2 px-2 text-right font-mono">{t.conversao.toFixed(1)}%</td>
                          <td className="py-2 px-2 text-right font-mono">{t.contratos_manual}</td>
                          <td className="py-2 px-2 text-right font-mono">{formatCurrency(t.faturamento_manual)}</td>
                          <td className="py-2 px-2">
                            <button onClick={() => setEditManual({ id: t.id, contratos: t.contratos_manual, faturamento: t.faturamento_manual })}
                              className="text-[10px] text-primary hover:underline">Editar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Edit manual inline */}
              {editManual && (
                <Card className="border-primary/30">
                  <CardContent className="p-4 flex items-center gap-4">
                    <span className="text-xs font-medium">Dados manuais:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">Contratos:</span>
                      <Input type="number" value={editManual.contratos} onChange={(e) => setEditManual({ ...editManual, contratos: Number(e.target.value) })} className="h-7 w-20 text-xs" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">Faturamento:</span>
                      <Input type="number" value={editManual.faturamento} onChange={(e) => setEditManual({ ...editManual, faturamento: Number(e.target.value) })} className="h-7 w-28 text-xs" />
                    </div>
                    <Button size="sm" className="h-7 text-xs" onClick={() => salvarManual(selectedNicho, editManual.id, editManual.contratos, editManual.faturamento)}>Salvar</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditManual(null)}>Cancelar</Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB: Por Tese */}
      {tab === "tese" && (
        <div className="space-y-6">
          <div className="flex gap-3">
            <select value={selectedNicho} onChange={(e) => { setSelectedNicho(e.target.value); setSelectedTese(""); }}
              className="text-sm border rounded-lg px-3 py-2 bg-card shadow-sm outline-none focus:ring-1 focus:ring-primary">
              <option value="">Todos os nichos</option>
              {porNicho.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
            </select>
            <select value={selectedTese} onChange={(e) => setSelectedTese(e.target.value)}
              className="text-sm border rounded-lg px-3 py-2 bg-card shadow-sm outline-none focus:ring-1 focus:ring-primary min-w-[200px]">
              <option value="">Selecionar tese...</option>
              {tesesDoNicho.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          {teseFiltrada && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard label="Investimento" value={formatCurrency(teseFiltrada.investimento)} />
                <KpiCard label="Leads" value={String(teseFiltrada.leads)} />
                <KpiCard label="CPL" value={formatCurrency(teseFiltrada.cpl)} />
                <KpiCard label="Conversão" value={`${teseFiltrada.conversao.toFixed(1)}%`} />
                <KpiCard label="Nicho" value={teseFiltrada.nicho_nome} />
                <KpiCard label="ROAS" value={teseFiltrada.faturamento_manual > 0 && teseFiltrada.investimento > 0 ? (teseFiltrada.faturamento_manual / teseFiltrada.investimento).toFixed(2) : "—"} />
              </div>

              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <span className="text-xs font-medium">Dados manuais:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Contratos:</span>
                    <Input type="number" defaultValue={teseFiltrada.contratos_manual}
                      onBlur={(e) => salvarManual(teseFiltrada.nicho_id, teseFiltrada.id, Number(e.target.value), teseFiltrada.faturamento_manual)}
                      className="h-7 w-20 text-xs" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Faturamento:</span>
                    <Input type="number" defaultValue={teseFiltrada.faturamento_manual}
                      onBlur={(e) => salvarManual(teseFiltrada.nicho_id, teseFiltrada.id, teseFiltrada.contratos_manual, Number(e.target.value))}
                      className="h-7 w-28 text-xs" />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* TAB: Comparar Teses */}
      {tab === "comparar" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Selecione 2 a 5 teses para comparar:</p>
            <div className="flex flex-wrap gap-2">
              {porTese.map((t) => {
                const selected = compareTeses.includes(t.id);
                return (
                  <button key={t.id} onClick={() => toggleCompare(t.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${selected ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card text-muted-foreground border-border hover:border-primary/50"}`}>
                    {t.nome} <span className="text-[9px] opacity-70">({t.nicho_nome})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {compareData.length >= 2 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Comparação de Teses</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3 font-bold">Métrica</th>
                    {compareData.map((t, i) => <th key={t.id} className="text-right py-2 px-3 font-bold" style={{ color: COLORS[i] }}>{t.nome}</th>)}
                  </tr></thead>
                  <tbody>
                    {([
                      { label: "Investimento", key: "investimento", fmt: (v: number) => formatCurrency(v), best: "min" },
                      { label: "Leads", key: "leads", fmt: (v: number) => String(v), best: "max" },
                      { label: "CPL", key: "cpl", fmt: (v: number) => formatCurrency(v), best: "min" },
                      { label: "Conversão", key: "conversao", fmt: (v: number) => `${v.toFixed(1)}%`, best: "max" },
                      { label: "Contratos", key: "contratos_manual", fmt: (v: number) => String(v), best: "max" },
                      { label: "Faturamento", key: "faturamento_manual", fmt: (v: number) => formatCurrency(v), best: "max" },
                    ] as { label: string; key: string; fmt: (v: number) => string; best: "min" | "max" }[]).map((metric) => {
                      const values = compareData.map((t) => (t as any)[metric.key] as number);
                      const bestVal = metric.best === "max" ? Math.max(...values) : Math.min(...values);
                      const worstVal = metric.best === "max" ? Math.min(...values) : Math.max(...values);
                      const allSame = values.every((v) => v === values[0]);
                      return (
                        <tr key={metric.key} className="border-b border-border/30">
                          <td className="py-2.5 px-3 font-medium">{metric.label}</td>
                          {compareData.map((t) => {
                            const val = (t as any)[metric.key] as number;
                            const isBest = !allSame && val === bestVal && val > 0;
                            const isWorst = !allSame && val === worstVal && values.filter((v) => v > 0).length > 1;
                            return (
                              <td key={t.id} className={`py-2.5 px-3 text-right font-mono ${isBest ? "text-green-400 font-bold" : isWorst ? "text-red-400" : ""}`}>
                                {metric.fmt(val)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {/* ROAS row */}
                    <tr className="border-b border-border/30">
                      <td className="py-2.5 px-3 font-medium">ROAS</td>
                      {compareData.map((t) => {
                        const roas = t.investimento > 0 && t.faturamento_manual > 0 ? t.faturamento_manual / t.investimento : null;
                        return <td key={t.id} className="py-2.5 px-3 text-right font-mono">{roas != null ? roas.toFixed(2) : "—"}</td>;
                      })}
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// Sub-component: lead attribution row
function LeadAtribuirRow({ lead, nichos, teses, onSave }: {
  lead: LeadNaoAtribuido;
  nichos: { id: string; nome: string }[];
  teses: { id: string; nome: string; nicho_id: string }[];
  onSave: (leadId: string, nichoId: string, teseId: string) => void;
}) {
  const [nicho, setNicho] = useState("");
  const [tese, setTese] = useState("");
  return (
    <div className="flex items-center gap-3 p-2 border rounded-lg bg-background/50">
      <span className="text-xs font-medium flex-1 truncate">{lead.nome}</span>
      <Badge className="text-[9px] bg-muted/50">{lead.etapa}</Badge>
      <select value={nicho} onChange={(e) => { setNicho(e.target.value); setTese(""); }}
        className="text-[10px] bg-transparent border rounded px-1.5 py-1 min-w-[100px]">
        <option value="">Nicho...</option>
        {nichos.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
      </select>
      <select value={tese} onChange={(e) => setTese(e.target.value)}
        className="text-[10px] bg-transparent border rounded px-1.5 py-1 min-w-[100px]" disabled={!nicho}>
        <option value="">Tese...</option>
        {teses.filter((t) => t.nicho_id === nicho).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select>
      <Button size="sm" className="h-6 text-[10px]" disabled={!nicho || !tese} onClick={() => onSave(lead.id, nicho, tese)}>
        <Check size={10} />
      </Button>
    </div>
  );
}
