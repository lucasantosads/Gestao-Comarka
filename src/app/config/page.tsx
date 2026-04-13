"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MonthSelector } from "@/components/month-selector";
import { getCurrentMonth } from "@/lib/format";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/currency-input";
import { AI_CONFIG, AI_LABELS, AI_FUNCTION_LABELS, ALL_PROVIDERS, type AIFunction } from "@/lib/ai-config";
import type { AIProvider } from "@/lib/ai-client";
import { RefreshCw, Save, HardDrive, Settings2, Users, ArrowUpRight, Cpu, AlertTriangle, Database } from "lucide-react";
import { useConfigGlobal } from "@/hooks/use-config-swr";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface AIStatus { provider: string; status: "ok" | "sem_creditos" | "erro" | "sem_chave"; mensagem: string; latencia?: number }

// SSR-Safe Custom Hook for LocalStorage
function useSafeLocalStorage(key: string, initialValue: string) {
  const [value, setValue] = useState(initialValue);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem(key);
    if (stored) setValue(stored);
  }, [key]);

  const updateFn = useCallback((v: string) => {
    setValue(v);
    if (typeof window !== "undefined") window.localStorage.setItem(key, v);
  }, [key]);

  return [value, updateFn, mounted] as const;
}

// Components para Extrair os Hooks Fora do `.map`
function AIProviderSelect({ fn }: { fn: AIFunction }) {
  const savedKey = `ai_provider_${fn}`;
  const [currentProvider, setProvider] = useSafeLocalStorage(savedKey, AI_CONFIG[fn]);

  const syncToServer = useCallback(async (value: string) => {
    try {
      await supabase.from("system_config").upsert(
        { key: savedKey, value: { provider: value }, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    } catch { }
  }, [savedKey]);

  // Carregar do servidor na montagem
  useEffect(() => {
    async function loadFromServer() {
      try {
        const { data } = await supabase.from("system_config").select("value").eq("key", savedKey).single();
        if (data?.value?.provider) {
          setProvider(data.value.provider);
        }
      } catch { }
    }
    loadFromServer();
  }, [savedKey, setProvider]);

  return (
    <div className="flex items-center justify-between p-3 bg-muted/10 border border-border/30 rounded-xl hover:bg-muted/20 transition-all">
      <div>
        <p className="text-xs font-bold">{AI_FUNCTION_LABELS[fn]}</p>
        <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest">Base Padrão: {AI_LABELS[AI_CONFIG[fn]].nome}</p>
      </div>
      <div className="flex bg-background border border-border/40 rounded-lg p-0.5 shadow-sm">
        <select value={currentProvider} onChange={(e) => { setProvider(e.target.value); syncToServer(e.target.value); toast.success(`Cluster "${AI_FUNCTION_LABELS[fn]}" atribuído para ${AI_LABELS[e.target.value as AIProvider].nome}`); }} className="text-[10px] font-bold uppercase tracking-widest bg-transparent border-none outline-none appearance-none px-2 py-1 text-right w-24 cursor-pointer hover:bg-muted rounded">
          {ALL_PROVIDERS.map((p) => <option key={p} value={p}>{AI_LABELS[p].nome}</option>)}
        </select>
      </div>
    </div>
  );
}

function ThresholdInput({ item }: { item: { key: string, label: string, defaultVal: string, step: string } }) {
  const [val, setVal] = useSafeLocalStorage(item.key, item.defaultVal);

  // Carregar do servidor na montagem
  useEffect(() => {
    async function loadFromServer() {
      try {
        const { data } = await supabase.from("system_config").select("value").eq("key", item.key).single();
        if (data?.value?.threshold !== undefined) {
          setVal(String(data.value.threshold));
        }
      } catch { }
    }
    loadFromServer();
  }, [item.key, setVal]);

  const syncToServer = useCallback(async (value: string) => {
    try {
      await supabase.from("system_config").upsert(
        { key: item.key, value: { threshold: value }, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      toast.success(`${item.label} sincronizado`);
    } catch {
      toast.warning(`${item.label} salvo localmente`);
    }
  }, [item.key, item.label]);

  return (
    <div className="flex items-center justify-between p-3 bg-background/50 border border-rose-500/10 rounded-xl hover:border-rose-500/30 transition-all shadow-sm">
      <p className="text-xs font-black tracking-tight text-foreground">{item.label}</p>
      <input type="number" step={item.step} value={val} onChange={(e) => setVal(e.target.value)} onBlur={() => syncToServer(val)} className="w-16 bg-rose-500/10 text-rose-400 font-mono font-black text-right border-none p-1 rounded-md text-xs outline-none focus:ring-1 focus:ring-rose-500" />
    </div>
  );
}

export default function ConfigPage() {
  const [mounted, setMounted] = useState(false);
  const [mes, setMes] = useState(getCurrentMonth());

  // States Locais
  const [leads, setLeads] = useState(0);
  const [investimento, setInvestimento] = useState(0);
  const [saving, setSaving] = useState(false);

  const { config, isLoading, mutate } = useConfigGlobal(mes);

  useEffect(() => {
    if (config) {
      setLeads(config.leads_totais);
      setInvestimento(Number(config.investimento));
    } else {
      setLeads(0);
      setInvestimento(0);
    }
  }, [config, mes]);

  const [aiStatus, setAiStatus] = useState<AIStatus[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    checkAI();
  }, []);

  async function checkAI() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai-status");
      const data = await res.json();
      setAiStatus(data.providers || []);
    } catch { setAiStatus([]); }
    setAiLoading(false);
  }

  async function saveConfig() {
    if (saving) return;
    setSaving(true);
    const payload = { mes_referencia: mes, leads_totais: leads, investimento };

    try {
      if (config) {
        const { error } = await supabase.from("config_mensal").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", config.id);
        if (error) throw error;
        toast.success("Parâmetros Financeiros Atualizados!");
      } else {
        const { error } = await supabase.from("config_mensal").insert(payload);
        if (error) throw error;
        toast.success("Mês Inicializado com Sucesso!");
      }
      await mutate();
    } catch (e: any) {
      toast.error("Erro no Supabase: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700 fade-in pb-16">

      {/* HEADER BENTO */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-card/60 border border-border/50 p-6 rounded-2xl backdrop-blur-xl shadow-[0_4px_24px_-10px_rgba(0,0,0,0.1)] gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">Motor de Configurações <Settings2 size={24} className="text-zinc-500" /></h1>
          <p className="text-muted-foreground font-medium text-sm mt-1 max-w-[500px]">Ajuste global de orçamentos, chaves de inteligência artificial profunda e limites de quarentena de Ads Trusholds.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ORÇAMENTO GLOBAL BENTO */}
        <Card className="bg-card/40 backdrop-blur-md border border-border/40 shadow-lg relative overflow-hidden group">
          <CardHeader className="bg-muted/10 border-b border-border/30">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Database size={14} /> Budget Ads e Distribuição</CardTitle>
              <MonthSelector value={mes} onChange={setMes} />
            </div>
          </CardHeader>
          <CardContent className="p-6 relative z-10 space-y-6">
            {isLoading ? (
              <div className="h-20 animate-pulse bg-muted/20 rounded-xl" />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Volume Limite (Leads Totais)</Label>
                    <Input type="number" min={0} value={leads} onChange={(e) => setLeads(Number(e.target.value))} className="bg-background/50 border-border/40 font-mono font-bold text-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Orçamento Investido (R$)</Label>
                    <CurrencyInput value={investimento} onChange={setInvestimento} />
                  </div>
                </div>
                <Button onClick={saveConfig} disabled={saving} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white shadow-lg uppercase tracking-widest text-[10px] h-10 font-black">
                  {saving ? "Registrando Ledger..." : <><Save size={14} className="mr-2" /> Efetivar Parâmetros</>}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* DEEP LINK MEU PORTAL */}
        <Link href="/equipe" className="block">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer group shadow-sm border border-border/40">
            <CardContent className="p-8 h-full flex flex-col justify-center items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users size={32} className="text-primary" />
              </div>
              <h2 className="text-xl font-black tracking-tighter text-foreground mb-2">Central Administrativa</h2>
              <p className="text-xs text-muted-foreground font-medium max-w-[300px]">A gestão de SDRs, Closers, Hierarquias e RBAC System foram consolidados na aba Equipe & Portal.</p>
              <Badge className="mt-6 bg-primary text-primary-foreground hover:bg-primary/80 uppercase tracking-widest text-[10px] px-4 py-2 font-black cursor-pointer shadow-sm">Abrir Gestão <ArrowUpRight size={12} className="ml-1 inline" /></Badge>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* INTELIGENCIA ARTIFICIAL OMINIS */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="bg-card/40 backdrop-blur-md border border-border/40 shadow-lg">
            <CardHeader className="bg-muted/10 border-b border-border/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2"><Cpu size={14} /> Motores IA e Telemetria</CardTitle>
                <Button variant="outline" size="sm" onClick={checkAI} disabled={aiLoading} className="h-7 text-[10px] uppercase font-black tracking-widest border-border/50">
                  <RefreshCw size={12} className={`mr-1.5 ${aiLoading ? "animate-spin text-indigo-400" : ""}`} />
                  {aiLoading ? "Varrendo Nuvem..." : "Ping APIs"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { key: "anthropic", nome: "Anthropic (Claude)", link: "https://console.anthropic.com/", modelos: "Haiku, Sonnet" },
                  { key: "gemini", nome: "Google (Gemini)", link: "https://aistudio.google.com/apikey", modelos: "Flash 1.5/2.0" },
                  { key: "openai", nome: "OpenAI (GPT)", link: "https://platform.openai.com/", modelos: "4o Mini, 4o" },
                ].map((p) => {
                  const st = aiStatus.find((s) => s.provider === p.key);
                  const statusColor = !st ? "bg-muted/30 text-muted-foreground border border-border/20" : st.status === "ok" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : st.status === "sem_creditos" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : st.status === "sem_chave" ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" : "bg-rose-500/10 text-rose-400";
                  const statusLabel = !st ? "Unpinged" : st.status === "ok" ? "Master Active" : st.status === "sem_creditos" ? "Credit Drain" : st.status === "sem_chave" ? "No Keys" : "Dead Loop";
                  return (
                    <div key={p.key} className="p-4 bg-background/30 rounded-xl border border-border/30 hover:bg-muted/10 transition-colors flex flex-col justify-between h-full">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] font-black uppercase tracking-widest">{p.nome}</p>
                        <Badge variant="outline" className={`text-[8px] uppercase font-black px-1.5 py-0 ${statusColor}`}>{statusLabel}</Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-mono">Mod: {p.modelos}</p>
                        {st?.latencia && <p className="text-[10px] text-muted-foreground font-mono">Latência: <span className={st.latencia > 1000 ? "text-yellow-400" : "text-emerald-400"}>{st.latencia}ms</span></p>}
                        {st?.status === "sem_creditos" && <p className="text-[9px] text-rose-400 mt-2 p-1.5 bg-rose-500/10 rounded">{st.mensagem}</p>}
                      </div>
                      <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-[9px] text-foreground font-bold tracking-widest mt-4 flex items-center justify-between hover:text-indigo-400 transition-colors uppercase border-t border-border/20 pt-2">
                        Gerenciar Chaves <ArrowUpRight size={10} />
                      </a>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3">
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-4">Mapeamento de Rotinas Neuronais</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.keys(AI_CONFIG) as AIFunction[]).map((fn) => <AIProviderSelect key={fn} fn={fn} />)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* LIMITES E QUARENTENA DE TRÁFEGO */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-sm border border-border/40">
            <CardHeader className="bg-muted/30 border-b border-border/30 pb-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-rose-500 flex items-center gap-2"><AlertTriangle size={14} /> Thresholds Ads Quarentena</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 pt-4">
              {[
                { key: "trafego_cpl_limite", label: "CPL Máximo (R$)", defaultVal: "100", step: "1" },
                { key: "trafego_ctr_minimo", label: "CTR Base Min (%)", defaultVal: "0.8", step: "0.1" },
                { key: "trafego_freq_maxima", label: "Burn Freq.(x)", defaultVal: "3", step: "0.5" },
                { key: "trafego_zero_horas", label: "Zero Leads GAP (h)", defaultVal: "48", step: "12" },
                { key: "trafego_zero_gasto", label: "Piso de Gasto (R$)", defaultVal: "50", step: "10" },
              ].map((item) => <ThresholdInput key={item.key} item={item} />)}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
