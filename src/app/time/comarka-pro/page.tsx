"use client";

import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from "recharts";
import { useComarkaProSWR } from "@/hooks/use-comarka-pro-swr";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Trophy, TrendingUp, Presentation, Crown, Plus, Calendar, Star, CheckCircle, Flame, ArrowUpRight, MessageSquare, AlertCircle, Play, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ComarkaProPage() {
  const [mounted, setMounted] = useState(false);
  const [showRoteiro, setShowRoteiro] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const { data, isLoading, mutate } = useComarkaProSWR();

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-in fade-in zoom-in text-muted-foreground">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin mb-4" />
        <p className="font-mono text-xs tracking-widest uppercase font-bold text-emerald-400">Restaurando Gamificação Neural...</p>
      </div>
    );
  }

  const { cronometro_pct, cronometro_dias, cronometro_dias_uteis } = data.metas_automaticas;
  // Anti-NaN / Infinity Fallback
  const cronoTarget = cronometro_dias_uteis > 0 ? 95 : 0;
  const safePct = cronometro_dias_uteis > 0 ? Math.min(100, Math.round((cronometro_dias / cronometro_dias_uteis) * 100)) : 0;
  const cronoOk = safePct >= cronoTarget;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700 fade-in pb-16">

      {/* Header Bento */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-card/60 border border-border/50 p-6 rounded-2xl backdrop-blur-xl shadow-[0_4px_24px_-10px_rgba(0,0,0,0.1)] gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">Comarka Pro <Crown size={24} className="text-yellow-500" /></h1>
          <p className="text-muted-foreground font-medium text-sm mt-1 max-w-[500px]">Módulo de Recompensas e Gamificação Operacional. Lançamentos manuais impactam diretamente no placar da agência.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowRoteiro(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 text-[10px] uppercase tracking-widest font-black"><Presentation size={14} className="mr-1.5" /> Emplacar Roteiro Ads</Button>
          <Button onClick={() => setShowFeedback(true)} className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 text-[10px] uppercase tracking-widest font-black"><MessageSquare size={14} className="mr-1.5" /> Declarar Feedback</Button>
        </div>
      </div>

      {/* KPIS Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-emerald-500/5 backdrop-blur-md border border-emerald-500/20 relative overflow-hidden group">
          <CardContent className="p-5 flex flex-col justify-between h-full relative z-10">
            <div className="flex justify-between items-start mb-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-emerald-500">Pontuação do Mês</p>
              <Trophy size={14} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-4xl font-black tracking-tighter text-emerald-400 font-mono">{data.pontos_mes}</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">{data.pontos_brutos} PONTOS BRUTOS BASE</p>
            </div>
          </CardContent>
          <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-emerald-500/10 blur-xl rounded-full group-hover:scale-150 transition-transform duration-700" />
        </Card>

        <Card className="bg-card/40 backdrop-blur-md border border-border/40 relative overflow-hidden group">
          <CardContent className="p-5 flex flex-col justify-between h-full relative z-10">
            <div className="flex justify-between items-start mb-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Classificação Local</p>
              <TrendingUp size={14} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-4xl font-black tracking-tighter text-foreground font-mono">{data.posicoes.mensal ? `${data.posicoes.mensal}º` : "—"}</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">RANKING MENSAL INTERNO</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-500/5 backdrop-blur-md border border-orange-500/20 relative overflow-hidden group">
          <CardContent className="p-5 flex flex-col justify-between h-full relative z-10">
            <div className="flex justify-between items-start mb-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-orange-500">Streak Operacional</p>
              <Flame size={14} className="text-orange-500" />
            </div>
            <div>
              <p className="text-4xl font-black tracking-tighter text-orange-400 font-mono">{data.meses_sequencia} <span className="text-sm font-bold tracking-widest uppercase opacity-70">meses</span></p>
              <Badge variant="outline" className={`mt-2 font-mono text-[9px] uppercase tracking-widest ${data.multiplicador_ativo > 1 ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "text-muted-foreground border-border/50"}`}>
                {data.multiplicador_ativo > 1 ? `Multiplicador Ativo ${data.multiplicador_ativo}x` : "Sem Boost de Recompensa"}
              </Badge>
            </div>
          </CardContent>
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-orange-500/10 blur-xl rounded-full group-hover:scale-150 transition-transform duration-700" />
        </Card>

        <Card className="bg-card/40 backdrop-blur-md border border-border/40 relative overflow-hidden group">
          <CardContent className="p-5 flex flex-col justify-between h-full relative z-10">
            <div className="flex justify-between items-start mb-2">
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Visão a Longo Prazo</p>
              <Star size={14} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-4xl font-black tracking-tighter text-foreground font-mono">{data.posicoes.trimestral ? `${data.posicoes.trimestral}º` : "—"}</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">RANKING TRIMESTRAL</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ESQUERDA - HISTORICO E FEED */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="bg-card/40 backdrop-blur-md border border-border/40 shadow-lg">
            <CardHeader className="bg-muted/10 border-b border-border/30 pb-4"><CardTitle className="text-xs uppercase font-black tracking-widest text-muted-foreground flex items-center gap-2"><TrendingUp size={14} /> Curva de Desempenho Anual</CardTitle></CardHeader>
            <CardContent className="p-6">
              <div className="h-64 mt-2">
                {data.historico.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.historico}>
                      <defs>
                        <linearGradient id="colorPts" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                      <XAxis dataKey="mes_referencia" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#888" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#888" }} />
                      <Tooltip cursor={{ stroke: "#ffffff10", strokeWidth: 2 }} contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", fontSize: "12px" }} />
                      <Area type="monotone" dataKey="pontos_finais" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPts)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-[10px] uppercase tracking-widest font-black text-muted-foreground">Ciclo de Ranking Vazio</div>}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-md border border-border/40 shadow-lg">
            <CardHeader className="border-b border-border/20 pb-4"><CardTitle className="text-xs uppercase font-black tracking-widest text-muted-foreground flex items-center gap-2"><CheckCircle size={14} /> Lançamentos Adquiridos ({data.mes_referencia})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/20 max-h-[320px] overflow-y-auto">
                {data.lancamentos.map(l => (
                  <div key={l.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between group">
                    <div className="flex gap-4 items-center">
                      <div className={`p-2 rounded-lg border ${l.pontos >= 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-rose-500/10 border-rose-500/20 text-rose-500"}`}>
                        {l.origem === "automatico" ? <Play size={14} /> : <Presentation size={14} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold tracking-tight text-foreground">{l.descricao || l.categoria}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] font-mono text-muted-foreground">{new Date(l.criado_em).toLocaleDateString("pt-BR")}</p>
                          <Badge variant="outline" className="text-[8px] px-1 py-0 uppercase tracking-widest border-border/50 bg-background">{l.origem}</Badge>
                          {l.descricao?.toLowerCase().includes("roteiro") && (
                            <Link href="/estrutura" className="flex items-center text-[9px] font-bold text-indigo-400 hover:text-indigo-300 ml-2 uppercase tracking-widest bg-indigo-500/10 px-1.5 py-0.5 rounded transition-all"><ArrowUpRight size={10} className="mr-0.5" /> ADS</Link>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`font-mono font-black text-lg ${l.pontos >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {l.pontos > 0 ? "+" : ""}{l.pontos}
                    </div>
                  </div>
                ))}
                {data.lancamentos.length === 0 && <div className="p-8 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">Sem ações computadas neste clico.</div>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* DIREITA - METAS E GESTÃO */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-card/40 backdrop-blur-md border border-border/40 shadow-lg">
            <CardHeader className="bg-muted/10 border-b border-border/30 pb-4"><CardTitle className="text-xs uppercase font-black tracking-widest text-muted-foreground flex items-center gap-2"><Trophy size={14} /> Sistema de Metas</CardTitle></CardHeader>
            <CardContent className="p-5 space-y-5 mt-2">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-black">
                  <span className={cronoOk ? "text-emerald-500" : "text-muted-foreground"}>Cronômetro (Time Tracking)</span>
                  <span className={cronoOk ? "text-emerald-400" : "text-yellow-500"}>{safePct}% / {cronoTarget}%</span>
                </div>
                <div className="h-2 bg-muted/40 rounded-full overflow-hidden border border-border/50">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${safePct}%` }} transition={{ duration: 1, ease: "easeOut" }} className={`h-full ${cronoOk ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-yellow-500"}`} />
                </div>
                <p className="text-[10px] font-mono text-muted-foreground text-right">{cronometro_dias} / {cronometro_dias_uteis} dias preenchidos</p>
              </div>

              {!cronoOk && cronometro_dias_uteis > 0 && (
                <div className="p-3 border border-yellow-500/20 bg-yellow-500/10 rounded-lg flex items-start gap-2">
                  <AlertCircle size={14} className="text-yellow-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-yellow-500 mb-1">Cuidado com Penalidades</p>
                    <p className="text-[10px] text-muted-foreground">Se a meta de cronômetro não atingir 95% até o dia 30, multiplicadores são desativados.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {showRoteiro && <RoteiroModal onClose={() => setShowRoteiro(false)} onSaved={mutate} />}
        {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} onSaved={mutate} />}
      </AnimatePresence>
    </div>
  );
}

function RoteiroModal({ onClose, onSaved }: { onClose: () => void, onSaved: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [cliente, setCliente] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const r = await fetch("/api/comarka-pro/roteiros", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ titulo, cliente_id: cliente || null }),
    });
    const res = await r.json();
    setLoading(false);

    if (res.ad_match_status === "encontrado") {
      toast.success(<div><p className="font-bold">Roteiro Acatado ({res.pontos_gerados} Pts)</p><p className="text-xs text-muted-foreground">Rede Neural conectou ao Anúncio Ativo {res.ad_id}</p></div>);
    } else {
      toast.success(<div><p className="font-bold">Roteiro Adicionado</p><p className="text-xs text-muted-foreground">{res._aviso || "Sem tracionamento com Campanhas Ads"}</p></div>);
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 w-full max-w-md shadow-[0_0_60px_-15px_rgba(16,185,129,0.3)] space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-xs uppercase font-black tracking-widest text-emerald-400 flex items-center gap-2"><Presentation size={14} /> Injetar Estrutura de Copy</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Nomenclatura Padrão Ads</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: CRIATIVO-01-OF-E" className="w-full text-sm font-medium bg-black/30 border border-white/10 rounded-lg p-2.5 outline-none focus:border-emerald-500/50 transition-colors" />
            <p className="text-[9px] text-muted-foreground italic">Nome exato usado no Tráfego para pareamento IA.</p>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">UUID do Cliente (Opcional)</label>
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="dossie-xxxx" className="w-full text-sm font-mono bg-black/30 border border-white/10 rounded-lg p-2.5 outline-none focus:border-emerald-500/50 transition-colors" />
          </div>
        </div>
        <div className="pt-2">
          <Button disabled={loading || !titulo} onClick={submit} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] h-10 shadow-lg shadow-emerald-600/20">{loading ? "Validando Assinatura..." : "Confirmar Ponto de Gamificação"}</Button>
        </div>
      </motion.div>
    </div>
  );
}

function FeedbackModal({ onClose, onSaved }: { onClose: () => void, onSaved: () => void }) {
  const [cliente, setCliente] = useState("");
  const [descricao, setDescricao] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    await fetch("/api/comarka-pro/feedbacks", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cliente_id: cliente, descricao, evidencia_url: url || null }),
    });
    setLoading(false);
    toast.success("Feedback Validado e 10 Pontos Adicionados.", { icon: "🌟" });
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 w-full max-w-md shadow-[0_0_60px_-15px_rgba(99,102,241,0.3)] space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-xs uppercase font-black tracking-widest text-indigo-400 flex items-center gap-2"><MessageSquare size={14} /> Reporte Técnico de Cliente</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">UUID do Relatório (CRM)</label>
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="dossie-xxxx" className="w-full text-sm font-mono bg-black/30 border border-white/10 rounded-lg p-2.5 outline-none focus:border-indigo-500/50 transition-colors" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Contexto do Depoimento</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Cliente validou aumento de ROAS..." className="w-full text-sm font-medium bg-black/30 border border-white/10 rounded-lg p-2.5 outline-none focus:border-indigo-500/50 transition-colors" rows={3} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Base Audível Analítica (URL/Drive)</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link do Print ou Drive..." className="w-full text-sm font-mono bg-black/30 border border-white/10 rounded-lg p-2.5 outline-none focus:border-indigo-500/50 transition-colors" />
          </div>
        </div>
        <div className="pt-2">
          <Button disabled={loading || !cliente || !descricao} onClick={submit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] h-10 shadow-lg shadow-indigo-600/20">{loading ? "Enviando ao Mestre..." : "Arquivar Feedback"}</Button>
        </div>
      </motion.div>
    </div>
  );
}
