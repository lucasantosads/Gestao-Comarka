"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurrencyInput } from "@/components/currency-input";
import { formatCurrency, formatPercent, getCurrentMonth } from "@/lib/format";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useFinanceiroResumoSWR } from "@/hooks/use-financeiro-swr";
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, X,
  Download, FileText, ChevronDown, ChevronRight, Search, Shield, Eye
} from "lucide-react";

const MESES_LABEL: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr", "05": "Mai", "06": "Jun",
  "07": "Jul", "08": "Ago", "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};
function mesLabel(d: string) { return MESES_LABEL[d.slice(5, 7)] || d.slice(5, 7); }

const STATUS_KNOBS = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  received: "bg-green-500/10 text-green-400 border-green-500/30",
  confirmed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  overdue: "bg-red-500/10 text-red-400 border-red-500/30",
  refunded: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

const MATCH_KNOBS = {
  pendente: "bg-yellow-500/10 text-yellow-400",
  conciliado_auto: "bg-green-500/10 text-green-400",
  conciliado_manual: "bg-blue-500/10 text-blue-400",
  sem_match: "bg-red-500/10 text-red-400",
};

export default function FinanceiroPage() {
  const [mounted, setMounted] = useState(false);
  const [mes, setMes] = useState("");
  const [cenario, setCenario] = useState<"otimista" | "realista" | "pessimista">("realista");
  const [showNovaCobranca, setShowNovaCobranca] = useState(false);
  const [expandedChurn, setExpandedChurn] = useState(false);
  const [asaasFilter, setAsaasFilter] = useState({ status: "", match_status: "" });

  useEffect(() => {
    setMounted(true);
    setMes(getCurrentMonth());
  }, []);

  const { data, isLoading, mutate } = useFinanceiroResumoSWR(mes);

  async function handleAprovar(id: string, tipo: "criacao" | "recebimento", aprovado: boolean) {
    const route = tipo === "criacao" ? "aprovar-criacao" : "aprovar-recebimento";
    const title = tipo === "criacao" ? "Criação" : "Recebimento";
    const res = await fetch(`/api/asaas/pagamentos/${id}/${route}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aprovado }),
    });
    if (res.ok) { toast.success(`${title} ${aprovado ? "Aprovada" : "Reprovada"}`); mutate(); }
    else toast.error(`Erro ao processar ${title}`);
  }

  async function handleConciliacaoManual(pagId: string, clienteId: string) {
    const res = await fetch(`/api/asaas/pagamentos`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pagId, cliente_id: clienteId, match_status: "conciliado_manual" }),
    });
    if (res.ok) { toast.success("Conciliação manual realizada"); mutate(); }
  }

  if (!mounted || isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-in fade-in zoom-in text-muted-foreground">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin mb-4" />
        <p className="font-mono text-sm tracking-widest uppercase">Sincronizando Bancos...</p>
      </div>
    );
  }

  const { kpis, fluxo_caixa, margens, comissoes, total_comissoes, asaas } = data;
  const fluxoFiltrado = (fluxo_caixa || []).filter((f: any) => f.cenario === cenario);
  const chartFluxo = fluxoFiltrado.map((f: any) => ({
    mes: mesLabel(f.mes_referencia), Receita: f.receita_projetada, Custos: f.custos_projetados, Resultado: f.resultado_projetado,
  }));

  const churnTotal = fluxoFiltrado.reduce((s: number, f: any) => s + f.churn_impacto, 0);
  const clientesEmRisco = fluxoFiltrado[0]?.detalhamento as any;
  const clientesRiscoAlto = clientesEmRisco?.clientes_risco_alto || [];

  const asaasFiltrado = (asaas?.pagamentos || []).filter((p: any) => {
    if (asaasFilter.status && p.status !== asaasFilter.status) return false;
    if (asaasFilter.match_status && p.match_status !== asaasFilter.match_status) return false;
    return true;
  });

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700 fade-in pb-16">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-card/60 border border-border/50 p-6 rounded-2xl backdrop-blur-xl shadow-[0_4px_24px_-10px_rgba(0,0,0,0.1)] gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">Painel de Receita <DollarSign size={24} className="text-emerald-500" /></h1>
          <p className="text-muted-foreground font-medium text-sm mt-1 max-w-[500px]">Visão global do núcleo financeiro: Receitas, Comissões, Margens e Boletos Asaas processados em tempo real.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-muted/30 p-1 rounded-lg border border-border/50 items-center">
            <CalendarSelector m={mes} setM={setMes} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricBox title="MRR Atual" v={kpis.mrr} prev={kpis.crescimento_mom} type="curr" />
        <MetricBox title="Crescimento MoM" v={kpis.crescimento_mom} type="pct" />
        <MetricBox title="Cresc. Anual (YoY)" v={kpis.crescimento_yoy} type="pct" />
        <MetricBox title="Lucro Líquido" v={kpis.lucro_liquido} prev={kpis.crescimento_lucro} type="curr" colored />
        <MetricBox title="Cresc. Lucro" v={kpis.crescimento_lucro} type="pct" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ESQUERDA - FLUXO DE CAIXA */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="bg-card/40 backdrop-blur-md border border-primary/10 overflow-hidden shadow-lg">
            <CardHeader className="bg-muted/10 border-b border-border/30 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2"><TrendingUp size={16} /> Motor de Fluxo de Caixa</CardTitle>
                <div className="flex bg-background rounded-lg border p-0.5">
                  {(["otimista", "realista", "pessimista"] as const).map(c => (
                    <button key={c} onClick={() => setCenario(c)} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${cenario === c ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted"}`}>{c}</button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {chartFluxo.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width={("100%")} height="100%">
                    <BarChart data={chartFluxo}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="mes" stroke="#888" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#888" }} />
                      <YAxis stroke="#888" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                      <Tooltip cursor={{ fill: "#ffffff05" }} contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => formatCurrency(v)} />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                      <Bar dataKey="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Custos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Resultado" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex flex-col items-center justify-center text-muted-foreground"><p className="text-sm">Sem projeções calculadas para o momento.</p></div>
              )}

              <AnimatePresence>
                {churnTotal > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-6 border border-rose-500/30 bg-rose-500/10 rounded-xl overflow-hidden backdrop-blur-sm">
                    <div className="p-4 cursor-pointer flex items-center justify-between" onClick={() => setExpandedChurn(!expandedChurn)}>
                      <div className="flex items-center gap-3">
                        <AlertTriangle size={18} className="text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                        <div>
                          <p className="text-xs uppercase tracking-widest font-black text-rose-500">Risco Iminente: Impacto Churn Acumulado</p>
                          <p className="text-lg font-mono font-bold text-rose-400">{formatCurrency(churnTotal)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link href="/crm" onClick={(e) => e.stopPropagation()} className="px-3 py-1 bg-rose-500 text-white font-bold text-[10px] uppercase tracking-widest rounded-md hover:bg-rose-600 transition-colors shadow flex items-center gap-1">Isolar no CRM <Eye size={12} /></Link>
                        {expandedChurn ? <ChevronDown size={16} className="text-rose-400" /> : <ChevronRight size={16} className="text-rose-400" />}
                      </div>
                    </div>
                    {expandedChurn && clientesRiscoAlto.length > 0 && (
                      <div className="p-4 pt-0 border-t border-rose-500/20 bg-rose-500/5">
                        <p className="text-[10px] text-rose-300 uppercase tracking-widest font-bold mb-2">Contratos na UTI (Risco Alto)</p>
                        <div className="flex flex-wrap gap-2">
                          {clientesRiscoAlto.map((n: string) => <Badge key={n} className="bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30">{n}</Badge>)}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* MARGINS */}
          <Card className="bg-card/40 backdrop-blur-md">
            <CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest">Margem Contábil por Cliente Responsável</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-border/40">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-b border-border/50">
                      <TableHead className="text-xs uppercase font-bold text-muted-foreground w-[200px]">Cliente</TableHead>
                      <TableHead className="text-xs uppercase font-bold text-muted-foreground text-right">LTV.Liq</TableHead>
                      <TableHead className="text-xs uppercase font-bold text-muted-foreground text-right w-[100px]">Rentab(%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {margens && margens.map((m: any) => (
                      <TableRow key={m.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                        <TableCell className="font-medium text-sm">{m.clientes?.nome || "Desconhecido"}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-sm">{formatCurrency(m.margem_liquida)}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={`w-[60px] flex justify-center text-[10px] font-mono ${m.margem_pct < 30 ? "bg-red-500/20 text-red-400" : m.margem_pct < 50 ? "bg-yellow-500/20 text-yellow-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                            {m.margem_pct.toFixed(0)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!margens?.length && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Sem dados contábeis declarados.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* DIREITA - ASAAS E COMISSOES */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-sm border border-border/40">
            <CardHeader className="border-b border-border/30 pb-4 bg-muted/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><DollarSign size={16} /> Gateway de Checkout</CardTitle>
                <Button size="sm" onClick={() => setShowNovaCobranca(true)} className="h-7 text-[10px] uppercase font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">Faturar Renda</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-b border-border/30 p-3 bg-muted/10 flex gap-2">
                <select className="flex-1 bg-background/50 border border-border/40 rounded-md px-2 py-1.5 text-xs text-muted-foreground font-medium outline-none shadow-sm" value={asaasFilter.status} onChange={(e) => setAsaasFilter(p => ({ ...p, status: e.target.value }))}>
                  <option value="">Status Global</option>
                  <option value="pending">Pendentes</option>
                  <option value="received">Pagos</option>
                  <option value="overdue">Vencidos</option>
                </select>
              </div>
              <div className="max-h-[350px] overflow-y-auto w-full">
                {asaasFiltrado.map((p: any) => (
                  <div key={p.id} className="p-4 border-b border-border/30 hover:bg-muted/30 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-xs font-bold text-foreground max-w-[180px] truncate">{p.clientes?.nome || p.descricao}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{p.data_vencimento}</p>
                      </div>
                      <span className={`text-base font-black font-mono tracking-tight ${p.status === "received" ? "text-emerald-400" : p.status === "overdue" ? "text-rose-400" : "text-indigo-400"}`}>{formatCurrency(p.valor)}</span>
                    </div>
                    <div className="flex gap-2 items-center justify-between">
                      <div className="flex gap-2">
                        <Badge variant="outline" className={`text-[9px] uppercase tracking-widest font-bold ${STATUS_KNOBS[p.status as keyof typeof STATUS_KNOBS] || ""}`}>{p.status}</Badge>
                        {p.match_status !== 'conciliado_auto' && <Badge variant="outline" className={`text-[9px] ${MATCH_KNOBS[p.match_status as keyof typeof MATCH_KNOBS] || ""}`}>{p.match_status}</Badge>}
                      </div>
                      <div className="flex gap-1">
                        {p.aprovacao_criacao_status === "aguardando" && (
                          <div className="flex bg-background rounded border p-0.5 shadow-sm">
                            <button onClick={() => handleAprovar(p.id, "criacao", true)} className="px-2 hover:bg-emerald-500/20 text-emerald-500 rounded text-[10px]"><CheckCircle size={12} /></button>
                            <button onClick={() => handleAprovar(p.id, "criacao", false)} className="px-2 hover:bg-rose-500/20 text-rose-500 rounded text-[10px]"><X size={12} /></button>
                          </div>
                        )}
                        {p.aprovacao_recebimento_status === "aguardando" && (
                          <div className="flex bg-background rounded border p-0.5 shadow-sm">
                            <button title="Aprovar Baixa" onClick={() => handleAprovar(p.id, "recebimento", true)} className="p-1 hover:bg-indigo-500/20 text-indigo-400 rounded text-[10px]"><TrendingUp size={12} /></button>
                            <button title="Rejeitar" onClick={() => handleAprovar(p.id, "recebimento", false)} className="p-1 hover:bg-rose-500/20 text-rose-500 rounded text-[10px]"><X size={12} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {asaas.sem_match.length > 0 && (
                <div className="p-4 bg-muted/20 border-t border-border/30">
                  <p className="text-[10px] uppercase font-black tracking-widest text-destructive flex items-center gap-1 mb-2"><AlertTriangle size={12} /> Lost Checkouts ({asaas.sem_match.length})</p>
                  <div className="space-y-2">
                    {asaas.sem_match.map((p: any) => (
                      <div key={p.id} className="flex justify-between items-center text-xs bg-background p-2 rounded border border-border/40 shadow-sm">
                        <span className="truncate max-w-[120px] text-muted-foreground">{p.descricao}</span>
                        <button onClick={() => { const c = prompt("UUID CRM do Cliente:"); if (c) handleConciliacaoManual(p.id, c); }} className="text-[9px] px-2 py-1 bg-primary/20 text-primary hover:bg-primary/40 rounded uppercase tracking-wider font-bold transition-all">Forçar Sync</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-md">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-black uppercase tracking-widest">Borderô de Comissionamento</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {comissoes?.length > 0 ? comissoes.map((c: any) => (
                <div key={c.employee_id} className="bg-muted/20 p-4 rounded-xl border border-border/40 relative overflow-hidden group">
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <p className="font-bold text-sm tracking-tight">{c.nome}</p>
                      <p className="text-[10px] uppercase text-muted-foreground tracking-widest">{c.role}</p>
                    </div>
                    <Badge variant="outline" className={`font-mono text-[10px] ${c.ote_pct >= 80 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : c.ote_pct >= 50 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" : "text-rose-400 bg-rose-500/10 border-rose-500/20"}`}>
                      {c.ote_pct.toFixed(0)}% OTE
                    </Badge>
                  </div>
                  <div className="mt-3 flex justify-between items-end relative z-10">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Comissão Adquirida</p>
                      <p className="text-lg font-black font-mono text-emerald-400">{formatCurrency(c.comissao)}</p>
                    </div>
                    <Link href="/equipe-geral" className="px-3 py-1 bg-background text-foreground text-[9px] uppercase font-bold tracking-widest rounded-lg border hover:bg-muted transition-all shadow-sm flex items-center gap-1">Dossiê <ChevronRight size={10} /></Link>
                  </div>
                  <div className="absolute top-0 right-0 h-full w-[2px] bg-gradient-to-b from-transparent via-emerald-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )) : <p className="text-muted-foreground text-xs text-center py-6">Sem rendimentos processados.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      {showNovaCobranca && <NovaCobrancaModal onClose={() => setShowNovaCobranca(false)} onSuccess={() => { setShowNovaCobranca(false); mutate(); }} />}
    </div>
  );
}

// Minimal Components
function CalendarSelector({ m, setM }: { m: string, setM: (m: string) => void }) {
  return <Input type="month" value={m} onChange={(e) => setM(e.target.value)} className="h-8 text-xs font-mono bg-transparent border-0 ring-0 focus-visible:ring-0 shadow-none w-36" />;
}

function MetricBox({ title, v, prev, type, colored }: any) {
  return (
    <div className={`p-4 rounded-xl border backdrop-blur-sm ${colored ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card/60 border-border/50"}`}>
      <p className={`text-[10px] uppercase tracking-widest font-black mb-1 ${colored ? "text-emerald-500" : "text-muted-foreground"}`}>{title}</p>
      <p className={`text-2xl font-black tracking-tight ${colored ? "text-emerald-400" : ""}`}>{type === "curr" ? formatCurrency(v) : type === "pct" ? formatPercent(v) : v}</p>
      {prev !== undefined && (
        <div className="mt-2 flex items-center gap-1.5 opacity-80">
          {prev > 0 ? <Badge className="px-1.5 h-4 bg-emerald-500/10 text-emerald-400 text-[9px] font-mono border-0"><TrendingUp size={10} className="mr-0.5" />+{prev.toFixed(1)}%</Badge> : prev < 0 ? <Badge className="px-1.5 h-4 bg-rose-500/10 text-rose-400 text-[9px] font-mono border-0"><TrendingDown size={10} className="mr-0.5" />{prev.toFixed(1)}%</Badge> : <span className="text-[10px] text-muted-foreground">—</span>}
        </div>
      )}
    </div>
  )
}

function NovaCobrancaModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ cliente_id: "", valor: 0, data_vencimento: "", tipo: "boleto", descricao: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!form.valor || !form.data_vencimento) return toast.error("Preencha valor e vencimento");
    setSaving(true);
    const res = await fetch("/api/asaas/pagamentos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) { toast.success("Fatura expedida. Pendente aprovação."); onSuccess(); }
    else { const d = await res.json(); toast.error(d.error || "Erro asaas."); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in zoom-in-95">
      <Card className="w-[480px] bg-slate-900 border-slate-800 shadow-[0_0_60px_-15px_rgba(99,102,241,0.5)]">
        <CardHeader className="border-b border-white/5 pb-4"><div className="flex items-center justify-between"><CardTitle className="text-sm uppercase tracking-widest font-black text-indigo-400">Gateway de Cobrança Neural</CardTitle><Button variant="ghost" size="sm" onClick={onClose}><X size={16} /></Button></div></CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Nota e Descritivo</Label><Input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} className="bg-black/20 border-white/10 text-sm font-medium" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Rendimento Total</Label><CurrencyInput value={form.valor} onChange={v => setForm(p => ({ ...p, valor: v }))} /></div>
            <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Modalidade</Label><select className="w-full h-10 px-3 rounded-md bg-black/20 border border-white/10 text-sm outline-none" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}><option value="boleto">Boleto Compesável</option><option value="pix">PIX Fast</option><option value="credit_card">Credit API</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Prazo Vencimento</Label><Input type="date" value={form.data_vencimento} onChange={e => setForm(p => ({ ...p, data_vencimento: e.target.value }))} className="bg-black/20 border-white/10 text-sm font-mono" /></div>
            <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Chave Cliente (Opc.)</Label><Input value={form.cliente_id} onChange={e => setForm(p => ({ ...p, cliente_id: e.target.value }))} className="bg-black/20 border-white/10 text-sm font-mono" placeholder="uuid-xxxx" /></div>
          </div>
          <Button onClick={handleSubmit} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white tracking-widest font-black uppercase shadow-lg shadow-indigo-600/30">{saving ? "Protocolando asaas..." : "Emitir Boleto via API"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
